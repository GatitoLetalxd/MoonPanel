// backend/src/routes/game.routes.js
const { Router } = require('express')
const authMiddleware = require('../middleware/auth.js')
const prisma = require('../lib/prisma.js')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const { resetGameTracker } = require('../services/gameScheduler.js')
const { queryPlayers, queryMinecraftBedrockDetails, queryValheimDetails } = require('../services/playerQueryService.js')
const { getGameConfig, updateGameConfig, getServiceName } = require('../services/gameConfigService.js')
const { getStats } = require('../services/dockerService.js')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)
const multer = require('multer')
const {
  listFiles,
  getFileContent,
  saveFileContent,
  compressWorld,
  extractWorldZip,
  getProperties,
  saveProperties,
  getInstanceDataPath,
  getGamerules,
  saveGamerules
} = require('../services/gameFileService.js')
const { getLevelDatFields, saveLevelDatFields, saveExperiments } = require('../services/levelDatService.js')
const { listInstalledAddons, installAddon, activateAddonInWorld, deactivateAddonInWorld, uninstallAddon } = require('../services/addonService.js')

// Reglas de juego por defecto oficiales estilo Aternos (Minecraft Bedrock)
const DEFAULT_GAMERULES = {
  commandblockoutput: true,
  commandblocksenabled: true,
  dodaylightcycle: true,
  doentitydrops: true,
  dofiretick: true,
  doimmediaterespawn: false,
  doinsomnia: true,
  domobloot: true,
  domobspawning: true,
  dotiledrops: true,
  doweathercycle: true,
  drowningdamage: true,
  falldamage: true,
  firedamage: true,
  freezedamage: true,
  functioncommandlimit: 10000,
  keepinventory: false,
  maxcommandchainlength: 65535,
  mobgriefing: true,
  naturalregeneration: true,
  playerssleepingpercentage: 100,
  playerwaypoints: 'everyone',
  pvp: true,
  randomtickspeed: 1,
  recipesunlock: true,
  respawnblocksexplode: true,
  sendcommandfeedback: true,
  showcoordinates: false,
  showdaysplayed: false,
  showdeathmessages: true,
  showtags: true,
  spawnradius: 10,
  tntexplodes: true,
  tntexplosiondropdecay: false
}

// Multer: store addon uploads in /tmp
const addonUpload = multer({
  dest: '/tmp/moonpanel_addons/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max per addon file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.mcpack', '.mcaddon', '.zip'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Formato no permitido. Solo se aceptan .mcpack, .mcaddon y .zip'))
    }
  }
})

function parseValheimServerArgs(argsStr) {
  const modifiers = {
    preset: 'default',
    combat: 'normal',
    deathpenalty: 'normal',
    resources: 'normal',
    raids: 'normal',
    portals: 'normal',
    nobuildcost: false,
    playerevents: false,
    firehazards: false,
    passivemobs: false,
    nomap: false,
    _extraArgs: []
  }

  if (!argsStr) return modifiers

  const tokens = argsStr.split(/\s+/)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '-preset' && i + 1 < tokens.length) {
      modifiers.preset = tokens[i + 1]
      i++
    } else if (token === '-modifier' && i + 2 < tokens.length) {
      const category = tokens[i + 1]
      const value = tokens[i + 2]
      if (category in modifiers) {
        modifiers[category] = value
      } else {
        modifiers._extraArgs.push(token, category, value)
      }
      i += 2
    } else if (token === '-setkey' && i + 1 < tokens.length) {
      const key = tokens[i + 1]
      if (key === 'nobuildcost') modifiers.nobuildcost = true
      else if (key === 'playerevents') modifiers.playerevents = true
      else if (key === 'firehazards') modifiers.firehazards = true
      else if (key === 'passivemobs') modifiers.passivemobs = true
      else if (key === 'nomap') modifiers.nomap = true
      else modifiers._extraArgs.push(token, key)
      i++
    } else if (token) {
      modifiers._extraArgs.push(token)
    }
  }

  return modifiers
}

function compileValheimServerArgs(body) {
  const args = []

  if (body.preset && body.preset !== 'default') {
    args.push(`-preset ${body.preset}`)
  }

  const categories = ['combat', 'deathpenalty', 'resources', 'raids', 'portals']
  for (const cat of categories) {
    if (body[cat] && body[cat] !== 'normal') {
      args.push(`-modifier ${cat} ${body[cat]}`)
    }
  }

  if (body.nobuildcost === true || body.nobuildcost === 'true') args.push('-setkey nobuildcost')
  if (body.playerevents === true || body.playerevents === 'true') args.push('-setkey playerevents')
  if (body.firehazards === true || body.firehazards === 'true') args.push('-setkey firehazards')
  if (body.passivemobs === true || body.passivemobs === 'true') args.push('-setkey passivemobs')
  if (body.nomap === true || body.nomap === 'true') args.push('-setkey nomap')

  if (body._extraArgs && Array.isArray(body._extraArgs)) {
    args.push(...body._extraArgs)
  } else if (typeof body._extraArgs === 'string' && body._extraArgs.trim()) {
    args.push(body._extraArgs)
  }

  return args.join(' ')
}

const router = Router()

