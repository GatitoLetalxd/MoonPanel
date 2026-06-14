// backend/src/routes/game.routes.js
const { Router } = require('express')
const authMiddleware = require('../middleware/auth.js')  // middleware JWT existente
const prisma = require('../lib/prisma.js')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const { resetGameTracker } = require('../services/gameScheduler.js')

const router = Router()

// ── GET /api/game/instances ─────────────────────────────────────────────────
// Retorna instancias del usuario autenticado, filtradas por subdominio.
// Instancias en estado "pending" NO se muestran al usuario final.
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

    const instances = access
      .filter(a => {
        const inst = a.gameInstance
        if (!inst) return false
        if (inst.status === 'pending') return false
        if (gameType && inst.gameType !== gameType) return false
        return true
      })
      .map(a => ({
        ...a.gameInstance,
        userRole: a.role
      }))

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
    // Valheim ~30s, Minecraft ~10s — usar 20s como balance
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
// Polling ligero de estado para el frontend
router.get('/instances/:id/status', authMiddleware, async (req, res) => {
  try {
    const instance = await prisma.gameInstance.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (!instance) return res.status(404).json({ error: 'No encontrado' })
    res.json({ status: instance.status })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
