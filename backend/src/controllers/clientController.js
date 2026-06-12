const { PrismaClient } = require('@prisma/client')
const dockerService = require('../services/dockerService')
const { launchInstanceHelper } = require('./adminController')

const prisma = new PrismaClient()

// Helper para obtener la instancia del cliente logueado
async function getClientInstance(userId) {
  const instance = await prisma.instance.findUnique({
    where: { userId },
    include: { sshKeys: true }
  })
  return instance
}

// GET /api/client/instance
async function getInstance(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) {
      return res.status(404).json({ error: 'No tienes ninguna instancia asignada.' })
    }

    if (instance.status === 'PENDING') {
      return res.status(200).json({ instance })
    }

    // Obtener estado real del contenedor
    const realStatus = await dockerService.getContainerStatus(instance.containerName)
    if (instance.status !== realStatus) {
      await prisma.instance.update({
        where: { id: instance.id },
        data: { status: realStatus }
      })
      instance.status = realStatus
    }

    // Información SSH para conectar
    const sshInfo = {
      host: process.env.DOMAIN || 'moondev.online',
      sshPort: instance.sshPort,
      username: 'root',
      password: instance.sshPassword
    }

    return res.status(200).json({
      instance,
      sshInfo
    })
  } catch (error) {
    console.error('[CLIENT INSTANCE] Error:', error)
    return res.status(500).json({ error: 'Error al obtener datos de la instancia.' })
  }
}

// POST /api/client/instance/launch
async function launchInstance(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) {
      return res.status(404).json({ error: 'No tienes ninguna instancia asignada.' })
    }

    if (instance.status !== 'PENDING') {
      return res.status(400).json({ error: 'La instancia ya ha sido lanzada.' })
    }

    console.log(`[CLIENT LAUNCH] Lanzando instancia para el usuario ${req.user.username}...`)
    const updated = await launchInstanceHelper(instance.id)

    return res.status(200).json({
      message: 'Instancia lanzada exitosamente.',
      instance: updated
    })
  } catch (error) {
    console.error('[CLIENT LAUNCH] Error:', error)
    return res.status(500).json({ error: error.message || 'Error al lanzar el contenedor.' })
  }
}

// POST /api/client/instance/start
async function startInstance(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'La instancia no ha sido lanzada aún.' })
    }

    await dockerService.startContainer(instance.containerName)

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'RUNNING' }
    })

    return res.status(200).json({ message: 'Instancia iniciada.', status: 'RUNNING' })
  } catch (error) {
    console.error('[CLIENT INSTANCE START] Error:', error)
    return res.status(500).json({ error: 'Error al iniciar el contenedor.' })
  }
}

// POST /api/client/instance/stop
async function stopInstance(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'La instancia no ha sido lanzada aún.' })
    }

    await dockerService.stopContainer(instance.containerName)

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'STOPPED' }
    })

    return res.status(200).json({ message: 'Instancia detenida.', status: 'STOPPED' })
  } catch (error) {
    console.error('[CLIENT INSTANCE STOP] Error:', error)
    return res.status(500).json({ error: 'Error al detener el contenedor.' })
  }
}

// POST /api/client/instance/restart
async function restartInstance(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'La instancia no ha sido lanzada aún.' })
    }

    await dockerService.restartContainer(instance.containerName)

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'RUNNING' }
    })

    return res.status(200).json({ message: 'Instancia reiniciada.', status: 'RUNNING' })
  } catch (error) {
    console.error('[CLIENT INSTANCE RESTART] Error:', error)
    return res.status(500).json({ error: 'Error al reiniciar el contenedor.' })
  }
}

// GET /api/client/instance/stats
async function getInstanceStats(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    if (instance.status === 'PENDING') {
      return res.status(200).json({
        cpu: "0.00",
        ramUsed: 0,
        ramLimit: instance.ramLimit,
        diskUsed: 0,
        diskLimit: instance.diskLimit
      })
    }

    const stats = await dockerService.getStats(instance.containerName)
    return res.status(200).json({
      ...stats,
      diskLimit: instance.diskLimit
    })
  } catch (error) {
    console.error('[CLIENT INSTANCE STATS] Error:', error)
    return res.status(500).json({ error: 'Error al obtener estadísticas.' })
  }
}