// ── GET /api/game/instances ─────────────────────────────────────────────────
router.get('/instances', authMiddleware, async (req, res) => {
  try {
    const gameType = (req.gameType && req.gameType !== 'admin')
      ? req.gameType
      : null

    const access = await prisma.userGameAccess.findMany({
      where: { userId: req.user.id },
      include: {
        gameInstance: true
      }
    })

    const instances = await Promise.all(
      access
        .filter(a => {
          const inst = a.gameInstance
          if (!inst) return false
          if (inst.status === 'pending') return false
          if (gameType && inst.gameType !== gameType) return false
          return true
        })
        .map(async a => {
          const inst = a.gameInstance
          let playersConnected = 0
          let runningVersion = null
          if (inst.status === 'online') {
            if (inst.gameType === 'minecraft') {
              const query = await queryMinecraftBedrockDetails('localhost', inst.queryPort)
              playersConnected = query.players >= 0 ? query.players : 0
              runningVersion = query.version
            } else {
              const p = await queryPlayers(inst.gameType, inst.queryPort, inst.containerId)
              playersConnected = p >= 0 ? p : 0
            }
          }
          return {
            ...inst,
            userRole: a.role,
            playersConnected,
            runningVersion
          }
        })
    )

    res.json(instances)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/start ──────────────────────────────────────
router.post('/instances/:id/start', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })

    if (!access) return res.status(403).json({ error: 'Sin acceso a esta instancia' })

    const instance = access.gameInstance

    if (instance.status === 'pending') {
      return res.status(403).json({ error: 'Esta instancia aún no ha sido activada por el administrador' })
    }
    if (instance.status === 'online') {
      return res.status(400).json({ error: 'El servidor ya está online' })
    }
    if (['starting', 'stopping'].includes(instance.status)) {
      return res.status(400).json({ error: 'El servidor está en transición, espera un momento' })
    }

    // Sincronizar dificultad y modo de juego de server.properties a level.dat antes de iniciar
    if (instance.gameType === 'minecraft') {
      await syncSettingsPropertiesToLevelDat(instance.containerName)
    }

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'starting' }
    })

    const container = docker.getContainer(instance.containerId)
    await container.start()
    resetGameTracker(instanceId)

    // Marcar online tras gracia de arranque (fallback por si falla la lectura de logs)
    setTimeout(async () => {
      const current = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
      if (current && current.status === 'starting') {
        await prisma.gameInstance.update({
          where: { id: instanceId },
          data: { status: 'online' }
        })
        if (instance.gameType === 'minecraft') {
          applyStartupGamerules(instance)
        }
      }
    }, 60_000)

    res.json({ message: 'Servidor iniciando…', status: 'starting' })
  } catch (err) {
    await prisma.gameInstance.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'offline' }
    }).catch(() => {})
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/stop ───────────────────────────────────────
router.post('/instances/:id/stop', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })

    if (!access) return res.status(403).json({ error: 'Sin acceso a esta instancia' })

    const instance = access.gameInstance

    if (instance.status !== 'online') {
      return res.status(400).json({ error: 'El servidor no está online' })
    }

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'stopping' }
    })

    const container = docker.getContainer(instance.containerId)
    
    // Si es Minecraft, enviar comando stop primero para un apagado limpio
    if (instance.gameType === 'minecraft') {
      try {
        const execObj = await container.exec({
          Cmd: ['send-command', 'stop'],
          AttachStdout: false,
          AttachStderr: false
        })
        await execObj.start({ hijack: true, stdin: false })
        let isStopped = false
        for (let i = 0; i < 10; i++) {
          const inspect = await container.inspect()
          if (!inspect.State.Running) {
            isStopped = true
            break
          }
          await new Promise(r => setTimeout(r, 500))
        }
        if (!isStopped) {
          await container.stop().catch(() => {})
        }
      } catch (err) {
        console.error('[MC Stop] Error graceful stop:', err.message)
        await container.stop().catch(() => {})
      }
    } else {
      await container.stop().catch(() => {})
    }

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'offline' }
    })

    res.json({ message: 'Servidor detenido', status: 'offline' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/restart ────────────────────────────────────
router.post('/instances/:id/restart', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })

    if (!access) return res.status(403).json({ error: 'Sin acceso a esta instancia' })

    if (access.gameInstance.status !== 'online') {
      return res.status(400).json({ error: 'Solo se puede reiniciar un servidor online' })
    }

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'stopping' }
    })

    const container = docker.getContainer(access.gameInstance.containerId)
    
    // Si es Minecraft, enviar comando stop primero para un apagado limpio
    if (access.gameInstance.gameType === 'minecraft') {
      try {
        const execObj = await container.exec({
          Cmd: ['send-command', 'stop'],
          AttachStdout: false,
          AttachStderr: false
        })
        await execObj.start({ hijack: true, stdin: false })
        let isStopped = false
        for (let i = 0; i < 10; i++) {
          const inspect = await container.inspect()
          if (!inspect.State.Running) {
            isStopped = true
            break
          }
          await new Promise(r => setTimeout(r, 500))
        }
        if (!isStopped) {
          await container.stop().catch(() => {})
        }
      } catch (err) {
        console.error('[MC Restart] Error graceful stop:', err.message)
        await container.stop().catch(() => {})
      }
    } else {
      await container.stop().catch(() => {})
    }

    resetGameTracker(instanceId)

    // Sincronizar dificultad y modo de juego de server.properties a level.dat antes de iniciar de nuevo
    if (access.gameInstance.gameType === 'minecraft') {
      await syncSettingsPropertiesToLevelDat(access.gameInstance.containerName)
    }

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'starting' }
    })

    await container.start()

    if (access.gameInstance.gameType === 'minecraft') {
      setTimeout(() => {
        applyStartupGamerules(access.gameInstance)
      }, 15_000)
    }

    res.json({ message: 'Servidor reiniciado', status: 'online' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getLoadingMessage(gameType, logs) {
  if (!logs) return null

  const lines = logs.split('\n').reverse()
  
  if (gameType === 'valheim') {
    for (const line of lines) {
      if (line.includes('Update state') || line.includes('downloading')) {
        const match = line.match(/progress:\s*([\d.]+)/)
        const progress = match ? ` (${parseFloat(match[1]).toFixed(1)}%)` : ''
        return `Descargando servidor via SteamCMD${progress}...`
      }
      if (line.includes('Generating locations done')) {
        return 'Finalizando generación de mundo...'
      }
      if (line.includes('Generating locations')) {
        return 'Generando ubicaciones del mapa...'
      }
      if (line.includes('Placed locations')) {
        return 'Colocando bosques y vegetación...'
      }
      if (line.includes('TrollCave')) {
        return 'Colocando cuevas de trolls...'
      }
      if (line.includes('MountainCave')) {
        return 'Colocando cuevas de montaña...'
      }
      if (line.includes('Mistlands')) {
        return 'Colocando estructuras de Mistlands...'
      }
      if (line.includes('TarPit')) {
        return 'Generando pozos de alquitrán...'
      }
      if (line.includes('Crypt') || line.includes('SunkenCrypt')) {
        return 'Colocando criptas ancestrales...'
      }
      if (line.includes('Failed to place all')) {
        return 'Colocando estructuras en el mapa...'
      }
      if (line.includes('ZNET START')) {
        return 'Inicializando motor de red...'
      }
      if (line.includes('Load world')) {
        return 'Cargando archivos del mundo...'
      }
      if (line.includes('Zonesystem Awake') || line.includes('DungeonDB Awake')) {
        return 'Inicializando bases de datos del juego...'
      }
      if (line.includes('Waiting for server to listen') || line.includes('Waiting for server to listen on UDP query port')) {
        return 'Esperando puertos de red...'
      }
    }
  }

  if (gameType === 'minecraft') {
    for (const line of lines) {
      if (line.includes('NO LOG FILE!') || line.includes('Starting Bedrock server')) {
        return 'Iniciando servidor de Bedrock...'
      }
      if (line.includes('Starting Server')) {
        return 'Inicializando servidor de Minecraft...'
      }
      if (line.includes('Version:')) {
        return 'Cargando motor de juego...'
      }
      if (line.includes('Game mode:') || line.includes('Difficulty:')) {
        return 'Cargando configuraciones del mundo...'
      }
      if (line.includes('Opening level')) {
        return 'Cargando archivos del mundo...'
      }
      if (line.includes('IPv4 supported') || line.includes('IPv6 supported')) {
        return 'Configurando puertos de red...'
      }
      if (line.includes('Waiting for Minecraft services')) {
        return 'Esperando servicios de Minecraft...'
      }
      if (line.includes('loading')) {
        return 'Cargando recursos del mundo...'
      }
    }
  }

  return null
}

// ── GET /api/game/instances/:id/status ──────────────────────────────────────
router.get('/instances/:id/status', authMiddleware, async (req, res) => {
  try {
    const instance = await prisma.gameInstance.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (!instance) return res.status(404).json({ error: 'No encontrado' })
    
    let playersConnected = 0
    let runningVersion = null
    if (instance.status === 'online') {
      if (instance.gameType === 'minecraft') {
        const query = await queryMinecraftBedrockDetails('localhost', instance.queryPort)
        playersConnected = query.players >= 0 ? query.players : 0
        runningVersion = query.version
      } else if (instance.gameType === 'valheim') {
        const query = await queryValheimDetails('localhost', instance.queryPort, instance.containerId)
        playersConnected = query.players >= 0 ? query.players : 0
        runningVersion = query.version
      } else {
        const p = await queryPlayers(instance.gameType, instance.queryPort, instance.containerId)
        playersConnected = p >= 0 ? p : 0
      }
    }

    let realStatus = instance.status
    let loadingMessage = null

    if (instance.status === 'starting' || instance.status === 'online') {
      try {
        const container = docker.getContainer(instance.containerId)
        const state = await container.inspect()
        
        if (!state.State.Running) {
          realStatus = 'offline'
          if (instance.status !== 'offline') {
            await prisma.gameInstance.update({
              where: { id: instance.id },
              data: { status: 'offline' }
            }).catch(() => {})
          }
        } else {
          // Obtener logs de la ejecución actual del contenedor
          const startedAtEpoch = Math.floor(new Date(state.State.StartedAt).getTime() / 1000)
          const logBuffer = await container.logs({
            stdout: true,
            stderr: true,
            since: startedAtEpoch,
            tail: 500,
            timestamps: false
          })
          
          let cleanLogs = ''
          let offset = 0
          while (offset < logBuffer.length) {
            if (offset + 8 > logBuffer.length) break
            const size = logBuffer.readUInt32BE(offset + 4)
            if (offset + 8 + size > logBuffer.length) break
            const chunk = logBuffer.slice(offset + 8, offset + 8 + size).toString('utf8')
            cleanLogs += chunk
            offset += 8 + size
          }
          if (!cleanLogs.trim() && logBuffer.length > 0) {
            cleanLogs = logBuffer.toString('utf8')
          }

          let isOnlineFromLogs = false
          if (instance.gameType === 'valheim') {
            isOnlineFromLogs = cleanLogs.includes('Opened Steam server') || cleanLogs.includes('Game server connected')
          } else if (instance.gameType === 'minecraft') {
            isOnlineFromLogs = cleanLogs.includes('Server started.') || cleanLogs.includes('Server started')
          } else {
            isOnlineFromLogs = true
          }

          if (isOnlineFromLogs || runningVersion) {
            realStatus = 'online'
            if (instance.status === 'starting') {
              await prisma.gameInstance.update({
                where: { id: instance.id },
                data: { status: 'online' }
              }).catch(() => {})
              if (instance.gameType === 'minecraft') {
                applyStartupGamerules(instance)
              }
            }
          } else {
            realStatus = 'starting'
            loadingMessage = getLoadingMessage(instance.gameType, cleanLogs)
          }
        }
      } catch (err) {
        console.error('Error fetching loading state from container logs:', err)
      }
    }

    res.json({
      status: realStatus,
      playersConnected,
      runningVersion,
      loadingMessage
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/stats ───────────────────────────────────────
router.get('/instances/:id/stats', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    const instance = access.gameInstance
    if (instance.status !== 'online') {
      return res.json({ cpu: '0.00', ramUsed: 0, ramLimit: 0, diskUsed: 0 })
    }
    const stats = await getStats(instance.containerId)
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/config ──────────────────────────────────────
router.get('/instances/:id/config', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    const config = getGameConfig(access.gameInstance.containerName)
    if (access.gameInstance.gameType === 'minecraft') {
      if (!config.VERSION) {
        config.VERSION = 'LATEST'
      }
      if (access.gameInstance.containerId) {
        config.currentVersion = await getActualBedrockVersion(access.gameInstance.containerId)
      }
    }
    if (access.gameInstance.gameType === 'valheim') {
      if (!config.VALHEIM_BRANCH) {
        config.VALHEIM_BRANCH = 'public'
      }
      const modifiers = parseValheimServerArgs(config.SERVER_ARGS)
      Object.assign(config, modifiers)
    }
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/config ─────────────────────────────────────
router.post('/instances/:id/config', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede modificar la configuración' })
    }

    const instance = access.gameInstance
    const serviceName = getServiceName(instance.containerName)
    if (!serviceName) return res.status(400).json({ error: 'Contenedor desconocido' })

    const config = getGameConfig(instance.containerName)
    let body = { ...req.body }

    if (instance.gameType === 'valheim') {
      const serverArgs = compileValheimServerArgs(body)
      body.SERVER_ARGS = serverArgs

      const modifiersKeys = [
        'preset', 'combat', 'deathpenalty', 'resources', 'raids', 'portals',
        'nobuildcost', 'playerevents', 'firehazards', 'passivemobs', 'nomap', '_extraArgs'
      ]
      for (const key of modifiersKeys) {
        delete body[key]
      }
    }

    const updatedConfig = { ...config, ...body }

    // EULA y SERVER_PUBLIC deben validarse y evitar cambiar versión si está online
    if (instance.gameType === 'minecraft') {
      if (instance.status === 'online' && body.VERSION && body.VERSION !== config.VERSION) {
        return res.status(400).json({ error: 'Debes apagar el servidor primero antes de cambiar la versión.' })
      }
      updatedConfig.EULA = 'TRUE'
    }

    updateGameConfig(instance.containerName, updatedConfig)

    // Recrear contenedor de forma segura
    const isOnline = instance.status === 'online'
    if (isOnline) {
      await prisma.gameInstance.update({
        where: { id: instanceId },
        data: { status: 'starting' }
      })
      exec(`cd /opt/gameservers && docker compose up -d --force-recreate ${serviceName}`, (err) => {
        if (!err) {
          setTimeout(async () => {
            const current = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
            if (current && current.status === 'starting') {
              await prisma.gameInstance.update({
                where: { id: instanceId },
                data: { status: 'online' }
              })
              if (instance.gameType === 'minecraft') {
                applyStartupGamerules(instance)
              }
            }
          }, 60_000) // Fallback de 60 segundos por si falla la lectura de logs
        } else {
          prisma.gameInstance.update({
            where: { id: instanceId },
            data: { status: 'offline' }
          }).catch(() => {})
        }
      })
    } else {
      await execPromise(`cd /opt/gameservers && docker compose create --force-recreate ${serviceName}`)
    }

    res.json({ message: 'Configuración actualizada y contenedor recreado con éxito.', status: isOnline ? 'starting' : 'offline' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/reset-world ────────────────────────────────
router.post('/instances/:id/reset-world', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })

    if (!access) return res.status(403).json({ error: 'Sin acceso a esta instancia' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede restablecer el mundo' })
    }

    const instance = access.gameInstance
    if (instance.status !== 'offline') {
      return res.status(400).json({ error: 'Detén el servidor antes de resetear el mundo' })
    }

    const worldPaths = {
      valheim:   '/config/worlds_local',
      minecraft: '/data/worlds'
    }

    const container = docker.getContainer(instance.containerId)
    await container.start()

    const execObj = await container.exec({
      Cmd: ['rm', '-rf', worldPaths[instance.gameType]],
      AttachStdout: true,
      AttachStderr: true
    })
    await execObj.start({ hijack: true, stdin: false })
    await new Promise(r => setTimeout(r, 2000))
    await container.stop()

    // Si es Minecraft Bedrock, restablecer también gamerules.json y server.properties a los valores por defecto oficiales
    if (instance.gameType === 'minecraft') {
      try {
        await saveGamerules(instance.containerName, DEFAULT_GAMERULES)
        await saveProperties(instance.containerName, {
          'max-players': '20',
          'gamemode': 'survival',
          'difficulty': 'easy',
          'online-mode': 'true',
          'allow-cheats': 'false',
          'force-gamemode': 'false',
          'texturepack-required': 'false',
          'allow-list': 'false',
          'level-name': 'Mundooo',
          'level-seed': ''
        })
      } catch (saveErr) {
        console.error('[Reset World] Failed to reset defaults:', saveErr.message)
      }
    }

    res.json({ message: 'Mundo restablecido. El servidor generará un mundo nuevo al iniciar.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/backups ─────────────────────────────────────
router.get('/instances/:id/backups', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })

    const backupsDir = `/opt/gameservers/backups/${instanceId}`
    if (!fs.existsSync(backupsDir)) {
      return res.json([])
    }

    const files = fs.readdirSync(backupsDir)
    const backupFiles = files
      .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip'))
      .map(f => {
        const filePath = path.join(backupsDir, f)
        const stat = fs.statSync(filePath)
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.birthtime
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt)

    res.json(backupFiles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/backups ────────────────────────────────────
router.post('/instances/:id/backups', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })

    const instance = access.gameInstance
    const worldPathsOnHost = {
      valheim:   '/opt/gameservers/valheim/data/worlds_local',
      minecraft: instance.containerName === 'moondev-mc-1' ? '/opt/gameservers/mc1/data/worlds' : '/opt/gameservers/mc2/data/worlds'
    }

    const sourceDir = worldPathsOnHost[instance.gameType]
    if (!fs.existsSync(sourceDir)) {
      return res.status(400).json({ error: 'El servidor debe iniciarse al menos una vez para generar el mundo antes de crear un respaldo.' })
    }

    const backupsDir = `/opt/gameservers/backups/${instanceId}`
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    const filename = `backup_${instance.gameType}_${Date.now()}.zip`
    const destPath = path.join(backupsDir, filename)

    // Crear el zip comprimido
    await execPromise(`zip -r "${destPath}" .`, { cwd: sourceDir })

    res.json({ message: 'Respaldo creado con éxito.', filename })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/backups/restore ─────────────────────────────
router.post('/instances/:id/backups/restore', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { filename } = req.body
    if (!filename) return res.status(400).json({ error: 'filename es requerido' })

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede restaurar respaldos' })
    }

    const instance = access.gameInstance
    if (instance.status !== 'offline') {
      return res.status(400).json({ error: 'El servidor debe estar apagado para restaurar un respaldo' })
    }

    const backupPath = `/opt/gameservers/backups/${instanceId}/${filename}`
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Archivo de respaldo no encontrado' })
    }

    const worldPathsOnHost = {
      valheim:   '/opt/gameservers/valheim/data/worlds_local',
      minecraft: instance.containerName === 'moondev-mc-1' ? '/opt/gameservers/mc1/data/worlds' : '/opt/gameservers/mc2/data/worlds'
    }

    const destDir = worldPathsOnHost[instance.gameType]
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    // Limpiar vieja carpeta del mundo y extraer respaldo
    await execPromise(`rm -rf "${destDir}"/*`)
    if (filename.endsWith('.zip')) {
      await execPromise(`unzip -o "${backupPath}" -d "${destDir}"`)
    } else {
      await execPromise(`tar -xzf "${backupPath}" -C "${destDir}"`)
    }

    res.json({ message: 'Respaldo restaurado con éxito. El servidor cargará el mundo al iniciar.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/game/instances/:id/backups ──────────────────────────────────
router.delete('/instances/:id/backups', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { filename } = req.body
    if (!filename) return res.status(400).json({ error: 'filename es requerido' })

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede eliminar respaldos' })
    }

    const backupPath = `/opt/gameservers/backups/${instanceId}/${filename}`
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath)
    }

    res.json({ message: 'Archivo de respaldo eliminado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/backups/:filename/download ───────────────────
router.get('/instances/:id/backups/:filename/download', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { filename } = req.params

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId }
      }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })

    const backupPath = `/opt/gameservers/backups/${instanceId}/${filename}`
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Archivo de respaldo no encontrado' })
    }

    res.download(backupPath, filename)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/mc/properties ────────────────────────────────
router.get('/instances/:id/mc/properties', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    const props = await getProperties(access.gameInstance.containerName)
    res.json(props)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/mc/properties ───────────────────────────────
router.post('/instances/:id/mc/properties', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede modificar las opciones' })
    }
    
    const oldProps = await getProperties(access.gameInstance.containerName).catch(() => ({}))
    await saveProperties(access.gameInstance.containerName, req.body)

    // Sincronizar dificultad y modo de juego a level.dat de inmediato si el servidor está apagado
    if (access.gameInstance.gameType === 'minecraft' && access.gameInstance.status !== 'online') {
      await syncSettingsPropertiesToLevelDat(access.gameInstance.containerName)
    }

    // Hot-sync difficulty via console if the server is online
    if (req.body.difficulty && access.gameInstance.status === 'online' && access.gameInstance.containerId) {
      try {
        const container = docker.getContainer(access.gameInstance.containerId)
        const execObj = await container.exec({
          Cmd: ['send-command', `difficulty ${req.body.difficulty}`],
          AttachStdout: false,
          AttachStderr: false
        })
        const stream = await execObj.start({ hijack: true, stdin: false })
        await new Promise(r => setTimeout(r, 200))
      } catch (err) {
        console.error('[MC Properties Hot-Sync] Error applying difficulty:', err.message)
      }
    }

    // Hot-sync gamemode via console if force-gamemode=true and gamemode or force-gamemode changed
    const gamemodeChanged = req.body.gamemode && req.body.gamemode !== oldProps.gamemode
    const forceGamemodeActivated = req.body['force-gamemode'] === 'true' && oldProps['force-gamemode'] !== 'true'
    if ((gamemodeChanged || forceGamemodeActivated) && req.body['force-gamemode'] === 'true' && access.gameInstance.status === 'online' && access.gameInstance.containerId) {
      try {
        const modeToApply = req.body.gamemode || oldProps.gamemode || 'survival'
        const container = docker.getContainer(access.gameInstance.containerId)
        const execObj = await container.exec({
          Cmd: ['send-command', `gamemode ${modeToApply} @a`],
          AttachStdout: false,
          AttachStderr: false
        })
        const stream = await execObj.start({ hijack: true, stdin: false })
        await new Promise(r => setTimeout(r, 200))
        console.log(`[MC Properties Hot-Sync] Applied in-game gamemode ${modeToApply} to all players (@a) because force-gamemode=true`)
      } catch (err) {
        console.error('[MC Properties Hot-Sync] Error applying gamemode change in-game:', err.message)
      }
    }
    
    res.json({ message: 'Propiedades guardadas correctamente.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/mc/logs ───────────────────────────────────────
router.get('/instances/:id/mc/logs', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    
    const container = docker.getContainer(access.gameInstance.containerId)
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail: 150,
      timestamps: false
    })
    
    let cleanLogs = ''
    let offset = 0
    while (offset < logBuffer.length) {
      if (offset + 8 > logBuffer.length) break
      const type = logBuffer.readUInt8(offset)
      const length = logBuffer.readUInt32BE(offset + 4)
      if (offset + 8 + length > logBuffer.length) break
      const content = logBuffer.toString('utf8', offset + 8, offset + 8 + length)
      cleanLogs += content
      offset += 8 + length
    }
    
    if (!cleanLogs.trim() && logBuffer.length > 0) {
      cleanLogs = logBuffer.toString('utf8')
    }
    
    res.json({ logs: cleanLogs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/mc/console ──────────────────────────────────
router.post('/instances/:id/mc/console', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { command } = req.body
    if (!command) return res.status(400).json({ error: 'El comando es requerido' })

    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede ejecutar comandos en la consola' })
    }
    if (access.gameInstance.status !== 'online') {
      return res.status(400).json({ error: 'El servidor debe estar encendido para ejecutar comandos' })
    }

    const container = docker.getContainer(access.gameInstance.containerId)
    
    const execObj = await container.exec({
      Cmd: ['send-command', command],
      AttachStdout: true,
      AttachStderr: true
    })
    
    const stream = await execObj.start({ hijack: true, stdin: false })
    
    let output = ''
    stream.on('data', (chunk) => {
      if (chunk.length > 8) {
        output += chunk.toString('utf8', 8)
      } else {
        output += chunk.toString('utf8')
      }
    })

    await new Promise((resolve) => {
      stream.on('end', resolve)
      setTimeout(resolve, 1500)
    })

    res.json({ message: 'Comando enviado', output: output.trim() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/mc/files ─────────────────────────────────────
router.get('/instances/:id/mc/files', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const relPath = req.query.path || ''

    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })

    const files = await listFiles(access.gameInstance.containerName, relPath)
    res.json(files)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/mc/files/view ────────────────────────────────
router.get('/instances/:id/mc/files/view', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const relPath = req.query.path

    if (!relPath) return res.status(400).json({ error: 'Ruta de archivo requerida' })

    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })

    const content = await getFileContent(access.gameInstance.containerName, relPath)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/mc/files/save ───────────────────────────────
router.post('/instances/:id/mc/files/save', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { path: relPath, content } = req.body

    if (!relPath || content === undefined) {
      return res.status(400).json({ error: 'Ruta y contenido requeridos' })
    }

    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede guardar archivos' })
    }

    await saveFileContent(access.gameInstance.containerName, relPath, content)
    res.json({ message: 'Archivo guardado correctamente' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/mc/world/download ────────────────────────────
router.get('/instances/:id/mc/world/download', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })

    const zipPath = await compressWorld(access.gameInstance.containerName)
    
    res.download(zipPath, 'worlds_backup.zip', (err) => {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath)
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/mc/world/upload ─────────────────────────────
router.post('/instances/:id/mc/world/upload', authMiddleware, async (req, res) => {
  let tempFilePath = null
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede subir mundos' })
    }

    tempFilePath = `/tmp/uploaded_world_${instanceId}_${Date.now()}.zip`
    const writeStream = fs.createWriteStream(tempFilePath)
    
    req.pipe(writeStream)
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    const instance = access.gameInstance
    const isOnline = instance.status === 'online'
    const container = docker.getContainer(instance.containerId)
    
    if (isOnline) {
      await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'stopping' } })
      await container.stop().catch(() => {})
      await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'offline' } })
    }

    await extractWorldZip(instance.containerName, tempFilePath)

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
      tempFilePath = null
    }

    if (isOnline) {
      await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'starting' } })
      await container.start()
      resetGameTracker(instanceId)
      setTimeout(async () => {
        const current = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
        if (current && current.status === 'starting') {
          await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'online' } })
          if (instance.gameType === 'minecraft') {
            applyStartupGamerules(instance)
          }
        }
      }, 60_000) // Fallback de 60 segundos por si falla la lectura de logs
    }

    res.json({ message: 'Mundo subido y restaurado con éxito.', status: isOnline ? 'starting' : 'offline' })
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath) } catch (e) {}
    }
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/mc/world/generate ───────────────────────────
router.post('/instances/:id/mc/world/generate', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { seed, difficulty, levelName } = req.body

    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede generar mundos' })
    }

    const instance = access.gameInstance
    const isOnline = instance.status === 'online'
    const container = docker.getContainer(instance.containerId)

    if (isOnline) {
      await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'stopping' } })
      await container.stop().catch(() => {})
      await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'offline' } })
    }

    const props = {
      'max-players': '20',
      'gamemode': 'survival',
      'difficulty': difficulty !== undefined ? difficulty : 'easy',
      'online-mode': 'true',
      'allow-cheats': 'false',
      'force-gamemode': 'false',
      'texturepack-required': 'false',
      'allow-list': 'false'
    }
    if (seed !== undefined) props['level-seed'] = seed
    if (levelName !== undefined && levelName.trim() !== '') {
      props['level-name'] = levelName.trim()
    }
    
    await saveProperties(instance.containerName, props)

    const dataPath = getInstanceDataPath(instance.containerName)
    const worldsPath = path.join(dataPath, 'worlds')
    if (fs.existsSync(worldsPath)) {
      await execPromise(`rm -rf "${worldsPath}"`)
    }

    // Inicializar gamerules.json con los valores por defecto oficiales estilo Aternos
    await saveGamerules(instance.containerName, DEFAULT_GAMERULES)

    if (isOnline) {
      await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'starting' } })
      await container.start()
      resetGameTracker(instanceId)
      setTimeout(async () => {
        const current = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
        if (current && current.status === 'starting') {
          await prisma.gameInstance.update({ where: { id: instanceId }, data: { status: 'online' } })
          if (instance.gameType === 'minecraft') {
            applyStartupGamerules(instance)
          }
        }
      }, 60_000) // Fallback de 60 segundos por si falla la lectura de logs
    }

    res.json({ message: 'Mundo generado con éxito.', status: isOnline ? 'starting' : 'offline' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/mc/world/gamerules ───────────────────────────
router.get('/instances/:id/mc/world/gamerules', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    const rules = await getGamerules(access.gameInstance.containerName)
    res.json(rules)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/game/instances/:id/mc/world/gamerule ───────────────────────────
router.post('/instances/:id/mc/world/gamerule', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const { rule, value } = req.body

    if (!rule || value === undefined) {
      return res.status(400).json({ error: 'Regla y valor requeridos' })
    }

    const access = await prisma.userGameAccess.findUnique({
      where: { userId_gameInstanceId: { userId: req.user.id, gameInstanceId: instanceId } },
      include: { gameInstance: true }
    })
    if (!access) return res.status(403).json({ error: 'Sin acceso' })
    if (access.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario (owner) puede modificar las reglas del juego' })
    }

    const instance = access.gameInstance

    // Whitelist de reglas de juego de Minecraft Bedrock permitidas
    const ALLOWED_GAMERULES = [
      'showcoordinates', 'keepinventory', 'dodaylightcycle', 'doweathercycle',
      'domobspawning', 'pvp', 'dofiretick', 'domobloot', 'naturalregeneration',
      'doinsomnia', 'showdeathmessages', 'mobgriefing', 'randomtickspeed',
      'commandblocksenabled', 'commandblockoutput', 'respawnblocksexplode',
      'sendcommandfeedback', 'showdaysplayed', 'spawnradius', 'dotiledrops',
      'recipesunlock', 'tntexplodes', 'freezedamage', 'falldamage', 'firedamage',
      'drowningdamage', 'doentitydrops', 'doimmediaterespawn', 'playerssleepingpercentage',
      'maxcommandchainlength', 'functioncommandlimit', 'showtags', 'tntexplosiondropdecay'
    ]
    if (!ALLOWED_GAMERULES.includes(rule.toLowerCase())) {
      return res.status(400).json({ error: `Gamerule no permitida: ${rule}` })
    }

    // Sanitizar valor: aceptar booleanos, strings "true"/"false" o enteros
    const safeValue = (value === true || value === 'true') ? 'true'
      : (value === false || value === 'false') ? 'false'
      : /^\d+$/.test(String(value)) ? String(value)
      : null
    if (safeValue === null) return res.status(400).json({ error: 'Valor de gamerule inválido' })

    // Guardar en gamerules.json
    const rules = await getGamerules(instance.containerName)
    rules[rule] = safeValue === 'true' ? true : safeValue === 'false' ? false : parseInt(safeValue)
    await saveGamerules(instance.containerName, rules)

    // Si está online, aplicar en caliente
    if (instance.status === 'online' && instance.containerId) {
      const container = docker.getContainer(instance.containerId)
      const execObj = await container.exec({
        Cmd: ['send-command', `gamerule ${rule} ${safeValue}`],
        AttachStdout: true,
        AttachStderr: true
      })
      await execObj.start({ hijack: false, stdin: false })
    }

    return res.json({ 
      ok: true, 
      rule, 
      value: rules[rule],
      message: `Regla ${rule} establecida a ${safeValue} y aplicada correctamente.` 
    })
  } catch (err) {
    console.error('[MC Gamerule] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// Helper para aplicar todas las reglas de juego guardadas al iniciar el servidor
async function applyStartupGamerules(instance) {
  try {
    const rules = await getGamerules(instance.containerName)
    const container = docker.getContainer(instance.containerId)
    for (const [rule, value] of Object.entries(rules)) {
      const execObj = await container.exec({
        Cmd: ['send-command', `gamerule ${rule} ${value}`],
        AttachStdout: false,
        AttachStderr: false
      })
      const stream = await execObj.start({ hijack: true, stdin: false })
      // Esperar brevemente a que el stream se procese
      await new Promise(r => setTimeout(r, 200))
    }
    console.log(`[Gamerules] Startup rules applied successfully for ${instance.containerName}`)
  } catch (err) {
    console.error(`[Gamerules] Failed to apply startup rules for ${instance.containerName}:`, err.message)
  }
}

// Sincroniza la dificultad y el modo de juego definidos en server.properties con el archivo level.dat
async function syncSettingsPropertiesToLevelDat(containerName) {
  try {
    const props = await getProperties(containerName)
    const updates = {}

    // Sincronizar Dificultad
    if (props && props.difficulty) {
      const difficultyMap = { peaceful: 0, easy: 1, normal: 2, hard: 3 }
      const diffVal = difficultyMap[props.difficulty.toLowerCase()]
      if (diffVal !== undefined) {
        updates.Difficulty = diffVal
      }
    }

    // Sincronizar Modo de Juego (GameType)
    if (props && props.gamemode) {
      const gamemodeMap = { survival: 0, creative: 1, adventure: 2, spectator: 3 }
      const gamemodeVal = gamemodeMap[props.gamemode.toLowerCase()]
      if (gamemodeVal !== undefined) {
        updates.GameType = gamemodeVal
      }
    }

    if (Object.keys(updates).length > 0) {
      await saveLevelDatFields(containerName, updates)
      console.log(`[Settings Sync] Synced server.properties to level.dat for ${containerName}:`, updates)
    }
  } catch (err) {
    console.log(`[Settings Sync] Failed to sync properties to level.dat for ${containerName} (world might not be generated yet):`, err.message)
  }
}

// ============================================================
// MINECRAFT BEDROCK — WORLD SETTINGS (level.dat) + EXPERIMENTS
// ============================================================

// GET /api/game/instances/:id/mc/world — read level.dat fields and gamerule state
router.get('/instances/:id/mc/world', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.gameType !== 'minecraft') return res.status(400).json({ error: 'Solo disponible para Minecraft' })

    try {
      const fields = await getLevelDatFields(instance.containerName)
      return res.json({ levelDatExists: true, ...fields })
    } catch (fileErr) {
      const isMissing = 
        fileErr.code === 'ENOENT' || 
        fileErr.message.includes('no encontrado') || 
        fileErr.message.includes('No se encontro') ||
        fileErr.message.includes('ENOENT')

      if (isMissing) {
        return res.json({ levelDatExists: false, message: fileErr.message })
      }
      throw fileErr
    }
  } catch (err) {
    console.error('[MC World] Error leyendo level.dat:', err.message)
    return res.status(500).json({ error: err.message })
  }
})



// POST /api/game/instances/:id/mc/world/leveldat — save level.dat fields (requires server offline)
router.post('/instances/:id/mc/world/leveldat', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.gameType !== 'minecraft') return res.status(400).json({ error: 'Solo disponible para Minecraft' })
    if (instance.status === 'online') {
      return res.status(409).json({ error: 'El servidor debe estar apagado para modificar el level.dat' })
    }

    await saveLevelDatFields(instance.containerName, req.body)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[MC LevelDat] Error guardando:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/game/instances/:id/mc/world/experiments — save experiment flags (requires server offline)
router.post('/instances/:id/mc/world/experiments', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.gameType !== 'minecraft') return res.status(400).json({ error: 'Solo disponible para Minecraft' })
    if (instance.status === 'online') {
      return res.status(409).json({ error: 'El servidor debe estar apagado para modificar los experimentos' })
    }

    await saveExperiments(instance.containerName, req.body)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[MC Experiments] Error guardando:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================
// MINECRAFT BEDROCK — ADD-ON MANAGEMENT
// ============================================================

// GET /api/game/instances/:id/mc/addons — list installed behavior and resource packs
router.get('/instances/:id/mc/addons', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.gameType !== 'minecraft') return res.status(400).json({ error: 'Solo disponible para Minecraft' })

    const addons = await listInstalledAddons(instance.containerName)
    return res.json(addons)
  } catch (err) {
    console.error('[MC Addons] Error listando:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/game/instances/:id/mc/addons/upload — upload and install an addon file
router.post('/instances/:id/mc/addons/upload', authMiddleware, addonUpload.single('addon'), async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.gameType !== 'minecraft') return res.status(400).json({ error: 'Solo disponible para Minecraft' })
    if (instance.status === 'online') {
      return res.status(409).json({ error: 'Apaga el servidor antes de instalar add-ons' })
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibio ningun archivo' })

    const installed = await installAddon(
      instance.containerName,
      req.file.path,
      req.file.originalname
    )

    if (installed.length === 0) {
      return res.status(422).json({ error: 'No se encontraron packs validos en el archivo subido' })
    }

    // Auto-activate each installed pack in the active world
    for (const pack of installed) {
      try {
        await activateAddonInWorld(
          instance.containerName,
          pack.manifest.uuid,
          pack.manifest.version,
          pack.packType
        )
      } catch (e) {
        // World may not exist yet; activation will be deferred
        console.warn(`[MC Addons] Could not auto-activate ${pack.manifest.name}: ${e.message}`)
      }
    }

    return res.json({ ok: true, installed })
  } catch (err) {
    console.error('[MC Addons] Error instalando:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/game/instances/:id/mc/addons/activate — toggle activation state of a pack in the world
router.post('/instances/:id/mc/addons/activate', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.status === 'online') {
      return res.status(409).json({ error: 'Apaga el servidor antes de cambiar add-ons activos' })
    }

    const { uuid, version, packType, activate } = req.body
    if (!uuid || !packType) return res.status(400).json({ error: 'Faltan campos uuid o packType' })

    if (activate) {
      await activateAddonInWorld(instance.containerName, uuid, version || [1, 0, 0], packType)
    } else {
      await deactivateAddonInWorld(instance.containerName, uuid, packType)
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error('[MC Addons] Error activando/desactivando:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// DELETE /api/game/instances/:id/mc/addons — fully uninstall an addon (deactivate + delete folder)
router.delete('/instances/:id/mc/addons', authMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.status === 'online') {
      return res.status(409).json({ error: 'Apaga el servidor antes de desinstalar add-ons' })
    }

    const { folderName, uuid, packType } = req.body
    if (!folderName || !uuid || !packType) {
      return res.status(400).json({ error: 'Faltan campos: folderName, uuid, packType' })
    }

    await uninstallAddon(instance.containerName, folderName, uuid, packType)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[MC Addons] Error desinstalando:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// Detecta la versión exacta de Bedrock leyendo los logs almacenados de Docker
async function getActualBedrockVersion(containerId) {
  if (!containerId) return null
  try {
    const container = docker.getContainer(containerId)
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: false
    })
    const logsText = logBuffer.toString('utf8')
    const versionMatch = logsText.match(/Version:\s*([0-9.]+)/i)
    if (versionMatch) {
      return versionMatch[1]
    }
  } catch (err) {
    console.error('[Version Detect] Failed to parse bedrock version from logs:', err.message)
  }
  return null
}

module.exports = router
