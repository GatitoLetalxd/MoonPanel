// backend/src/services/levelDatService.js
// Reads and writes Minecraft Bedrock level.dat (little-endian NBT with 8-byte header)
const fs = require('fs')
const path = require('path')
const nbt = require('prismarine-nbt')
const { getInstanceDataPath } = require('./gameFileService.js')

// Bedrock level.dat has an 8-byte header before the NBT payload.
// Bytes 0-3: version tag (LE uint32), Bytes 4-7: NBT size (LE uint32)
const HEADER_SIZE = 8

/**
 * Returns the path to the active world's level.dat
 * Picks the first world folder found under /worlds/
 */
function getLevelDatPath(containerName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const worldsDir = path.join(basePath, 'worlds')
  if (!fs.existsSync(worldsDir)) {
    throw new Error('Directorio worlds no encontrado. Inicie el servidor al menos una vez.')
  }

  const entries = fs.readdirSync(worldsDir, { withFileTypes: true })
  const worldFolder = entries.find(e => e.isDirectory())
  if (!worldFolder) {
    throw new Error('No se encontro ningun mundo activo en la carpeta worlds.')
  }

  return {
    worldName: worldFolder.name,
    levelDatPath: path.join(worldsDir, worldFolder.name, 'level.dat'),
    worldPath: path.join(worldsDir, worldFolder.name)
  }
}

/**
 * Parse a Bedrock level.dat file.
 * Returns { header, parsed } where header is the raw 8-byte Buffer.
 */
async function parseLevelDat(filePath) {
  const raw = fs.readFileSync(filePath)
  const header = raw.slice(0, HEADER_SIZE)
  const nbtBuffer = raw.slice(HEADER_SIZE)
  const { parsed } = await nbt.parse(nbtBuffer, 'little')
  return { header, parsed }
}

/**
 * Serialize and write back a level.dat.
 * IMPORTANT: Bytes 0-3 of the header = format version tag (preserved).
 *            Bytes 4-7 of the header = NBT payload size (MUST be updated to
 *            match the actual written payload or BDS reads stale/corrupt data).
 * Also removes level.dat_old to prevent the server reverting our changes.
 */
async function writeLevelDat(filePath, header, parsedNbt) {
  const nbtBuffer = nbt.writeUncompressed(parsedNbt, 'little')

  // Build updated header: keep version tag (bytes 0-3), update size (bytes 4-7)
  const newHeader = Buffer.alloc(8)
  header.copy(newHeader, 0, 0, 4)             // preserve version tag
  newHeader.writeUInt32LE(nbtBuffer.length, 4) // update NBT payload size

  const output = Buffer.concat([newHeader, nbtBuffer])

  // Back up existing file before overwriting
  const backupPath = filePath + '_moonpanel_backup'
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath)
  }

  fs.writeFileSync(filePath, output)

  // Remove _old file so server doesn't revert our changes on next boot
  const oldPath = filePath + '_old'
  if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath)
  }
}

function getNbtValue(parsed, key) {
  const field = parsed.value[key]
  if (!field) return undefined
  const v = field.value
  // Long values come as arrays [hi, lo] in prismarine-nbt
  if (Array.isArray(v)) {
    // Convert int64 array to BigInt string for safe JSON transport
    const hi = BigInt(v[0]) << 32n
    let lo = BigInt(v[1])
    if (lo < 0n) {
      lo += 1n << 32n
    }
    return (hi + lo).toString()
  }
  return v
}

// Difficulty map
const DIFFICULTY_MAP = { 0: 'Peaceful', 1: 'Easy', 2: 'Normal', 3: 'Hard' }
const GAME_TYPE_MAP  = { 0: 'Survival', 1: 'Creative', 2: 'Adventure', 3: 'Spectator' }

/**
 * Read all relevant world metadata from level.dat
 * Returns a structured object safe for JSON serialization
 */
