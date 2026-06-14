const fs = require('fs')
const path = require('path')

const COMPOSE_PATH = '/opt/gameservers/docker-compose.yml'

function getServiceName(containerName) {
  if (containerName === 'moondev-valheim') return 'valheim'
  if (containerName === 'moondev-mc-1') return 'minecraft-1'
  if (containerName === 'moondev-mc-2') return 'minecraft-2'
  return null
}

function getGameConfig(containerName) {
  if (!fs.existsSync(COMPOSE_PATH)) return {}
  const content = fs.readFileSync(COMPOSE_PATH, 'utf8')
  const lines = content.split('\n')
  const service = getServiceName(containerName)
  if (!service) return {}

  let inService = false
  let inEnv = false
  const config = {}

  for (let line of lines) {
    const trimmed = line.trim()
    if (line.startsWith(`  ${service}:`)) {
      inService = true
      inEnv = false
      continue
    }
    if (inService && line.length > 0 && !line.startsWith('   ') && !line.startsWith(`  ${service}:`)) {
      inService = false
      inEnv = false
    }

    if (inService) {
      if (trimmed === 'environment:') {
        inEnv = true
        continue
      }
      if (inEnv) {
        if (line.startsWith('      ')) {
          const idx = trimmed.indexOf(':')
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim()
            let val = trimmed.substring(idx + 1).trim()
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1)
            } else if (val.startsWith("'") && val.endsWith("'")) {
              val = val.substring(1, val.length - 1)
            }
            config[key] = val
          }
        } else {
          inEnv = false
        }
      }
    }
  }

  return config
}

function updateGameConfig(containerName, newConfig) {
  if (!fs.existsSync(COMPOSE_PATH)) {
    throw new Error('Archivo docker-compose.yml no encontrado')
  }
  const content = fs.readFileSync(COMPOSE_PATH, 'utf8')
  const lines = content.split('\n')
  const service = getServiceName(containerName)
  if (!service) throw new Error('Servicio de contenedor desconocido')

  let inService = false
  let inEnv = false
  const newLines = []
  let envInserted = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (line.startsWith(`  ${service}:`)) {
      inService = true
      inEnv = false
      newLines.push(line)
      continue
    }

    if (inService && line.length > 0 && !line.startsWith('   ') && !line.startsWith(`  ${service}:`)) {
      inService = false
      inEnv = false
    }

    if (inService) {
      if (trimmed === 'environment:') {
        inEnv = true
        newLines.push(line)
        // Escribir las nuevas variables
        for (const [key, value] of Object.entries(newConfig)) {
          newLines.push(`      ${key}: "${value}"`)
        }
        envInserted = true
        continue
      }

      if (inEnv) {
        if (line.startsWith('      ')) {
          continue // omitir antiguas
        } else {
          inEnv = false
        }
      }
    }

    newLines.push(line)
  }

  fs.writeFileSync(COMPOSE_PATH, newLines.join('\n'), 'utf8')
}

module.exports = {
  getGameConfig,
  updateGameConfig,
  getServiceName
}
