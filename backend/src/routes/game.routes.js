// backend/src/routes/game.routes.js
const { Router } = require('express')
const authMiddleware = require('../middleware/auth.js')
const prisma = require('../lib/prisma.js')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const { resetGameTracker } = require('../services/gameScheduler.js')
const { queryPlayers } = require('../services/playerQueryService.js')
const { getGameConfig, updateGameConfig, getServiceName } = require('../services/gameConfigService.js')
const { getStats } = require('../services/dockerService.js')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

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
          if (inst.status === 'online') {
            const p = await queryPlayers(inst.gameType, inst.queryPort)
            playersConnected = p >= 0 ? p : 0
          }
          return {
            ...inst,
            userRole: a.role,
            playersConnected
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

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'starting' }
    })

    const container = docker.getContainer(instance.containerId)
    await container.start()
    resetGameTracker(instanceId)

    // Marcar online tras gracia de arranque
    setTimeout(async () => {
      await prisma.gameInstance.update({
        where: { id: instanceId },
        data: { status: 'online' }
      })
    }, 20_000)

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
    await container.stop()

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

    const container = docker.getContainer(access.gameInstance.containerId)
    await container.restart()
    resetGameTracker(instanceId)

    await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'online' }
    })

    res.json({ message: 'Servidor reiniciado', status: 'online' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/game/instances/:id/status ──────────────────────────────────────
router.get('/instances/:id/status', authMiddleware, async (req, res) => {
  try {
    const instance = await prisma.gameInstance.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (!instance) return res.status(404).json({ error: 'No encontrado' })
    let playersConnected = 0
    if (instance.status === 'online') {
      const p = await queryPlayers(instance.gameType, instance.queryPort)
      playersConnected = p >= 0 ? p : 0
    }
    res.json({ status: instance.status, playersConnected })
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
    // Mezclar con nuevos valores
    const updatedConfig = { ...config, ...req.body }

    // EULA y SERVER_PUBLIC deben validarse
    if (instance.gameType === 'minecraft') {
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
            await prisma.gameInstance.update({
              where: { id: instanceId },
              data: { status: 'online' }
            })
          }, 15_000)
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
      .filter(f => f.endsWith('.tar.gz'))
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

    const filename = `backup_${instance.gameType}_${Date.now()}.tar.gz`
    const destPath = path.join(backupsDir, filename)

    // Crear el tar gz comprimido
    await execPromise(`tar -czf "${destPath}" -C "${sourceDir}" .`)

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
    await execPromise(`tar -xzf "${backupPath}" -C "${destDir}"`)

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

module.exports = router
