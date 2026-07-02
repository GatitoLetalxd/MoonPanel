// backend/src/services/gameFileService.js
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

function getInstanceDataPath(containerName) {
  if (containerName === 'moondev-valheim') return '/opt/gameservers/valheim/data'
  if (containerName === 'moondev-mc-1') return '/opt/gameservers/mc1/data'
  if (containerName === 'moondev-mc-2') return '/opt/gameservers/mc2/data'
  return null
}

function getSecurePath(basePath, relativePath) {
  if (!basePath) return null
  const cleanPath = path.normalize(relativePath || '').replace(/^(\.\.(\/|\\|$))+/, '')
  const resolved = path.join(basePath, cleanPath)
  if (resolved.startsWith(basePath)) {
    return resolved
  }
  return null
}

async function listFiles(containerName, relPath) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const targetPath = getSecurePath(basePath, relPath)
  if (!targetPath || !fs.existsSync(targetPath)) {
    throw new Error('Ruta no encontrada o no autorizada')
  }

  const stat = fs.statSync(targetPath)
  if (!stat.isDirectory()) {
    throw new Error('La ruta especificada no es un directorio')
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true })
  
  // Lista de archivos/carpetas excluidos
  const excluded = [
    '.tmp',
    'premium_cache',
    'behavior_packs',
    'resource_packs',
    'definitions',
    'development_behavior_packs',
    'development_resource_packs',
    'development_skin_packs',
    'world_templates',
    'treatments'
  ]

  const result = []
  for (const entry of entries) {
    const name = entry.name
    // Excluir binarios de bedrock y archivos ocultos/excluidos
    if (name.startsWith('.') || name.startsWith('bedrock_server') || excluded.includes(name)) {
      continue
    }

    const filePath = path.join(targetPath, name)
    let size = 0
    let isDir = entry.isDirectory()

    if (!isDir) {
      try {
        const fstat = fs.statSync(filePath)
        size = fstat.size
      } catch (e) {
        // Ignorar errores de stat
      }
    }

    result.push({
      name,
      isDir,
      size,
      relativePath: path.relative(basePath, filePath)
    })
  }

  // Ordenar directorios primero, luego archivos
  return result.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1
    if (!a.isDir && b.isDir) return 1
    return a.name.localeCompare(b.name)
  })
}

async function getFileContent(containerName, relPath) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const targetPath = getSecurePath(basePath, relPath)
  if (!targetPath || !fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    throw new Error('Archivo no encontrado o no autorizado')
  }

  const ext = path.extname(targetPath).toLowerCase()
  const allowedExtensions = ['.properties', '.json', '.txt', '.wlist', '.cfg', '.conf', '.yml', '.yaml', '.ini']
  
  if (!allowedExtensions.includes(ext) && path.basename(targetPath) !== 'server.properties') {
    throw new Error('Extensión de archivo no permitida para lectura')
  }

  // Comprobar tamaño (máximo 5MB para editar en web)
  const size = fs.statSync(targetPath).size
  if (size > 5 * 1024 * 1024) {
    throw new Error('El archivo es demasiado grande para editarse en línea')
  }

  return fs.readFileSync(targetPath, 'utf8')
}

async function saveFileContent(containerName, relPath, content) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const targetPath = getSecurePath(basePath, relPath)
  if (!targetPath) {
    throw new Error('Ruta no autorizada')
  }

  const ext = path.extname(targetPath).toLowerCase()
  const allowedExtensions = ['.properties', '.json', '.txt', '.wlist', '.cfg', '.conf', '.yml', '.yaml', '.ini']
  
  if (!allowedExtensions.includes(ext) && path.basename(targetPath) !== 'server.properties') {
    throw new Error('Extensión de archivo no permitida para guardar')
  }

  fs.writeFileSync(targetPath, content, 'utf8')
  return true
}

async function compressWorld(containerName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const worldsPath = path.join(basePath, 'worlds')
  if (!fs.existsSync(worldsPath)) {
    throw new Error('El directorio worlds no existe. Inicie el servidor al menos una vez.')
  }

  const tempDir = '/tmp/moonpanel_zip'
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const zipFilename = `world_${containerName}_${Date.now()}.zip`
  const zipDest = path.join(tempDir, zipFilename)

  // Comprimir el directorio worlds usando zip del sistema
  // Entramos a basePath para que el zip contenga "worlds/..." en lugar de rutas absolutas
  await execPromise(`cd "${basePath}" && zip -r "${zipDest}" worlds`)
  
  return zipDest
}

async function extractWorldZip(containerName, zipFilePath) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')

  const worldsPath = path.join(basePath, 'worlds')

  // Limpiar carpeta anterior
  if (fs.existsSync(worldsPath)) {
    await execPromise(`rm -rf "${worldsPath}"`)
  }

  // Asegurar que el directorio base de datos existe
  fs.mkdirSync(basePath, { recursive: true })

  // Descomprimir en el directorio base (esto creará la carpeta "worlds/")
  await execPromise(`unzip -o "${zipFilePath}" -d "${basePath}"`)

  // Asegurar que exista la carpeta worlds si por algún motivo no estaba en la raíz del ZIP
  if (!fs.existsSync(worldsPath)) {
    fs.mkdirSync(worldsPath, { recursive: true })
  }

  return true
}

function parseProperties(content) {
  const props = {}
  const lines = content.split('\n')
  for (let line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim()
      const val = trimmed.substring(idx + 1).trim()
      props[key] = val
    }
  }
  return props
}

function updateProperties(content, newProps) {
  const lines = content.split('\n')
  const keysToUpdate = { ...newProps }
  const resultLines = []

  for (let line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      resultLines.push(line)
      continue
    }

    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim()
      if (keysToUpdate.hasOwnProperty(key)) {
        resultLines.push(`${key}=${keysToUpdate[key]}`)
        delete keysToUpdate[key]
      } else {
        resultLines.push(line)
      }
    } else {
      resultLines.push(line)
    }
  }

  for (const [key, value] of Object.entries(keysToUpdate)) {
    resultLines.push(`${key}=${value}`)
  }

  return resultLines.join('\n')
}

async function getProperties(containerName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')
  const propPath = path.join(basePath, 'server.properties')
  if (!fs.existsSync(propPath)) {
    throw new Error('Archivo server.properties no encontrado')
  }
  const content = fs.readFileSync(propPath, 'utf8')
  return parseProperties(content)
}

async function saveProperties(containerName, newProps) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')
  const propPath = path.join(basePath, 'server.properties')
  if (!fs.existsSync(propPath)) {
    throw new Error('Archivo server.properties no encontrado')
  }
  const content = fs.readFileSync(propPath, 'utf8')
  const updatedContent = updateProperties(content, newProps)
  fs.writeFileSync(propPath, updatedContent, 'utf8')
  return true
}

async function getGamerules(containerName) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')
  const rulesPath = path.join(basePath, 'gamerules.json')
  if (!fs.existsSync(rulesPath)) {
    return {}
  }
  const content = fs.readFileSync(rulesPath, 'utf8')
  try {
    return JSON.parse(content)
  } catch (e) {
    return {}
  }
}

async function saveGamerules(containerName, rules) {
  const basePath = getInstanceDataPath(containerName)
  if (!basePath) throw new Error('Contenedor no soportado')
  const rulesPath = path.join(basePath, 'gamerules.json')
  fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2), 'utf8')
  return true
}

module.exports = {
  getInstanceDataPath,
  listFiles,
  getFileContent,
  saveFileContent,
  compressWorld,
  extractWorldZip,
  getProperties,
  saveProperties,
  getGamerules,
  saveGamerules
}
