const prisma = require('../lib/prisma')
const bcrypt = require('bcryptjs')
const generator = require('generate-password')
const dockerService = require('../services/dockerService')
const nginxService = require('../services/nginxService')

// Validar que el subdominio solo contenga minúsculas, números y guiones
function isValidSubdomain(subdomain) {
  // No permite guiones al inicio o final (DNS-inválido, rompe Nginx/Certbot)
  const regex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
  return regex.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 30
}

// Obtener puertos disponibles de forma automática
async function getNextAvailablePorts() {
  const instances = await prisma.instance.findMany({ select: { webPort: true, sshPort: true, dbPort: true } })
  const usedWeb = new Set(instances.map(i => i.webPort))
  const usedSsh = new Set(instances.map(i => i.sshPort))
  const usedDb = new Set(instances.filter(i => i.dbPort).map(i => i.dbPort))

  // Máximo 99 instancias
  if (instances.length >= 99) {
    throw new Error('Límite de 99 instancias alcanzado.')
  }

  // Buscar primer webPort libre
  let webPort = null
  for (let p = 3010; p < 4500; p++) {
    if (!usedWeb.has(p)) {
      webPort = p
      break
    }
  }

  // Buscar primer sshPort libre
  let sshPort = null
  for (let p = 2210; p < 3000; p++) {
    if (!usedSsh.has(p)) {
      sshPort = p
      break
    }
  }

  // Buscar primer dbPort libre
  let dbPort = null
  for (let p = 5440; p < 6000; p++) {
    if (!usedDb.has(p)) {
      dbPort = p
      break
    }
  }

  if (!webPort || !sshPort) {
    throw new Error('No hay puertos disponibles en el rango asignado.')
  }

  return { webPort, sshPort, dbPort }
}

// Obtener siguiente subdominio vmiXX correlativo
async function getNextAvailableSubdomain() {
  const instances = await prisma.instance.findMany({
    select: { subdomain: true }
  })
  const subdomains = new Set(instances.map(i => i.subdomain))

  for (let i = 1; i <= 99; i++) {
    const formattedNum = String(i).padStart(2, '0') // "01", "02", ...
    const sub = `vmi${formattedNum}`
    if (!subdomains.has(sub)) {
      return sub
    }
  }
  throw new Error('Límite de subdominios vmiXX alcanzado (1-99).')
}

// Helper para crear instancia en estado PENDING
async function createInstanceHelper(userId, subdomain, mode = 'SSH', database = 'NONE', ramLimit = 512, cpuLimit = 0.5, diskLimit = 2048) {
  if (!isValidSubdomain(subdomain)) {
    throw new Error('Subdominio inválido. Solo se permiten letras minúsculas, números y guiones (3-30 caracteres).')
  }

  // Verificar si ya existe el subdominio
  const existingSub = await prisma.instance.findUnique({ where: { subdomain } })
  if (existingSub) {
    throw new Error('El subdominio ya está en uso.')
  }

  // Obtener puertos
  const { webPort, sshPort, dbPort } = await getNextAvailablePorts()

  // Generar password SSH temporal
  const sshPassword = generator.generate({
    length: 12,
    numbers: true,
    uppercase: true,
    symbols: false
  })

  // Generar password de BD si se solicita base de datos
  let dbPassword = null
  if (database !== 'NONE') {
    dbPassword = generator.generate({
      length: 16,
      numbers: true,
      uppercase: true,
      symbols: false
    })
  }

  const containerName = `mp-client-${subdomain}`

  // Crear registro en BD en estado PENDING (sin lanzar Docker ni Nginx todavía)
  const instance = await prisma.instance.create({
    data: {
      userId,
      subdomain,
      webPort,
      sshPort,
      dbPort: database !== 'NONE' ? dbPort : null,
      sshPassword,
      dbPassword,
      containerName,
      ramLimit,
      cpuLimit,
      diskLimit,
      mode,
      database,
      status: 'PENDING'
    }
  })

  return instance
}

