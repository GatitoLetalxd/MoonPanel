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
  
  // Escuchar eventos de Docker en tiempo real (<0.1s)
  listenDockerEvents()

  // Polling de inactividad de jugadores (cada 60s)
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

  // Polling secundario de respaldo de sincronización de estado (cada 15s)
  setInterval(syncDockerAndDbStatus, 15_000)
}

function listenDockerEvents() {
  docker.getEvents({ type: 'container' }, (err, stream) => {
    if (err) {
      console.error('[DockerEvents] Falló al iniciar stream de eventos:', err.message)
      return
    }
    if (!stream) return

    console.log('[DockerEvents] Escuchando eventos de contenedores Docker en tiempo real.')

    stream.on('data', (chunk) => {
      try {
        const event = JSON.parse(chunk.toString('utf8'))
        if (['start', 'die', 'stop', 'kill', 'destroy'].includes(event.Action)) {
          syncDockerAndDbStatus().catch(() => {})
        }
      } catch (_) {}
    })

    stream.on('error', (e) => {
      console.error('[DockerEvents] Stream error:', e.message)
    })
  })
}

async function syncDockerAndDbStatus() {
  try {
    const instances = await prisma.gameInstance.findMany()
    for (const instance of instances) {
      if (instance.status === 'pending') continue

      const container = docker.getContainer(instance.containerId)
      let isRunning = false
      let skipSync = false
      try {
        const inspect = await container.inspect()
        isRunning = inspect.State.Running
      } catch (err) {
        isRunning = false
        // Si no es un error 404 (no encontrado) o "no such container", asumimos error de conexión/daemon Docker
        const errMsg = (err.message || '').toLowerCase()
        if (err.statusCode !== 404 && !errMsg.includes('no such container') && !errMsg.includes('could not find')) {
          console.warn(`[StatusSync] Fallo al inspeccionar contenedor ${instance.containerId} (¿Daemon caído?): ${err.message}`)
          skipSync = true
        }
      }

      if (skipSync) continue

      // Si la BD dice que está activo pero Docker dice que está apagado
      if (!isRunning && ['online', 'starting', 'stopping'].includes(instance.status)) {
        // Conceder un margen de gracia de 3 minutos para 'starting' y 'stopping'
        if (instance.status === 'starting' || instance.status === 'stopping') {
          const secondsSinceUpdate = (Date.now() - new Date(instance.updatedAt).getTime()) / 1000
          if (secondsSinceUpdate < 180) {
            continue // Saltamos la sincronización para dar tiempo de iniciar/detener
          }
        }

        console.log(`[StatusSync] Detectado contenedor ${instance.containerId} apagado, sincronizando BD a offline.`)
        await prisma.gameInstance.update({
          where: { id: instance.id },
          data: { status: 'offline' }
        })
        try {
          const discordBotService = require('./discordBotService.js')
          await discordBotService.updateStatusBoards(instance.id)
        } catch (_) {}
      }

      // Si la BD dice que está apagado pero Docker dice que está encendido
      if (isRunning && instance.status === 'offline') {
        console.log(`[StatusSync] Detectado contenedor ${instance.containerId} encendido, sincronizando BD a online.`)
        await prisma.gameInstance.update({
          where: { id: instance.id },
          data: { status: 'online' }
        })
        try {
          const discordBotService = require('./discordBotService.js')
          await discordBotService.updateStatusBoards(instance.id)
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('[StatusSync] Error en ciclo de sincronización de estado:', err.message)
  }
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
        console.error(`[GameScheduler AutoStop] Error en cierre limpio de MC:`, err.message)
        await container.stop().catch(() => {})
      }
    } else if (instance.gameType === 'valheim') {
      try {
        const execObj = await container.exec({
          Cmd: ['send-command', 'save'],
          AttachStdout: false,
          AttachStderr: false
        })
        await execObj.start({ hijack: true, stdin: false }).catch(() => {})
        // Esperar 3 segundos para que Valheim guarde todo el terreno/mundo a disco
        await new Promise(r => setTimeout(r, 3000))
        await container.stop({ t: 30 }).catch(() => {})
      } catch (err) {
        console.error(`[GameScheduler AutoStop] Error en guardado limpio de Valheim:`, err.message)
        await container.stop().catch(() => {})
      }
    } else {
      await container.stop().catch(() => {})
    }

    await prisma.gameInstance.update({
      where: { id: instance.id },
      data: { status: 'offline' }
    })
    console.log(`[GameScheduler] ${instance.containerName}: detenido correctamente con guardado.`)
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
