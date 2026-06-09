const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const generator = require('generate-password')
const dockerService = require('../services/dockerService')
const nginxService = require('../services/nginxService')

const prisma = new PrismaClient()

// Validar que el subdominio solo contenga minúsculas, números y guiones
function isValidSubdomain(subdomain) {
  const regex = /^[a-z0-9-]+$/
  return regex.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 30
}

// Obtener puertos disponibles de forma automática
async function getNextAvailablePorts() {
  const instances = await prisma.instance.findMany({ select: { webPort: true, sshPort: true } })
  const usedWeb = instances.map(i => i.webPort)
  const usedSsh = instances.map(i => i.sshPort)

  // Índice de cliente (0-5, máximo 6 clientes)
  const clientIndex = instances.length
  if (clientIndex >= 6) {
    throw new Error('Límite de 6 instancias alcanzado.')
  }

  const webBase = 3010 + (clientIndex * 20)
  const sshPort = 2210 + (clientIndex * 10)

  let webPort = null
  for (let p = webBase; p < webBase + 20; p++) {
    if (!usedWeb.includes(p)) {
      webPort = p
      break
    }
  }

  if (!webPort || usedSsh.includes(sshPort)) {
    throw new Error('No hay puertos disponibles en el rango asignado.')
  }

  return { webPort, sshPort }
}

// Helper para crear instancia
async function createInstanceHelper(userId, subdomain, ramLimit = 512, cpuLimit = 0.5, diskLimit = 2048) {
  if (!isValidSubdomain(subdomain)) {
    throw new Error('Subdominio inválido. Solo se permiten letras minúsculas, números y guiones (3-30 caracteres).')
  }

  // Verificar si ya existe el subdominio
  const existingSub = await prisma.instance.findUnique({ where: { subdomain } })
  if (existingSub) {
    throw new Error('El subdominio ya está en uso.')
  }

  // Obtener puertos
  const { webPort, sshPort } = await getNextAvailablePorts()

  // Generar password SSH temporal
  const sshPassword = generator.generate({
    length: 12,
    numbers: true,
    uppercase: true,
    symbols: false
  })

  const containerName = `mp-client-${subdomain}`

  try {
    // 1. Crear contenedor docker
    console.log(`[ADMIN HELPER] Creando contenedor ${containerName}...`)
    await dockerService.createContainer({
      containerName,
      webPort,
      sshPort,
      ramLimit,
      cpuLimit,
      sshPassword
    })

    // 2. Crear configuración de Nginx (vhost)
    console.log(`[ADMIN HELPER] Creando vhost Nginx para ${subdomain}...`)
    await nginxService.createVhost(subdomain, webPort)

    // 3. Crear registro en BD
    const instance = await prisma.instance.create({
      data: {
        userId,
        subdomain,
        webPort,
        sshPort,
        sshPassword,
        containerName,
        ramLimit,
        cpuLimit,
        diskLimit,
        status: 'RUNNING'
      }
    })

    return instance
  } catch (error) {
    console.error('[ADMIN HELPER] Error al crear instancia, revirtiendo...', error)
    
    // Intentar limpiar en caso de fallo parcial
    try {
      await dockerService.deleteContainer(containerName)
    } catch (_) {}
    try {
      await nginxService.removeVhost(subdomain)
    } catch (_) {}

    throw error
  }
}

// ==========================================
// CLIENT CRUD
// ==========================================

// GET /api/admin/clients
async function getClients(req, res) {
  try {
    const clients = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        instance: {
          select: {
            id: true,
            subdomain: true,
            status: true,
            webPort: true,
            sshPort: true
          }
        }
      }
    })
    return res.status(200).json(clients)
  } catch (error) {
    console.error('[ADMIN CLIENTS] Error:', error)
    return res.status(500).json({ error: 'Error al obtener clientes.' })
  }
}

// POST /api/admin/clients
async function createClient(req, res) {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' })
    }

    const cleanUsername = username.trim().toLowerCase()

    if (!isValidSubdomain(cleanUsername)) {
      return res.status(400).json({ error: 'El nombre de usuario debe contener solo minúsculas, números y guiones, y servirá como subdominio.' })
    }

    // Verificar si el cliente ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email }
        ]
      }
    })

    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario o correo electrónico ya está registrado.' })
    }

    // Hash password para el panel
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email,
        password: hashedPassword,
        role: 'CLIENT'
      }
    })

    // Generar instancia automáticamente para el cliente
    console.log(`[ADMIN CLIENTS] Generando instancia automática para el usuario ${user.username}...`)
    let instance = null
    try {
      instance = await createInstanceHelper(user.id, user.username)
    } catch (instError) {
      // Si falla la creación de la instancia, eliminamos el usuario para mantener consistencia
      await prisma.user.delete({ where: { id: user.id } })
      return res.status(500).json({ error: `Fallo al inicializar la instancia Docker/Nginx: ${instError.message}` })
    }

    return res.status(201).json({
      message: 'Cliente creado con éxito junto a su instancia.',
      client: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      instance
    })
  } catch (error) {
    console.error('[ADMIN CLIENTS] Error en creación:', error)
    return res.status(500).json({ error: 'Error al crear cliente.' })
  }
}

