const Docker = require('dockerode')
const fs = require('fs')
const path = require('path')
const { exec, execSync } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

// Verificar y construir la imagen base si no existe
async function buildBaseImage() {
  try {
    const images = await docker.listImages()
    const imageTag = 'moonpanel-client-base:latest'
    const exists = images.some(img => img.RepoTags && img.RepoTags.includes(imageTag))

    if (!exists) {
      console.log(`[DOCKER] Imagen base '${imageTag}' no encontrada. Iniciando compilación...`)
      // El Dockerfile está en backend/docker/Dockerfile.client
      const dockerfilePath = path.join(__dirname, '../../docker/Dockerfile.client')
      const dockerfileDir = path.join(__dirname, '../../docker')
      
      // Comando para construir
      await execPromise(`docker build -t ${imageTag} -f "${dockerfilePath}" "${dockerfileDir}"`)
      console.log(`[DOCKER] Imagen base '${imageTag}' construida con éxito.`)
    } else {
      console.log(`[DOCKER] Imagen base '${imageTag}' ya existe.`)
    }
  } catch (error) {
    console.error('[DOCKER] Error al verificar/compilar imagen base:', error)
    throw error
  }
}

// Crear container para un cliente
async function createContainer({ containerName, webPort, sshPort, dbPort, ramLimit, cpuLimit, sshPassword, database, dbPassword }) {
  // Asegurarnos de que el directorio del cliente existe en el host
  const hostDir = `/home/clients/${containerName}`
  if (!fs.existsSync(hostDir)) {
    fs.mkdirSync(hostDir, { recursive: true })
  }

  const portBindings = {
    '3000/tcp': [{ HostPort: String(webPort) }],
    '22/tcp':   [{ HostPort: String(sshPort) }]
  }

  const env = [
    `DB_PASSWORD=${dbPassword || ''}`,
    `ENABLE_POSTGRES=${database === 'POSTGRES' ? 'true' : 'false'}`,
    `ENABLE_MYSQL=${database === 'MYSQL' ? 'true' : 'false'}`
  ]

  // Exponer puerto de BD si aplica
  if (database !== 'NONE' && dbPort) {
    const internalPort = database === 'POSTGRES' ? '5432/tcp' : '3306/tcp'
    portBindings[internalPort] = [{ HostPort: String(dbPort) }]
  }

  const container = await docker.createContainer({
    name: containerName,
    Image: 'moonpanel-client-base:latest',
    Tty: true,
    OpenStdin: true,
    Env: env,
    HostConfig: {
      Memory: ramLimit * 1024 * 1024,
      MemorySwap: ramLimit * 1024 * 1024 * 2, // 2x RAM
      CpuQuota: Math.floor(cpuLimit * 100000),
      CpuPeriod: 100000,
      PortBindings: portBindings,
      RestartPolicy: { Name: 'unless-stopped' },
      Binds: [`${hostDir}:/app`]
    },
    WorkingDir: '/app'
  })

  await container.start()

  // Setear contraseña root de forma segura usando variable de entorno
  // en vez de interpolar directamente en el comando (BUG-02)
  const execObj = await container.exec({
    Cmd: ['bash', '-c', 'echo "root:$SSH_PASS" | chpasswd'],
    Env: [`SSH_PASS=${sshPassword}`],
    AttachStdout: true,
    AttachStderr: true
  })
  const stream = await execObj.start({ hijack: true, stdin: false })
  
  // Esperar a que el comando termine
  await new Promise((resolve, reject) => {
    docker.modem.demuxStream(stream, process.stdout, process.stderr)
    stream.on('end', resolve)
    stream.on('error', reject)
  })

  return container
}

// Ejecutar comando dentro del contenedor
async function execInContainer(containerName, command) {
  try {
    const container = docker.getContainer(containerName)
    const execObj = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    })
    const stream = await execObj.start({ hijack: true, stdin: false })
    
    const output = await new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      docker.modem.demuxStream(stream, {
        write: (chunk) => { stdout += chunk.toString() }
      }, {
        write: (chunk) => { stderr += chunk.toString() }
      })
      stream.on('end', () => {
        resolve(stdout + stderr)
      })
      stream.on('error', reject)
    })

    const inspectData = await execObj.inspect()
    if (inspectData.ExitCode !== 0) {
      throw new Error(`Command failed with exit code ${inspectData.ExitCode}. Output:\n${output}`)
    }

    return output
  } catch (error) {
    console.error(`[DOCKER EXEC ERROR] en contenedor ${containerName}:`, error.message)
    throw error
  }
}

// Iniciar container (idempotente: no falla si ya está corriendo)
async function startContainer(containerName) {
  try {
    const container = docker.getContainer(containerName)
    await container.start()
  } catch (error) {
    // Docker API retorna 304 si el contenedor ya está corriendo
    if (error.statusCode === 304) return
    throw error
  }
}

// Detener container (idempotente: no falla si ya está detenido)
async function stopContainer(containerName) {
  try {
    const container = docker.getContainer(containerName)
    await container.stop()
  } catch (error) {
    // Docker API retorna 304 si el contenedor ya está detenido
    if (error.statusCode === 304) return
    throw error
  }
}

// Reiniciar container
async function restartContainer(containerName) {
  const container = docker.getContainer(containerName)
  await container.restart()
}

