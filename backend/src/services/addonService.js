// backend/src/services/addonService.js
// Handles Minecraft Bedrock Add-on installation, listing, activation and removal.
// Supports .mcpack, .mcaddon and .zip formats (all are ZIP archives internally).

const fs   = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)
const { getInstanceDataPath } = require('./gameFileService.js')

/**
 * Returns the name of the first world folder found in /worlds/
 */
async function getActiveWorldName(containerName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')
  const worldsDir = path.join(basePath, 'worlds')
  if (!fs.existsSync(worldsDir)) return null
  const entries = fs.readdirSync(worldsDir, { withFileTypes: true })
  const worldFolder = entries.find(e => e.isDirectory())
  return worldFolder ? worldFolder.name : null
}

/**
 * Checks if a string looks like a localization key (e.g. "pack.name", "resourcePack.editor.server.name")
 * rather than a real human-readable name.
 * Heuristic: contains at least one dot, no spaces, no numbers at start.
 */
function isLocalizationKey(str) {
  if (!str) return false
  return /^[a-zA-Z][a-zA-Z0-9_.]+$/.test(str) && str.includes('.')
}

/**
 * Try to resolve a localization key from the lang files in the pack directory.
 * Checks texts/en_US.lang, texts/en.lang in priority order.
 * Returns the resolved string or the original key if not found.
 */
function resolveFromLang(dirPath, key) {
  const langFiles = [
    path.join(dirPath, 'texts', 'en_US.lang'),
    path.join(dirPath, 'texts', 'en.lang'),
    path.join(dirPath, 'texts', 'en_GB.lang')
  ]
  for (const langFile of langFiles) {
    if (!fs.existsSync(langFile)) continue
    try {
      const lines = fs.readFileSync(langFile, 'utf8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const eqIdx = trimmed.indexOf('=')
        const k = trimmed.substring(0, eqIdx).trim()
        const v = trimmed.substring(eqIdx + 1).trim()
        if (k === key && v) return v
      }
    } catch (_) {}
  }
  return null
}

/**
 * Reads manifest.json from a directory and returns its relevant fields.
 * Returns null if manifest is missing or malformed.
 */
function readManifest(dirPath) {
  const manifestPath = path.join(dirPath, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = JSON.parse(raw)
    const header = manifest.header
    if (!header || !header.uuid) return null

    // Determine pack type from modules array
    const modules = manifest.modules || []
    let packType = 'unknown'
    for (const mod of modules) {
      const t = (mod.type || '').toLowerCase()
      if (t === 'data' || t === 'script') { packType = 'behavior'; break }
      if (t === 'resources' || t === 'client_data') { packType = 'resource'; break }
    }

    // Resolve localization keys if name/description look like keys (e.g. "pack.name")
    let name = header.name || 'Unnamed Pack'
    let description = header.description || ''

    if (isLocalizationKey(name)) {
      name = resolveFromLang(dirPath, name) || name
    }
    if (isLocalizationKey(description)) {
      description = resolveFromLang(dirPath, description) || description
    }

    return {
      uuid: header.uuid,
      name,
      description,
      version: header.version || [1, 0, 0],
      packType,
      hasScripts: modules.some(m => (m.type || '').toLowerCase() === 'script')
    }
  } catch (_) {
    return null
  }
}

/**
 * Recursively searches for manifest.json files inside a directory.
 * Returns an array of { dirPath, manifest } pairs.
 */
function findManifests(rootDir, depth = 0) {
  if (depth > 4) return []
  const results = []
  const manifest = readManifest(rootDir)
  if (manifest) {
    results.push({ dirPath: rootDir, manifest })
    return results // Don't recurse further once a manifest is found at this level
  }
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push(...findManifests(path.join(rootDir, entry.name), depth + 1))
      }
    }
  } catch (_) {}
  return results
}

/**
 * Read the world pack JSON registration files.
 * packType: 'behavior' | 'resource'
 */
function readWorldPackJson(worldPath, packType) {
  const filename = packType === 'behavior'
    ? 'world_behavior_packs.json'
    : 'world_resource_packs.json'
  const filePath = path.join(worldPath, filename)
  if (!fs.existsSync(filePath)) return []
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (_) {
    return []
  }
}