async function getLevelDatFields(containerName) {
  const { levelDatPath, worldName } = getLevelDatPath(containerName)
  if (!fs.existsSync(levelDatPath)) {
    throw new Error('level.dat no encontrado. El servidor debe iniciarse al menos una vez.')
  }

  const { parsed } = await parseLevelDat(levelDatPath)

  // Level 3 fields (require restart to take effect)
  const seed        = getNbtValue(parsed, 'RandomSeed')
  const hardcore    = getNbtValue(parsed, 'IsHardcore') === 1
  const gameType    = getNbtValue(parsed, 'GameType') ?? 0
  const levelName   = getNbtValue(parsed, 'LevelName') ?? worldName
  const loadedInCr  = getNbtValue(parsed, 'hasBeenLoadedInCreative') === 1
  const difficulty  = getNbtValue(parsed, 'Difficulty') ?? 2
  const commandsEnabled = getNbtValue(parsed, 'commandsEnabled') === 1
  const cheatsEnabled = getNbtValue(parsed, 'cheatsEnabled') === 1
  const educationFeaturesEnabled = getNbtValue(parsed, 'EducationFeatures') === 1

  // Experiments compound tag
  const experimentsCompound = parsed.value['experiments']
  let experiments = {
    gametest: false,
    upcoming_creator_features: false,
    experimental_creator_cameras: false,
    villager_trades_rebalance: false,
    holiday_creator_features: false,
    data_driven_biomes: false,
    scripting: false
  }
  if (experimentsCompound && experimentsCompound.value) {
    for (const key of Object.keys(experiments)) {
      const tag = experimentsCompound.value[key]
      if (tag) experiments[key] = tag.value === 1
    }
  }

  return {
    worldName,
    seed,
    hardcore,
    gameType,
    gameTypeLabel: GAME_TYPE_MAP[gameType] ?? 'Survival',
    levelName,
    loadedInCreative: loadedInCr,
    difficulty,
    difficultyLabel: DIFFICULTY_MAP[difficulty] ?? 'Normal',
    commandsEnabled,
    cheatsEnabled,
    educationFeaturesEnabled,
    experiments
  }
}

/**
 * Save a subset of level.dat fields (Level 3 — requires server offline)
 * Only updates fields explicitly provided in the `fields` object.
 */
async function saveLevelDatFields(containerName, fields) {
  const { levelDatPath } = getLevelDatPath(containerName)
  if (!fs.existsSync(levelDatPath)) {
    throw new Error('level.dat no encontrado.')
  }

  const { header, parsed } = await parseLevelDat(levelDatPath)

  const allowedFields = ['IsHardcore', 'GameType', 'LevelName', 'Difficulty', 'commandsEnabled', 'cheatsEnabled', 'EducationFeatures']

  for (const [key, value] of Object.entries(fields)) {
    if (!allowedFields.includes(key)) continue
    
    // Inject if missing from the parsed level.dat NBT
    if (!parsed.value[key]) {
      const isByte = ['IsHardcore', 'commandsEnabled', 'cheatsEnabled', 'EducationFeatures'].includes(key)
      const isInt = ['GameType', 'Difficulty'].includes(key)
      const isString = ['LevelName'].includes(key)
      parsed.value[key] = {
        type: isByte ? 'byte' : isInt ? 'int' : 'string',
        value: isByte ? 0 : isInt ? 0 : ''
      }
    }

    const type = parsed.value[key].type
    if (type === 'byte') {
      parsed.value[key] = { type: 'byte', value: value ? 1 : 0 }
    } else if (type === 'int') {
      parsed.value[key] = { type: 'int', value: parseInt(value) }
    } else if (type === 'string') {
      parsed.value[key] = { type: 'string', value: String(value) }
    }
  }

  await writeLevelDat(levelDatPath, header, parsed)
  return true
}

/**
 * Save experiments compound tag in level.dat (Level 3 — requires server offline)
 */
async function saveExperiments(containerName, experiments) {
  const { levelDatPath } = getLevelDatPath(containerName)
  if (!fs.existsSync(levelDatPath)) {
    throw new Error('level.dat no encontrado.')
  }

  const { header, parsed } = await parseLevelDat(levelDatPath)

  const validKeys = [
    'gametest',
    'upcoming_creator_features',
    'experimental_creator_cameras',
    'villager_trades_rebalance',
    'holiday_creator_features',
    'data_driven_biomes',
    'scripting'
  ]

  // Ensure experiments compound exists
  if (!parsed.value['experiments']) {
    parsed.value['experiments'] = { type: 'compound', value: {} }
  }

  for (const key of validKeys) {
    if (key in experiments) {
      parsed.value['experiments'].value[key] = {
        type: 'byte',
        value: experiments[key] ? 1 : 0
      }
    }
  }

  // Add required experiments_known_gametests byte if not present
  if (!parsed.value['experiments'].value['experiments_known_gametests']) {
    parsed.value['experiments'].value['experiments_known_gametests'] = { type: 'byte', value: 0 }
  }

  await writeLevelDat(levelDatPath, header, parsed)
  return true
}

module.exports = {
  getLevelDatPath,
  getLevelDatFields,
  saveLevelDatFields,
  saveExperiments
}
