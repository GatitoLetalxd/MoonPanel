// backend/src/routes/gameAdmin.routes.js
const { Router } = require('express')
const authMiddleware = require('../middleware/auth.js')
const adminMiddleware = require('../middleware/isAdmin.js')  // middleware admin existente
const prisma = require('../lib/prisma.js')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const router = Router()

// ── GET /api/admin/game/instances ───────────────────────────────────────────
router.get('/instances', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const instances = await prisma.gameInstance.findMany({
      include: {
        userAccess: {
          include: {
            user: { select: { id: true, email: true, username: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(instances)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/game/instances ──────────────────────────────────────────
// Registra un contenedor pre-creado. Estado inicial: "pending"
router.post('/instances', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, gameType, containerId, containerName, queryPort } = req.body

    if (!['valheim', 'minecraft'].includes(gameType)) {
      return res.status(400).json({ error: 'gameType debe ser "valheim" o "minecraft"' })
    }

    const instance = await prisma.gameInstance.create({
      data: { name, gameType, containerId, containerName, queryPort: parseInt(queryPort), status: 'pending' }
    })
    res.status(201).json(instance)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/game/instances/:id/activate ─────────────────────────────
// Admin activa la instancia: pending → offline (lista para que el usuario la encienda)
router.post('/instances/:id/activate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })

    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.status !== 'pending') {
      return res.status(400).json({ error: 'La instancia ya está activa' })
    }

    const updated = await prisma.gameInstance.update({
      where: { id: instanceId },
      data: { status: 'offline' }
    })
    res.json({ message: 'Instancia activada', instance: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/game/instances/:id/reset-world ──────────────────────────
// Borra el directorio de saves. El contenedor DEBE estar offline.
router.post('/instances/:id/reset-world', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })

    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada' })
    if (instance.status !== 'offline') {
      return res.status(400).json({ error: 'Detén el servidor antes de resetear el mundo' })
    }

    const worldPaths = {
      valheim:   '/config/worlds_local',
      minecraft: '/data/worlds'
    }

    const container = docker.getContainer(instance.containerId)
    try {
      await container.start()
    } catch (startErr) {
      if (startErr.statusCode !== 304 && !startErr.message.includes('304') && !startErr.message.includes('already started')) {
        throw startErr
      }
    }

    const exec = await container.exec({
      Cmd: ['rm', '-rf', worldPaths[instance.gameType]],
      AttachStdout: true,
      AttachStderr: true
    })
    await exec.start({ hijack: true, stdin: false })
    await new Promise(r => setTimeout(r, 2000)) // esperar que rm termine
    await container.stop()

    res.json({ message: 'Mundo reseteado. El servidor generará uno nuevo al iniciar.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/game/instances/:id ────────────────────────────────────
// Elimina el registro de la instancia de la DB (no borra el contenedor Docker)
router.delete('/instances/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id)
    const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } })

    if (!instance) return res.status(404).json({ error: 'No encontrado' })
    if (instance.status === 'online') {
      return res.status(400).json({ error: 'Detén el servidor antes de eliminarlo' })
    }

    await prisma.gameInstance.delete({ where: { id: instanceId } })
    res.json({ message: 'Instancia eliminada del panel' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/game/instances/:id/access ───────────────────────────────
// Dar o modificar acceso de un usuario a una instancia (Upsert)
router.post('/instances/:id/access', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, role = 'player' } = req.body
    const gameInstanceId = parseInt(req.params.id)

    // Buscar si ya existe
    const existing = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameInstanceId: { userId, gameInstanceId }
      }
    })

    if (existing) {
      const updated = await prisma.userGameAccess.update({
        where: { id: existing.id },
        data: { role }
      })
      return res.status(200).json({ message: 'Rol de acceso actualizado con éxito.', access: updated })
    }

    const access = await prisma.userGameAccess.create({
      data: {
        userId,
        gameInstanceId,
        role
      }
    })
    res.status(201).json({ message: 'Acceso concedido con éxito.', access })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/game/instances/:id/access/:userId ─────────────────────
// Revocar acceso de un usuario
router.delete('/instances/:id/access/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await prisma.userGameAccess.delete({
      where: {
        userId_gameInstanceId: {
          userId: req.params.userId,
          gameInstanceId: parseInt(req.params.id)
        }
      }
    })
    res.json({ message: 'Acceso revocado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
