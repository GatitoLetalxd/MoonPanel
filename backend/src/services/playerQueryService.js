// backend/src/services/playerQueryService.js
const dgram = require('dgram')

/**
 * Valheim — Steam A2S_INFO protocol (UDP)
 * Retorna cantidad de jugadores o -1 si timeout/error
 */
async function queryValheimPlayers(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    const request = Buffer.from([
      0xFF, 0xFF, 0xFF, 0xFF, 0x54,
      0x53, 0x6F, 0x75, 0x72, 0x63,
      0x65, 0x20, 0x45, 0x6E, 0x67,
      0x69, 0x6E, 0x65, 0x20, 0x51,
      0x75, 0x65, 0x72, 0x79, 0x00
    ])

    const timer = setTimeout(() => { client.close(); resolve(-1) }, timeoutMs)

    client.on('message', (msg) => {
      clearTimeout(timer)
      client.close()
      try {
        resolve(msg.readUInt8(24)) // player count en offset 24
      } catch { resolve(-1) }
    })

    client.on('error', () => { clearTimeout(timer); client.close(); resolve(-1) })
    client.send(request, port, host)
  })
}

/**
 * Minecraft Bedrock — RakNet unconnected ping (UDP)
 * Retorna cantidad de jugadores o -1 si timeout/error
 */
async function queryMinecraftBedrockPlayers(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    const ping = Buffer.alloc(25)
    ping[0] = 0x01
    ping.writeBigInt64BE(BigInt(Date.now()), 1)
    Buffer.from([
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78
    ]).copy(ping, 9)

    const timer = setTimeout(() => { client.close(); resolve(-1) }, timeoutMs)

    client.on('message', (msg) => {
      clearTimeout(timer)
      client.close()
      try {
        const motd = msg.slice(35).toString('utf8')
        const players = parseInt(motd.split(';')[4] ?? '0', 10)
        resolve(isNaN(players) ? 0 : players)
      } catch { resolve(-1) }
    })

    client.on('error', () => { clearTimeout(timer); client.close(); resolve(-1) })
    client.send(ping, port, host)
  })
}

/**
 * Dispatcher: elige el método correcto según gameType
 */
async function queryPlayers(gameType, port) {
  if (gameType === 'valheim')   return queryValheimPlayers('localhost', port)
  if (gameType === 'minecraft') return queryMinecraftBedrockPlayers('localhost', port)
  return -1
}

module.exports = {
  queryValheimPlayers,
  queryMinecraftBedrockPlayers,
  queryPlayers
}