// ==========================================
// SSH KEYS
// ==========================================

// GET /api/client/ssh-keys
async function getSSHKeys(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const keys = await prisma.sSHKey.findMany({
      where: { instanceId: instance.id }
    })
    return res.status(200).json(keys)
  } catch (error) {
    console.error('[CLIENT SSH-KEYS] Error:', error)
    return res.status(500).json({ error: 'Error al obtener llaves SSH.' })
  }
}

// POST /api/client/ssh-keys
async function addSSHKey(req, res) {
  try {
    const { label, publicKey } = req.body
    if (!label || !publicKey) {
      return res.status(400).json({ error: 'Etiqueta y llave pública son requeridas.' })
    }

    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const cleanKey = publicKey.trim()

    if (instance.status !== 'PENDING') {
      console.log(`[CLIENT SSH-KEYS] Inyectando llave SSH en contenedor ${instance.containerName}...`)
      await dockerService.addSSHKeyToContainer(instance.containerName, cleanKey)
    }

    const key = await prisma.sSHKey.create({
      data: {
        instanceId: instance.id,
        label,
        publicKey: cleanKey
      }
    })

    return res.status(201).json({
      message: instance.status === 'PENDING' ? 'Llave SSH guardada en la base de datos.' : 'Llave SSH añadida con éxito al contenedor.',
      key
    })
  } catch (error) {
    console.error('[CLIENT SSH-KEYS ADD] Error:', error)
    return res.status(500).json({ error: 'Error al añadir llave SSH.' })
  }
}

// DELETE /api/client/ssh-keys/:id
async function deleteSSHKey(req, res) {
  try {
    const { id } = req.params

    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const key = await prisma.sSHKey.findFirst({
      where: {
        id,
        instanceId: instance.id
      }
    })

    if (!key) {
      return res.status(404).json({ error: 'Llave SSH no encontrada o no pertenece a tu instancia.' })
    }

    if (instance.status !== 'PENDING') {
      console.log(`[CLIENT SSH-KEYS] Eliminando llave SSH de contenedor ${instance.containerName}...`)
      await dockerService.removeSSHKeyFromContainer(instance.containerName, key.publicKey)
    }

    await prisma.sSHKey.delete({ where: { id } })

    return res.status(200).json({ message: 'Llave SSH eliminada con éxito.' })
  } catch (error) {
    console.error('[CLIENT SSH-KEYS DELETE] Error:', error)
    return res.status(500).json({ error: 'Error al eliminar la llave SSH.' })
  }
}

// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================

// GET /api/client/envvars
async function getEnvVars(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const { decrypt } = require('./cryptoService')
    const envVars = await prisma.envVar.findMany({
      where: { instanceId: instance.id }
    })

    const decryptedVars = envVars.map(v => ({
      id: v.id,
      key: v.key,
      value: decrypt(v.value)
    }))

    return res.status(200).json(decryptedVars)
  } catch (error) {
    console.error('[CLIENT GET ENVVARS] Error:', error)
    return res.status(500).json({ error: 'Error al obtener variables de entorno.' })
  }
}

// POST /api/client/envvars
async function addOrUpdateEnvVar(req, res) {
  try {
    const { key, value } = req.body
    if (!key) {
      return res.status(400).json({ error: 'El nombre de la variable (key) es requerido.' })
    }

    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const { encrypt, decrypt } = require('./cryptoService')
    const encryptedValue = encrypt(value || '')

    const existing = await prisma.envVar.findFirst({
      where: { instanceId: instance.id, key }
    })

    let envVar
    if (existing) {
      envVar = await prisma.envVar.update({
        where: { id: existing.id },
        data: { value: encryptedValue }
      })
    } else {
      envVar = await prisma.envVar.create({
        data: {
          instanceId: instance.id,
          key,
          value: encryptedValue
        }
      })
    }

    return res.status(200).json({
      message: 'Variable de entorno guardada con éxito.',
      envVar: {
        id: envVar.id,
        key: envVar.key,
        value: decrypt(envVar.value)
      }
    })
  } catch (error) {
    console.error('[CLIENT ADD/UPDATE ENVVAR] Error:', error)
    return res.status(500).json({ error: 'Error al guardar variable de entorno.' })
  }
}