/**
 * Write the world pack JSON registration files.
 */
function writeWorldPackJson(worldPath, packType, entries) {
  const filename = packType === 'behavior'
    ? 'world_behavior_packs.json'
    : 'world_resource_packs.json'
  const filePath = path.join(worldPath, filename)
  fs.mkdirSync(worldPath, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8')
}

/**
 * Check if a pack UUID is registered in the world
 */
function isPackActiveInWorld(worldPath, packType, uuid) {
  const entries = readWorldPackJson(worldPath, packType)
  return entries.some(e => e.pack_id === uuid)
}

// Verifica si una carpeta pertenece a los packs por defecto (Vanilla/Experimiental) del juego
function isVanillaPack(folderName) {
  const lower = folderName.toLowerCase()
  if (lower === 'vanilla' || lower.startsWith('vanilla_')) return true
  if (lower === 'chemistry' || lower.startsWith('chemistry_')) return true
  if (lower === 'editor' || lower.includes('editor')) return true
  if (lower.startsWith('@minecraft')) return true
  if (lower.includes('experimental')) return true
  if (lower.startsWith('preview_') || lower.endsWith('_preview')) return true
  if (lower.includes('_library') || lower === 'server_library') return true
  if (lower.startsWith('test_')) return true
  if (lower === 'villager_trade_rebalancing') return true
  return false
}

/**
 * List all installed addons from behavior_packs/ and resource_packs/
 * Returns array of addon objects with their activation status.
 */
async function listInstalledAddons(containerName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const worldName = await getActiveWorldName(containerName)
  const worldPath = worldName
    ? path.join(basePath, 'worlds', worldName)
    : null

  const addons = []

  for (const packType of ['behavior', 'resource']) {
    const folderName = packType === 'behavior' ? 'behavior_packs' : 'resource_packs'
    const packsDir = path.join(basePath, folderName)
    if (!fs.existsSync(packsDir)) continue

    const entries = fs.readdirSync(packsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (isVanillaPack(entry.name)) continue
      const packDir = path.join(packsDir, entry.name)
      const manifest = readManifest(packDir)
      if (!manifest) continue

      const active = worldPath
        ? isPackActiveInWorld(worldPath, packType, manifest.uuid)
        : false

      addons.push({
        folderName: entry.name,
        packType,
        active,
        requiresBetaApi: manifest.hasScripts,
        ...manifest
      })
    }
  }

  return addons
}

/**
 * Recursively extract any nested .mcpack / .mcaddon / .zip files found inside a directory.
 * Some .mcaddon files are "meta-packages" containing other compressed packs inside them.
 * This runs up to 3 levels of nested extraction.
 * To avoid encoding or shell-escaping issues with special characters (like ❀ or §),
 * nested files are renamed to safe alphanumeric names before running unzip.
 */
async function extractNestedArchives(dir, depth = 0) {
  if (depth > 3) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (_) { return }

  let index = 0
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await extractNestedArchives(fullPath, depth + 1)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (['.mcpack', '.mcaddon', '.zip'].includes(ext)) {
        // Use a safe alphanumeric name to avoid character encoding issues in unzip / shell
        const safeFileName = `nested_${depth}_${index++}_${Date.now()}${ext}`
        const safeFullPath = path.join(dir, safeFileName)
        try {
          fs.renameSync(fullPath, safeFullPath)
        } catch (renameErr) {
          console.error('[Addon Extraction] Failed to rename nested pack:', renameErr)
          continue
        }

        const subDir = safeFullPath + '_extracted'
        fs.mkdirSync(subDir, { recursive: true })
        try {
          await execPromise(`unzip -o "${safeFullPath}" -d "${subDir}"`)
          // Recurse into the newly extracted folder
          await extractNestedArchives(subDir, depth + 1)
        } catch (err) {
          console.error('[Addon Extraction] Failed to unzip nested pack:', err)
          // If extraction fails, remove the empty subdir and continue
          try {
            fs.rmSync(subDir, { recursive: true, force: true })
          } catch (_) {}
        }
      }
    }
  }
}