// DELETE /api/admin/clients/:id
async function deleteClient(req, res) {
  try {
    const { id } = req.params

    const client = await prisma.user.findUnique({
      where: { id },
      include: { instance: true }
    })

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado.' })
    }

    // 1. Eliminar instancia si existe
    if (client.instance) {
      console.log(`[ADMIN CLIENTS] Eliminando recursos de la instancia para ${client.username}...`)
      // Eliminar contenedor Docker y archivos host
      await dockerService.deleteContainer(client.instance.containerName).catch(err => {
        console.error(`Error al eliminar contenedor ${client.instance.containerName}:`, err.message)
      })
      // Eliminar vhost Nginx
      await nginxService.removeVhost(client.instance.subdomain).catch(err => {
        console.error(`Error al eliminar vhost ${client.instance.subdomain}:`, err.message)
      })
    }

    // 2. Eliminar de la base de datos (con Cascade deletes en BD)
    await prisma.user.delete({ where: { id } })

    return res.status(200).json({ message: 'Cliente y sus recursos asociados eliminados con éxito.' })
  } catch (error) {
    console.error('[ADMIN CLIENTS] Error al eliminar:', error)
    return res.status(500).json({ error: 'Error al eliminar cliente y sus recursos.' })
  }
}

// ==========================================
// INSTANCE CRUD & MANAGEMENT
// ==========================================

// GET /api/admin/instances
async function getInstances(req, res) {
  try {
    const instances = await prisma.instance.findMany({
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        },
        sshKeys: true
      }
    })

    // Mapear y añadir estado en tiempo real
    const instancesWithStatus = await Promise.all(instances.map(async (inst) => {
      const realStatus = await dockerService.getContainerStatus(inst.containerName)
      
      // Si el estado en DB difiere del real, podemos sincronizarlo
      if (inst.status !== realStatus) {
        await prisma.instance.update({
          where: { id: inst.id },
          data: { status: realStatus }
        })
        inst.status = realStatus
      }

      return inst
    }))

    return res.status(200).json(instancesWithStatus)
  } catch (error) {
    console.error('[ADMIN INSTANCES] Error:', error)
    return res.status(500).json({ error: 'Error al obtener instancias.' })
  }
}

// POST /api/admin/instances (Creación manual de instancia)
async function createInstance(req, res) {
  try {
    const { userId, subdomain, ramLimit, cpuLimit, diskLimit } = req.body

    if (!userId || !subdomain) {
      return res.status(400).json({ error: 'userId y subdomain son obligatorios.' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { instance: true } })
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    if (user.instance) {
      return res.status(400).json({ error: 'El usuario ya tiene una instancia activa.' })
    }

    const instance = await createInstanceHelper(
      userId,
      subdomain.trim().toLowerCase(),
      ramLimit ? parseInt(ramLimit) : 512,
      cpuLimit ? parseFloat(cpuLimit) : 0.5,
      diskLimit ? parseInt(diskLimit) : 2048
    )

    return res.status(201).json({
      message: 'Instancia creada exitosamente.',
      instance
    })
  } catch (error) {
    console.error('[ADMIN INSTANCES] Error en creación manual:', error)
    return res.status(500).json({ error: error.message || 'Error al crear la instancia.' })
  }
}

// PATCH /api/admin/instances/:id (Editar límites de recursos)
async function updateInstanceLimits(req, res) {
  try {
    const { id } = req.params
    const { ramLimit, cpuLimit, diskLimit } = req.body

    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) {
      return res.status(404).json({ error: 'Instancia no encontrada.' })
    }

    const newRam = ramLimit ? parseInt(ramLimit) : instance.ramLimit
    const newCpu = cpuLimit ? parseFloat(cpuLimit) : instance.cpuLimit
    const newDisk = diskLimit ? parseInt(diskLimit) : instance.diskLimit

    // Actualizar límites en Docker
    console.log(`[ADMIN INSTANCES] Actualizando límites de docker para ${instance.containerName}...`)
    await dockerService.updateContainerLimits(instance.containerName, {
      ramLimit: newRam,
      cpuLimit: newCpu
    })

    // Actualizar en BD
    const updatedInstance = await prisma.instance.update({
      where: { id },
      data: {
        ramLimit: newRam,
        cpuLimit: newCpu,
        diskLimit: newDisk
      }
    })

    return res.status(200).json({
      message: 'Límites de recursos actualizados exitosamente.',
      instance: updatedInstance
    })
  } catch (error) {
    console.error('[ADMIN INSTANCES] Error actualizando límites:', error)
    return res.status(500).json({ error: 'Error al actualizar límites de la instancia.' })
  }
}