// DELETE /api/client/envvars/:id
async function deleteEnvVar(req, res) {
  try {
    const { id } = req.params
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const envVar = await prisma.envVar.findFirst({
      where: { id, instanceId: instance.id }
    })

    if (!envVar) {
      return res.status(404).json({ error: 'Variable de entorno no encontrada.' })
    }

    await prisma.envVar.delete({ where: { id } })

    return res.status(200).json({ message: 'Variable de entorno eliminada con éxito.' })
  } catch (error) {
    console.error('[CLIENT DELETE ENVVAR] Error:', error)
    return res.status(500).json({ error: 'Error al eliminar variable de entorno.' })
  }
}

// ==========================================
// DEPLOYMENTS
// ==========================================

// GET /api/client/deployments
async function getDeployments(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const deployments = await prisma.deployment.findMany({
      where: { instanceId: instance.id },
      orderBy: { createdAt: 'desc' }
    })
    return res.status(200).json(deployments)
  } catch (error) {
    console.error('[CLIENT GET DEPLOYMENTS] Error:', error)
    return res.status(500).json({ error: 'Error al obtener historial de despliegues.' })
  }
}

// POST /api/client/deploy
async function triggerDeploy(req, res) {
  try {
    const { repoUrl, branch } = req.body
    if (!repoUrl) {
      return res.status(400).json({ error: 'La URL del repositorio de GitHub es requerida.' })
    }

    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'Debes lanzar primero tu instancia para poder realizar despliegues.' })
    }

    const deployment = await prisma.deployment.create({
      data: {
        instanceId: instance.id,
        repoUrl,
        branch: branch || 'main',
        projectType: 'PENDING',
        status: 'PENDING'
      }
    })

    const { runDeploy } = require('../services/deployService')
    runDeploy(deployment.id).catch(err => {
      console.error(`Error in runDeploy background task for ${deployment.id}:`, err)
    })

    return res.status(202).json({
      message: 'Despliegue iniciado.',
      deployment
    })
  } catch (error) {
    console.error('[CLIENT DEPLOY] Error:', error)
    return res.status(500).json({ error: 'Error al iniciar el despliegue.' })
  }
}

// GET /api/client/deploy/logs/:deploymentId (SSE Stream)
async function getDeployLogs(req, res) {
  try {
    const { deploymentId } = req.params
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { instance: true }
    })

    if (!deployment || deployment.instance.userId !== req.user.id) {
      return res.status(404).json({ error: 'Despliegue no encontrado.' })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Send history logs if any
    if (deployment.logs) {
      res.write(`data: ${JSON.stringify({ type: 'history', text: deployment.logs })}\n\n`)
    }

    // Send current status
    res.write(`data: ${JSON.stringify({ type: 'status', status: deployment.status, projectType: deployment.projectType })}\n\n`)

    if (deployment.status === 'SUCCESS' || deployment.status === 'FAILED') {
      res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`)
      return res.end()
    }

    const { deployEmitter } = require('../services/deployService')
    const logListener = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      if (data.type === 'status' && (data.status === 'SUCCESS' || data.status === 'FAILED')) {
        res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`)
        res.end()
      }
    }

    deployEmitter.on(`logs:${deploymentId}`, logListener)

    req.on('close', () => {
      deployEmitter.off(`logs:${deploymentId}`, logListener)
    })
  } catch (error) {
    console.error('[CLIENT DEPLOY LOGS SSE] Error:', error)
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Error interno en la transmisión de logs.' })}\n\n`)
    res.end()
  }
}

module.exports = {
  getInstance,
  launchInstance,
  startInstance,
  stopInstance,
  restartInstance,
  getInstanceStats,
  getSSHKeys,
  addSSHKey,
  deleteSSHKey,
  getEnvVars,
  addOrUpdateEnvVar,
  deleteEnvVar,
  getDeployments,
  triggerDeploy,
  getDeployLogs
}