// Helper para realizar el lanzamiento físico (Docker + Nginx) de una instancia PENDING
async function launchInstanceHelper(instanceId) {
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } })
  if (!instance) {
    throw new Error('Instancia no encontrada.')
  }

  if (instance.status !== 'PENDING') {
    throw new Error('La instancia ya ha sido lanzada.')
  }

  // Actualizar estado a CREATING en base de datos
  await prisma.instance.update({
    where: { id: instanceId },
    data: { status: 'CREATING' }
  })

  try {
    // 1. Crear contenedor docker
    console.log(`[LAUNCH HELPER] Creando contenedor ${instance.containerName}...`)
    await dockerService.createContainer({
      containerName: instance.containerName,
      webPort: instance.webPort,
      sshPort: instance.sshPort,
      dbPort: instance.dbPort,
      ramLimit: instance.ramLimit,
      cpuLimit: instance.cpuLimit,
      sshPassword: instance.sshPassword,
      database: instance.database,
      dbPassword: instance.dbPassword
    })

    // 2. Crear configuración de Nginx (vhost)
    console.log(`[LAUNCH HELPER] Creando vhost Nginx para ${instance.subdomain}...`)
    await nginxService.createVhost(instance.subdomain, instance.webPort)

    // Actualizar estado a RUNNING en base de datos
    const updated = await prisma.instance.update({
      where: { id: instanceId },
      data: { status: 'RUNNING' }
    })

    return updated
  } catch (error) {
    console.error('[LAUNCH HELPER] Error al lanzar instancia, revirtiendo...', error)

    // Revertir a PENDING
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: 'PENDING' }
    })

    // Limpiar en caso de fallo parcial
    try {
      await dockerService.deleteContainer(instance.containerName)
    } catch (_) {}
    try {
      await nginxService.removeVhost(instance.subdomain)
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
        instances: {
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
    const { username, email, password, mode, database } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' })
    }

    const cleanUsername = username.trim().toLowerCase()

    if (!isValidSubdomain(cleanUsername)) {
      return res.status(400).json({ error: 'El nombre de usuario debe contener solo minúsculas, números y guiones.' })
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
      const subdomain = await getNextAvailableSubdomain()
      instance = await createInstanceHelper(user.id, subdomain, mode || 'SSH', database || 'NONE')
    } catch (instError) {
      // Si falla la creación de la instancia, eliminamos el usuario para mantener consistencia
      await prisma.user.delete({ where: { id: user.id } })
      return res.status(500).json({ error: `Fallo al inicializar la instancia: ${instError.message}` })
    }

    return res.status(201).json({
      message: 'Cliente creado con éxito junto a su instancia reservada.',
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
      include: { instances: true }
    })

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado.' })
    }

    // 1. Eliminar instancias si existen y fueron lanzadas
    if (client.instances && client.instances.length > 0) {
      for (const inst of client.instances) {
        if (inst.status !== 'PENDING') {
          console.log(`[ADMIN CLIENTS] Eliminando recursos de la instancia ${inst.subdomain}...`)
          // Eliminar contenedor Docker y archivos host
          await dockerService.deleteContainer(inst.containerName).catch(err => {
            console.error(`Error al eliminar contenedor ${inst.containerName}:`, err.message)
          })
          // Eliminar vhost Nginx
          await nginxService.removeVhost(inst.subdomain).catch(err => {
            console.error(`Error al eliminar vhost ${inst.subdomain}:`, err.message)
          })
        }
      }
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
      if (inst.status === 'PENDING' || inst.status === 'CREATING') {
        return inst
      }

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
    const { userId, subdomain, mode, database, ramLimit, cpuLimit, diskLimit } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId es obligatorio.' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { instances: true } })
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    if (user.instances && user.instances.length >= 10) {
      return res.status(400).json({ error: 'El usuario ya cuenta con el límite de 10 instancias activas.' })
    }

    let finalSubdomain = subdomain ? subdomain.trim().toLowerCase() : ''
    if (!finalSubdomain || finalSubdomain === 'auto') {
      try {
        finalSubdomain = await getNextAvailableSubdomain()
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    const instance = await createInstanceHelper(
      userId,
      finalSubdomain,
      mode || 'SSH',
      database || 'NONE',
      ramLimit ? parseInt(ramLimit) : 512,
      cpuLimit ? parseFloat(cpuLimit) : 0.5,
      diskLimit ? parseInt(diskLimit) : 2048
    )

    return res.status(201).json({
      message: 'Instancia creada exitosamente en estado reservado.',
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

    // Actualizar límites en Docker si no es PENDING
    if (instance.status !== 'PENDING') {
      console.log(`[ADMIN INSTANCES] Actualizando límites de docker para ${instance.containerName}...`)
      await dockerService.updateContainerLimits(instance.containerName, {
        ramLimit: newRam,
        cpuLimit: newCpu
      })
    }

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

    if (instance.status !== 'PENDING') {
      console.log(`[ADMIN INSTANCES] Eliminando recursos asociados a la instancia de ${instance.subdomain}...`)
      // 1. Eliminar Docker y vhost
      await dockerService.deleteContainer(instance.containerName).catch(err => {
        console.error('Error delete container:', err.message)
      })
      await nginxService.removeVhost(instance.subdomain).catch(err => {
        console.error('Error remove vhost:', err.message)
      })
    }

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

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'La instancia no ha sido lanzada aún.' })
    }

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

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'La instancia no ha sido lanzada aún.' })
    }

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

    if (instance.status === 'PENDING') {
      return res.status(400).json({ error: 'La instancia no ha sido lanzada aún.' })
    }

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

    if (key.instance.status !== 'PENDING') {
      // Remover del contenedor Docker
      console.log(`[ADMIN SSH-KEYS] Eliminando llave de contenedor ${key.instance.containerName}...`)
      await dockerService.removeSSHKeyFromContainer(key.instance.containerName, key.publicKey).catch(err => {
        console.error('Error al remover llave del contenedor:', err.message)
      })
    }

    // Eliminar de base de datos
    await prisma.sSHKey.delete({ where: { id: keyId } })

    return res.status(200).json({ message: 'Llave SSH eliminada con éxito.' })
  } catch (error) {
    console.error('[ADMIN DELETE SSH-KEY] Error:', error)
    return res.status(500).json({ error: 'Error al eliminar llave SSH.' })
  }
}

// POST /api/admin/instances/:id/force-launch
async function forceLaunchInstance(req, res) {
  try {
    const { id } = req.params
    const updated = await launchInstanceHelper(id)
    return res.status(200).json({ message: 'Instancia lanzada exitosamente.', instance: updated })
  } catch (error) {
    console.error('[ADMIN FORCE-LAUNCH] Error:', error)
    return res.status(500).json({ error: error.message || 'Error al lanzar la instancia.' })
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
  deleteSSHKey,
  launchInstanceHelper,
  forceLaunchInstance
}
