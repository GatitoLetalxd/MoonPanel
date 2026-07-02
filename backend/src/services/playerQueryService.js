// backend/src/services/playerQueryService.js
const dgram = require('dgram')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

/**
 * Valheim — Steam A2S_INFO protocol (UDP)
 * Retorna cantidad de jugadores y versión en ejecución
 */
async function getValheimDetailsFromLogs(containerId) {
  try {
    const container = docker.getContainer(containerId)
    const state = await container.inspect()
    
    if (!state.State.Running) {
      return { players: -1, version: null }
    }

    const startedAtEpoch = Math.floor(new Date(state.State.StartedAt).getTime() / 1000)
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      since: startedAtEpoch,
      tail: 1000,
      timestamps: false
    })
    
    let cleanLogs = ''
    let offset = 0
    while (offset < logBuffer.length) {
      if (offset + 8 > logBuffer.length) break
      const size = logBuffer.readUInt32BE(offset + 4)
      if (offset + 8 + size > logBuffer.length) break
      const chunk = logBuffer.slice(offset + 8, offset + 8 + size).toString('utf8')
      cleanLogs += chunk
      offset += 8 + size
    }
    if (!cleanLogs.trim() && logBuffer.length > 0) {
      cleanLogs = logBuffer.toString('utf8')
    }

    let version = null
    const versionMatch = cleanLogs.match(/Valheim version:\s*([^\s\n]+)/)
    if (versionMatch) {
      version = versionMatch[1]
    }

    const lines = cleanLogs.split('\n')
    const activeClients = new Set()

    for (const line of lines) {
      const connectMatch = line.match(/Got connection SteamID\s+(\d+)/) || line.match(/Got handshake from client\s+(\d+)/)
      if (connectMatch) {
        activeClients.add(connectMatch[1])
      }
      const disconnectMatch = line.match(/Closing socket\s+(\d+)/)
      if (disconnectMatch) {
        activeClients.delete(disconnectMatch[1])
      }
    }

    return {
      players: activeClients.size,
      version
    }
  } catch (err) {
    console.error('[LogsQuery] Failed to query Valheim details from logs:', err.message)
    return { players: -1, version: null }
  }
}

async function queryValheimDetails(host, port, containerId, timeoutMs = 3000) {
  const udpRes = await new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    const request = Buffer.from([
      0xFF, 0xFF, 0xFF, 0xFF, 0x54,
      0x53, 0x6F, 0x75, 0x72, 0x63,
      0x65, 0x20, 0x45, 0x6E, 0x67,
      0x69, 0x6E, 0x65, 0x20, 0x51,
      0x75, 0x65, 0x72, 0x79, 0x00
    ])

    const timer = setTimeout(() => { client.close(); resolve({ players: -1, version: null }) }, timeoutMs)

    client.on('message', (msg) => {
      clearTimeout(timer)
      client.close()
      try {
        let offset = 4 // skip 0xFFFFFFFF
        const header = msg.readUInt8(offset)
        if (header !== 0x49) { // 'I'
          resolve({ players: -1, version: null })
          return
        }
        offset += 1 // skip header
        offset += 1 // skip protocol
        
        function readString() {
          const start = offset
          while (offset < msg.length && msg[offset] !== 0) {
            offset++
          }
          const str = msg.toString('utf8', start, offset)
          offset++ // skip null terminator
          return str
        }

        readString() // name
        readString() // map
        readString() // folder
        readString() // game

        offset += 2 // appid
        const players = msg.readUInt8(offset)
        offset += 1
        const maxPlayers = msg.readUInt8(offset)
        offset += 1
        const bots = msg.readUInt8(offset)
        offset += 1
        offset += 4 // type, env, visibility, vac

        const version = readString()
        resolve({ players, version })
      } catch {
        try {
          const players = msg.readUInt8(24)
          resolve({ players, version: null })
        } catch {
          resolve({ players: -1, version: null })
        }
      }
    })

    client.on('error', () => { clearTimeout(timer); client.close(); resolve({ players: -1, version: null }) })
    client.send(request, port, host)
  })

  if (udpRes.players === -1 && containerId) {
    return await getValheimDetailsFromLogs(containerId)
  }

  return udpRes
}

/**
 * Minecraft Bedrock — RakNet unconnected ping (UDP)
 * Retorna cantidad de jugadores y versión en ejecución
 */
async function queryMinecraftBedrockDetails(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    const ping = Buffer.alloc(25)
    ping[0] = 0x01
    ping.writeBigInt64BE(BigInt(Date.now()), 1)
    Buffer.from([
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78
    ]).copy(ping, 9)

    const timer = setTimeout(() => { client.close(); resolve({ players: -1, version: null }) }, timeoutMs)

    client.on('message', (msg) => {
      clearTimeout(timer)
      client.close()
      try {
        const motd = msg.slice(35).toString('utf8')
        const parts = motd.split(';')
        const version = parts[3] || null
        const players = parseInt(parts[4] ?? '0', 10)
        resolve({
          players: isNaN(players) ? 0 : players,
          version
        })
      } catch {
        resolve({ players: -1, version: null })
      }
    })

    client.on('error', () => { clearTimeout(timer); client.close(); resolve({ players: -1, version: null }) })
    client.send(ping, port, host)
  })
}

/**
 * Dispatcher: elige el método correcto según gameType
 */
async function queryPlayers(gameType, port, containerId) {
  if (gameType === 'valheim') {
    const res = await queryValheimDetails('localhost', port, containerId)
    return res.players
  }
  if (gameType === 'minecraft') {
    const res = await queryMinecraftBedrockDetails('localhost', port)
    return res.players
  }
  return -1
}

module.exports = {
  queryValheimDetails,
  queryMinecraftBedrockDetails,
  queryPlayers
}