// Eliminar container
async function deleteContainer(containerName, deleteHostDir = true) {
  try {
    const container = docker.getContainer(containerName)
    // Detener primero si está corriendo (forzar parada si es necesario)
    await container.stop().catch(() => {})
    await container.remove().catch(() => {})

    // Eliminar el directorio del cliente
    if (deleteHostDir) {
      const hostDir = `/home/clients/${containerName}`
      if (fs.existsSync(hostDir)) {
        fs.rmSync(hostDir, { recursive: true, force: true })
      }
    }
  } catch (error) {
    console.error(`[DOCKER] Error al eliminar contenedor ${containerName}:`, error)
    throw error
  }
}

// Editar límites de recursos de un container
async function updateContainerLimits(containerName, { ramLimit, cpuLimit }) {
  const container = docker.getContainer(containerName)
  await container.update({
    Memory: ramLimit * 1024 * 1024,
    MemorySwap: ramLimit * 1024 * 1024 * 2, // 2x RAM
    CpuQuota: Math.floor(cpuLimit * 100000),
    CpuPeriod: 100000
  })
}

// Obtener stats en tiempo real
async function getStats(containerName) {
  let diskUsed = 0
  const hostDir = `/home/clients/${containerName}`
  if (fs.existsSync(hostDir)) {
    try {
      const stdout = execSync(`du -sm "${hostDir}"`).toString()
      diskUsed = parseInt(stdout.split('\t')[0]) || 0
    } catch (err) {
      console.error(`[DOCKER] Error al calcular espacio en disco de ${containerName}:`, err.message)
    }
  }

  try {
    const container = docker.getContainer(containerName)
    const stats = await container.stats({ stream: false })
    
    // Calcular CPU %
    let cpuPercent = 0.0
    if (stats.cpu_stats && stats.precpu_stats) {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
      if (systemDelta > 0 && cpuDelta > 0) {
        cpuPercent = (cpuDelta / systemDelta) * 100
      }
    }

    // Calcular RAM
    let ramUsed = 0
    let ramLimit = 0
    if (stats.memory_stats) {
      ramUsed = stats.memory_stats.usage || 0
      ramLimit = stats.memory_stats.limit || 0
    }

    return {
      cpu: cpuPercent.toFixed(2),
      ramUsed: Math.round(ramUsed / 1024 / 1024),
      ramLimit: Math.round(ramLimit / 1024 / 1024),
      diskUsed
    }
  } catch (error) {
    console.error(`[DOCKER] Error al obtener estadísticas de ${containerName}:`, error)
    // Devolver valores por defecto en caso de error (por ejemplo, si el container está detenido)
    return {
      cpu: "0.00",
      ramUsed: 0,
      ramLimit: 0,
      diskUsed
    }
  }
}

// Agregar SSH key dentro del container de forma segura (BUG-01: sin interpolación de shell)
async function addSSHKeyToContainer(containerName, publicKey) {
  const container = docker.getContainer(containerName)
  // Codificar la llave en base64 para evitar inyección de comandos
  const b64Key = Buffer.from(publicKey).toString('base64')
  const execObj = await container.exec({
    Cmd: ['bash', '-c', `mkdir -p /root/.ssh && echo "$SSH_KEY_B64" | base64 -d >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && chmod 700 /root/.ssh`],
    Env: [`SSH_KEY_B64=${b64Key}`],
    AttachStdout: true,
    AttachStderr: true
  })
  const stream = await execObj.start({ hijack: true, stdin: false })
  await new Promise((resolve, reject) => {
    docker.modem.demuxStream(stream, process.stdout, process.stderr)
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

// Eliminar SSH key dentro del container (BUG-18: verifica existencia del archivo)
async function removeSSHKeyFromContainer(containerName, publicKey) {
  const container = docker.getContainer(containerName)
  const b64Key = Buffer.from(publicKey).toString('base64')
  const execObj = await container.exec({
    Cmd: ['bash', '-c', 'if [ -f /root/.ssh/authorized_keys ]; then grep -vF "$(echo "$SSH_KEY_B64" | base64 -d)" /root/.ssh/authorized_keys > /tmp/ak_tmp && mv /tmp/ak_tmp /root/.ssh/authorized_keys; fi'],
    Env: [`SSH_KEY_B64=${b64Key}`],
    AttachStdout: true,
    AttachStderr: true
  })
  const stream = await execObj.start({ hijack: true, stdin: false })
  await new Promise((resolve, reject) => {
    docker.modem.demuxStream(stream, process.stdout, process.stderr)
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

// Obtener estado del contenedor (RUNNING, STOPPED, ERROR)
async function getContainerStatus(containerName) {
  try {
    const container = docker.getContainer(containerName)
    const data = await container.inspect()
    if (data.State.Running) {
      return 'RUNNING'
    } else {
      return 'STOPPED'
    }
  } catch (error) {
    if (error.statusCode === 404) {
      return 'STOPPED' // O no existe
    }
    return 'ERROR'
  }
}

module.exports = {
  buildBaseImage,
  createContainer,
  startContainer,
  stopContainer,
  restartContainer,
  deleteContainer,
  updateContainerLimits,
  getStats,
  addSSHKeyToContainer,
  removeSSHKeyFromContainer,
  getContainerStatus,
  execInContainer
}
