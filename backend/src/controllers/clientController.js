const { PrismaClient } = require('@prisma/client')
const dockerService = require('../services/dockerService')

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

// POST /api/client/instance/start
async function startInstance(req, res) {
  try {
    const instance = await getClientInstance(req.user.id)
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

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

    // Limpiar llave de espacios extras
    const cleanKey = publicKey.trim()

    // 1. Agregar físicamente dentro del container
    console.log(`[CLIENT SSH-KEYS] Inyectando llave SSH en contenedor ${instance.containerName}...`)
    await dockerService.addSSHKeyToContainer(instance.containerName, cleanKey)

    // 2. Guardar en base de datos
    const key = await prisma.sSHKey.create({
      data: {
        instanceId: instance.id,
        label,
        publicKey: cleanKey
      }
    })

    return res.status(201).json({
      message: 'Llave SSH añadida con éxito al contenedor.',
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

    // Buscar la llave y verificar que pertenezca a la instancia del cliente logueado
    const key = await prisma.sSHKey.findFirst({
      where: {
        id,
        instanceId: instance.id
      }
    })

    if (!key) {
      return res.status(404).json({ error: 'Llave SSH no encontrada o no pertenece a tu instancia.' })
    }

    // 1. Remover físicamente dentro del container
    console.log(`[CLIENT SSH-KEYS] Eliminando llave SSH de contenedor ${instance.containerName}...`)
    await dockerService.removeSSHKeyFromContainer(instance.containerName, key.publicKey)

    // 2. Eliminar de la base de datos
    await prisma.sSHKey.delete({ where: { id } })

    return res.status(200).json({ message: 'Llave SSH eliminada con éxito del contenedor.' })
  } catch (error) {
    console.error('[CLIENT SSH-KEYS DELETE] Error:', error)
    return res.status(500).json({ error: 'Error al eliminar la llave SSH.' })
  }
}

module.exports = {
  getInstance,
  startInstance,
  stopInstance,
  restartInstance,
  getInstanceStats,
  getSSHKeys,
  addSSHKey,
  deleteSSHKey
}