/**
 * Install an addon from a temp file path.
 * Handles .mcpack, .mcaddon, .zip and double-compressed .mcaddon packages automatically.
 * Returns array of installed { manifest, packType, destFolder } objects.
 */
async function installAddon(containerName, tempFilePath, originalName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  // Create temp extraction directory
  const tempExtractDir = path.join('/tmp', `moonpanel_addon_${Date.now()}`)
  fs.mkdirSync(tempExtractDir, { recursive: true })

  try {
    // Step 1: Extract the top-level archive
    await execPromise(`unzip -o "${tempFilePath}" -d "${tempExtractDir}"`)

    // Step 2: Recursively extract any nested .mcpack/.mcaddon/.zip files
    await extractNestedArchives(tempExtractDir)

    // Step 3: Find all manifest.json files recursively across the whole tree
    const found = findManifests(tempExtractDir)
    if (found.length === 0) {
      throw new Error(
        'No se encontro ningun manifest.json valido en el archivo subido. ' +
        'Verifica que sea un add-on valido de Minecraft Bedrock.'
      )
    }

    const installed = []

    for (const { dirPath, manifest } of found) {
      const { packType } = manifest
      if (packType === 'unknown') continue

      const destFolder = packType === 'behavior' ? 'behavior_packs' : 'resource_packs'
      const destDir = path.join(basePath, destFolder)
      fs.mkdirSync(destDir, { recursive: true })

      // Use a sanitized folder name based on pack name + uuid fragment
      const safeName = (manifest.name || 'pack')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 32)
      const finalFolderName = `${safeName}_${manifest.uuid.substring(0, 8)}`
      const destPackDir = path.join(destDir, finalFolderName)

      // Copy the pack directory recursively using native Node.js recursive copy
      fs.cpSync(dirPath, destPackDir, { recursive: true })

      installed.push({
        manifest,
        packType,
        folderName: finalFolderName,
        destDir: destPackDir
      })
    }

    return installed
  } finally {
    // Clean up temp files safely using fs.rmSync
    try {
      fs.rmSync(tempExtractDir, { recursive: true, force: true })
    } catch (_) {}
    try {
      fs.rmSync(tempFilePath, { force: true })
    } catch (_) {}
  }
}

/**
 * Activate a pack in the active world (add to world_X_packs.json)
 */
async function activateAddonInWorld(containerName, uuid, version, packType) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const worldName = await getActiveWorldName(containerName)
  if (!worldName) throw new Error('No se encontro ningun mundo activo.')

  const worldPath = path.join(basePath, 'worlds', worldName)
  const entries = readWorldPackJson(worldPath, packType)

  // Avoid duplicates
  if (!entries.some(e => e.pack_id === uuid)) {
    entries.push({ pack_id: uuid, version })
    writeWorldPackJson(worldPath, packType, entries)
  }
  return true
}

/**
 * Deactivate a pack from the active world (remove from world_X_packs.json)
 */
async function deactivateAddonInWorld(containerName, uuid, packType) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const worldName = await getActiveWorldName(containerName)
  if (!worldName) throw new Error('No se encontro ningun mundo activo.')

  const worldPath = path.join(basePath, 'worlds', worldName)
  const entries = readWorldPackJson(worldPath, packType)
  const filtered = entries.filter(e => e.pack_id !== uuid)
  writeWorldPackJson(worldPath, packType, filtered)
  return true
}

/**
 * Fully uninstall an addon: deactivate from world + delete the pack folder.
 * Atomic two-step operation to prevent server errors on next boot.
 */
async function uninstallAddon(containerName, folderName, uuid, packType) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  // Step 1: Remove from world JSON
  try {
    await deactivateAddonInWorld(containerName, uuid, packType)
  } catch (_) {
    // World may not exist yet; continue with folder deletion
  }

  // Step 2: Remove folder
  const destFolder = packType === 'behavior' ? 'behavior_packs' : 'resource_packs'
  const packDir = path.join(basePath, destFolder, folderName)
  if (fs.existsSync(packDir)) {
    fs.rmSync(packDir, { recursive: true, force: true })
  }

  return true
}

module.exports = {
  getActiveWorldName,
  listInstalledAddons,
  installAddon,
  activateAddonInWorld,
  deactivateAddonInWorld,
  uninstallAddon
}
