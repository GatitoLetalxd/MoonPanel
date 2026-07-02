// backend/src/services/gameScheduler.js
const { queryPlayers } = require('./playerQueryService.js')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const prisma = require('../lib/prisma.js')

const POLL_INTERVAL_MS  = 60_000      // query cada 60 segundos
const SHUTDOWN_AFTER_MS = 5 * 60_000  // apagar tras 5 min sin jugadores

// Map en memoria: gameInstanceId → { emptyMs: number }
const trackers = new Map()

function startGameScheduler() {
  console.log('[GameScheduler] Auto-sleep scheduler iniciado.')
  setInterval(async () => {
    try {
      const instances = await prisma.gameInstance.findMany({
        where: { status: 'online' }
      })
      for (const instance of instances) {
        await checkInstance(instance)
      }
    } catch (err) {
      console.error('[GameScheduler] Error en ciclo de polling:', err.message)
    }
  }, POLL_INTERVAL_MS)
}

async function checkInstance(instance) {
  const players = await queryPlayers(instance.gameType, instance.queryPort, instance.containerId)

  if (!trackers.has(instance.id)) {
    trackers.set(instance.id, { emptyMs: 0 })
  }

  const tracker = trackers.get(instance.id)

  if (players > 0) {
    // Hay jugadores → resetear contador
    tracker.emptyMs = 0
    return
  }

  if (players === -1) {
    // No responde (puede estar arrancando aún) → no penalizar
    return
  }

  // 0 jugadores confirmados → acumular tiempo vacío
  tracker.emptyMs += POLL_INTERVAL_MS
  console.log(`[GameScheduler] ${instance.containerName}: ${tracker.emptyMs / 1000}s sin jugadores`)

  if (tracker.emptyMs >= SHUTDOWN_AFTER_MS) {
    console.log(`[GameScheduler] ${instance.containerName}: apagando por inactividad`)
    await autoStop(instance)
    trackers.delete(instance.id)
  }
}

async function autoStop(instance) {
  try {
    const container = docker.getContainer(instance.containerId)
    await container.stop()
    await prisma.gameInstance.update({
      where: { id: instance.id },
      data: { status: 'offline' }
    })
    console.log(`[GameScheduler] ${instance.containerName}: detenido correctamente`)
  } catch (err) {
    console.error(`[GameScheduler] Error al detener ${instance.containerName}:`, err.message)
    // Forzar status offline en DB aunque el stop falle
    await prisma.gameInstance.update({
      where: { id: instance.id },
      data: { status: 'offline' }
    }).catch(() => {})
  }
}

// Exportar para resetear el tracker cuando el admin/jugador inicia manualmente
function resetGameTracker(gameInstanceId) {
  trackers.delete(gameInstanceId)
}

module.exports = {
  startGameScheduler,
  resetGameTracker
}