// DELETE /api/admin/instances/:id (Eliminar instancia)
async function deleteInstance(req, res) {
  try {
    const { id } = req.params

    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) {
      return res.status(404).json({ error: 'Instancia no encontrada.' })
    }

    console.log(`[ADMIN INSTANCES] Eliminando recursos asociados a la instancia de ${instance.subdomain}...`)
    // 1. Eliminar Docker y vhost
    await dockerService.deleteContainer(instance.containerName).catch(err => {
      console.error('Error delete container:', err.message)
    })
    await nginxService.removeVhost(instance.subdomain).catch(err => {
      console.error('Error remove vhost:', err.message)
    })

    // 2. Eliminar registro BD
    await prisma.instance.delete({ where: { id } })

    return res.status(200).json({ message: 'Instancia y sus recursos eliminados con éxito.' })
  } catch (error) {
    console.error('[ADMIN INSTANCES] Error al eliminar:', error)
    return res.status(500).json({ error: 'Error al eliminar la instancia.' })
  }
}

// POST /api/admin/instances/:id/start
async function startInstance(req, res) {
  try {
    const { id } = req.params
    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    await dockerService.startContainer(instance.containerName)
    
    const updated = await prisma.instance.update({
      where: { id },
      data: { status: 'RUNNING' }
    })

    return res.status(200).json({ message: 'Instancia iniciada.', status: 'RUNNING' })
  } catch (error) {
    console.error('[ADMIN INSTANCE START] Error:', error)
    return res.status(500).json({ error: 'Error al iniciar la instancia.' })
  }
}

// POST /api/admin/instances/:id/stop
async function stopInstance(req, res) {
  try {
    const { id } = req.params
    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    await dockerService.stopContainer(instance.containerName)
    
    const updated = await prisma.instance.update({
      where: { id },
      data: { status: 'STOPPED' }
    })

    return res.status(200).json({ message: 'Instancia detenida.', status: 'STOPPED' })
  } catch (error) {
    console.error('[ADMIN INSTANCE STOP] Error:', error)
    return res.status(500).json({ error: 'Error al detener la instancia.' })
  }
}

// POST /api/admin/instances/:id/restart
async function restartInstance(req, res) {
  try {
    const { id } = req.params
    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    await dockerService.restartContainer(instance.containerName)
    
    const updated = await prisma.instance.update({
      where: { id },
      data: { status: 'RUNNING' }
    })

    return res.status(200).json({ message: 'Instancia reiniciada.', status: 'RUNNING' })
  } catch (error) {
    console.error('[ADMIN INSTANCE RESTART] Error:', error)
    return res.status(500).json({ error: 'Error al reiniciar la instancia.' })
  }
}

// GET /api/admin/instances/:id/stats
async function getInstanceStats(req, res) {
  try {
    const { id } = req.params
    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    const stats = await dockerService.getStats(instance.containerName)
    return res.status(200).json({
      ...stats,
      diskLimit: instance.diskLimit
    })
  } catch (error) {
    console.error('[ADMIN INSTANCE STATS] Error:', error)
    return res.status(500).json({ error: 'Error al obtener estadísticas.' })
  }
}

// GET /api/admin/instances/:id/ssh-info
async function getInstanceSSHInfo(req, res) {
  try {
    const { id } = req.params
    const instance = await prisma.instance.findUnique({ where: { id } })
    if (!instance) return res.status(404).json({ error: 'Instancia no encontrada.' })

    return res.status(200).json({
      host: process.env.DOMAIN || 'moondev.online',
      sshPort: instance.sshPort,
      password: instance.sshPassword,
      username: 'root'
    })
  } catch (error) {
    console.error('[ADMIN INSTANCE SSH-INFO] Error:', error)
    return res.status(500).json({ error: 'Error al obtener información SSH.' })
  }
}

// DELETE /api/admin/instances/:id/ssh-keys/:keyId
async function deleteSSHKey(req, res) {
  try {
    const { id, keyId } = req.params
    const key = await prisma.sSHKey.findFirst({
      where: {
        id: keyId,
        instanceId: id
      },
      include: {
        instance: true
      }
    })

    if (!key) {
      return res.status(404).json({ error: 'Llave SSH no encontrada.' })
    }

    // Remover del contenedor Docker
    console.log(`[ADMIN SSH-KEYS] Eliminando llave de contenedor ${key.instance.containerName}...`)
    await dockerService.removeSSHKeyFromContainer(key.instance.containerName, key.publicKey).catch(err => {
      console.error('Error al remover llave del contenedor:', err.message)
    })

    // Eliminar de base de datos
    await prisma.sSHKey.delete({ where: { id: keyId } })

    return res.status(200).json({ message: 'Llave SSH eliminada con éxito.' })
  } catch (error) {
    console.error('[ADMIN DELETE SSH-KEY] Error:', error)
    return res.status(500).json({ error: 'Error al eliminar llave SSH.' })
  }
}

module.exports = {
  getClients,
  createClient,
  deleteClient,
  getInstances,
  createInstance,
  updateInstanceLimits,
  deleteInstance,
  startInstance,
  stopInstance,
  restartInstance,
  getInstanceStats,
  getInstanceSSHInfo,
  deleteSSHKey
}
