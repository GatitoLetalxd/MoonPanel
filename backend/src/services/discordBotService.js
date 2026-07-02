// backend/src/services/discordBotService.js
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const prisma = require('../lib/prisma.js')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const { resetGameTracker } = require('./gameScheduler.js')
const { queryPlayers, queryMinecraftBedrockDetails, queryValheimDetails } = require('./playerQueryService.js')
const { getProperties } = require('./gameFileService.js')
const { saveLevelDatFields } = require('./levelDatService.js')
const { getGamerules } = require('./gameFileService.js')

let client = null
let updateInterval = null

// Setup helper for level.dat sync
async function syncSettingsPropertiesToLevelDat(containerName) {
  try {
    const props = await getProperties(containerName)
    const updates = {}
    if (props && props.difficulty) {
      const difficultyMap = { peaceful: 0, easy: 1, normal: 2, hard: 3 }
      const diffVal = difficultyMap[props.difficulty.toLowerCase()]
      if (diffVal !== undefined) updates.Difficulty = diffVal
    }
    if (props && props.gamemode) {
      const gamemodeMap = { survival: 0, creative: 1, adventure: 2, spectator: 3 }
      const gamemodeVal = gamemodeMap[props.gamemode.toLowerCase()]
      if (gamemodeVal !== undefined) updates.GameType = gamemodeVal
    }
    if (Object.keys(updates).length > 0) {
      await saveLevelDatFields(containerName, updates)
      console.log(`[Discord Bot Sync] Synced properties for ${containerName}`)
    }
  } catch (err) {
    console.log(`[Discord Bot Sync] Failed to sync properties for ${containerName}:`, err.message)
  }
}

// Setup helper for Minecraft gamerules on startup
async function applyStartupGamerules(instance) {
  try {
    const rules = await getGamerules(instance.containerName)
    const container = docker.getContainer(instance.containerId)
    for (const [rule, value] of Object.entries(rules)) {
      const execObj = await container.exec({
        Cmd: ['send-command', `gamerule ${rule} ${value}`],
        AttachStdout: false,
        AttachStderr: false
      })
      const stream = await execObj.start({ hijack: true, stdin: false })
      await new Promise(r => setTimeout(r, 200))
    }
    console.log(`[Discord Bot Gamerules] Startup rules applied for ${instance.containerName}`)
  } catch (err) {
    console.error(`[Discord Bot Gamerules] Failed to apply startup rules:`, err.message)
  }
}

async function startDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN
  const mcChannelId = process.env.DISCORD_MINECRAFT_CHANNEL_ID
  const vhChannelId = process.env.DISCORD_VALHEIM_CHANNEL_ID

  if (!token) {
    console.log('[DiscordBot] Bot token missing in .env. Bot disabled.')
    return
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  })

  client.once('ready', () => {
    console.log(`[DiscordBot] Bot conectado como ${client.user.tag}`)
    
    // Start periodic status sync
    if (updateInterval) clearInterval(updateInterval)
    updateInterval = setInterval(updateStatusBoards, 15000)
    
    // Perform immediate status sync
    updateStatusBoards()
  })

  // Handle Button Clicks
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return

    // Defer response immediately to avoid Discord's 3-second timeout limit
    try {
      await interaction.deferUpdate()
    } catch (_) {}

    const [action, gameType, instanceIdStr] = interaction.customId.split('_')
    const instanceId = parseInt(instanceIdStr, 10)

    try {
      // Find instance
      const instance = await prisma.gameInstance.findUnique({
        where: { id: instanceId }
      })

      if (!instance) {
        return interaction.followUp({ content: '❌ Instancia de juego no encontrada.', ephemeral: true })
      }

      const container = docker.getContainer(instance.containerId)

      if (action === 'start') {
        if (instance.status === 'online') {
          return interaction.followUp({ content: '🟢 El servidor ya está encendido.', ephemeral: true })
        }
        if (['starting', 'stopping'].includes(instance.status)) {
          return interaction.followUp({ content: '🟡 El servidor está en transición. Espera un momento.', ephemeral: true })
        }

        // Sync and update DB to starting
        if (instance.gameType === 'minecraft') {
          await syncSettingsPropertiesToLevelDat(instance.containerName)
        }

        await prisma.gameInstance.update({
          where: { id: instanceId },
          data: { status: 'starting' }
        })

        // Update board immediately to show transition
        await updateStatusBoards()

        // Start container (catch 304 already started)
        try {
          await container.start()
        } catch (startErr) {
          if (startErr.statusCode !== 304 && !startErr.message.includes('304')) {
            throw startErr
          }
        }
        resetGameTracker(instanceId)

        // Set fallback to mark online after 60s
        setTimeout(async () => {
          const current = await prisma.gameInstance.findUnique({ where: { id: instanceId } })
          if (current && current.status === 'starting') {
            await prisma.gameInstance.update({
              where: { id: instanceId },
              data: { status: 'online' }
            })
            if (instance.gameType === 'minecraft') {
              applyStartupGamerules(instance)
            }
            await updateStatusBoards()
          }
        }, 60000)
      }

      if (action === 'stop') {
        if (instance.status !== 'online') {
          return interaction.followUp({ content: '🔴 El servidor no está online.', ephemeral: true })
        }

        await prisma.gameInstance.update({
          where: { id: instanceId },
          data: { status: 'stopping' }
        })

        // Update board immediately to show transition
        await updateStatusBoards()

        // Graceful stop for Minecraft command
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
            console.error('[DiscordBot Stop] Error graceful stop:', err.message)
            await container.stop().catch(() => {})
          }
        } else {
          await container.stop().catch(() => {})
        }

        await prisma.gameInstance.update({
          where: { id: instanceId },
          data: { status: 'offline' }
        })

        // Reset sleep tracker
        resetGameTracker(instanceId)

        // Update board to offline
        await updateStatusBoards()
      }

      if (action === 'refresh') {
        await interaction.deferUpdate()
        await updateStatusBoards()
      }

    } catch (err) {
      console.error('[DiscordBot Interaction Error]:', err.message)
      try {
        await interaction.followUp({ content: `❌ Error al procesar acción: ${err.message}`, ephemeral: true })
      } catch (_) {}
    }
  })

  // Login Bot client
  client.login(token).catch(err => {
    console.error('[DiscordBot] Failed to log in Discord client:', err.message)
  })
}

async function updateStatusBoards() {
  if (!client || !client.readyAt) return

  const mcChannelId = process.env.DISCORD_MINECRAFT_CHANNEL_ID
  const vhChannelId = process.env.DISCORD_VALHEIM_CHANNEL_ID
  const domain = process.env.DOMAIN || 'moondev.online'

  try {
    const instances = await prisma.gameInstance.findMany()

    for (const instance of instances) {
      const channelId = instance.gameType === 'minecraft' ? mcChannelId : vhChannelId
      if (!channelId) continue

      let channel
      try {
        channel = await client.channels.fetch(channelId)
      } catch (_) {
        console.warn(`[DiscordBot] No se pudo encontrar el canal con ID ${channelId}`)
        continue
      }

      if (!channel || !channel.isTextBased()) continue

      // Query player info and version if online
      let playersText = '--'
      let versionText = 'Desconocida'

      if (instance.status === 'online') {
        try {
          if (instance.gameType === 'valheim') {
            const details = await queryValheimDetails('localhost', instance.queryPort, instance.containerId)
            if (details.players !== -1) {
              playersText = `${details.players} jugadores`
              versionText = details.version || 'Desconocida'
            }
          } else if (instance.gameType === 'minecraft') {
            const details = await queryMinecraftBedrockDetails('localhost', instance.queryPort)
            if (details.players !== -1) {
              playersText = `${details.players} jugadores`
              versionText = details.version || 'Desconocida'
            }
          }
        } catch (_) {}
      }

      // Build status embed details
      let statusLabel = '🔴 OFFLINE'
      let embedColor = 0xf43f5e // Red
      let statusDesc = 'El servidor está apagado. Presiona **Encender** para iniciarlo.'

      if (instance.status === 'starting') {
        statusLabel = '🟡 INICIANDO...'
        embedColor = 0xf59e0b // Amber
        statusDesc = 'El servidor se está iniciando en Docker. Espera a que responda.'
      } else if (instance.status === 'stopping') {
        statusLabel = '🟠 DETENIENDO...'
        embedColor = 0xf97316 // Orange
        statusDesc = 'El servidor se está apagando limpiamente.'
      } else if (instance.status === 'online') {
        statusLabel = '🟢 ONLINE'
        embedColor = 0x10b981 // Emerald Green
        statusDesc = 'El servidor está activo y listo para jugar.'
      } else if (instance.status === 'pending') {
        statusLabel = '🔘 INACTIVO (RESERVADO)'
        embedColor = 0x6b7280 // Gray
        statusDesc = 'Instancia en estado de reserva.'
      }

      const connectionAddress = instance.gameType === 'minecraft'
        ? `mc.${domain}`
        : `vh.${domain}`

      const embed = new EmbedBuilder()
        .setTitle(instance.gameType === 'minecraft' ? '🎮 Servidor Minecraft Bedrock' : '🌲 Servidor Valheim')
        .setDescription(statusDesc)
        .setColor(embedColor)
        .addFields(
          { name: 'Nombre', value: `\`${instance.containerName}\``, inline: true },
          { name: 'Estado', value: `**${statusLabel}**`, inline: true },
          { name: 'Conectados', value: `\`${playersText}\``, inline: true },
          { name: 'Dirección', value: `\`${connectionAddress}\``, inline: true },
          { name: 'Puerto', value: `\`${instance.queryPort}\``, inline: true },
          { name: 'Versión', value: `\`${versionText}\``, inline: true }
        )
        .setFooter({ text: `MoonPanel Discord Service | ID: ${instance.id}` })
        .setTimestamp()

      // Build control buttons
      const isOffline = instance.status === 'offline'
      const isOnline = instance.status === 'online'
      const isTrans = ['starting', 'stopping', 'pending'].includes(instance.status)

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`start_${instance.gameType}_${instance.id}`)
          .setLabel('Encender')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!isOffline || isTrans),
        new ButtonBuilder()
          .setCustomId(`stop_${instance.gameType}_${instance.id}`)
          .setLabel('Apagar')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!isOnline || isTrans),
        new ButtonBuilder()
          .setCustomId(`refresh_${instance.gameType}_${instance.id}`)
          .setLabel('🔄 Refrescar')
          .setStyle(ButtonStyle.Secondary)
      )

      // Find old status message sent by this bot in this channel for this specific instance
      let messages = []
      try {
        messages = await channel.messages.fetch({ limit: 50 })
      } catch (fetchErr) {
        console.error('[DiscordBot Message Fetch Err]:', fetchErr.message)
      }

      const botMsg = messages.find(m => 
        m.author.id === client.user.id && 
        m.embeds.length > 0 && 
        m.embeds[0].footer && 
        m.embeds[0].footer.text && 
        m.embeds[0].footer.text.includes(`ID: ${instance.id}`)
      )

      if (botMsg) {
        // Edit existing message
        await botMsg.edit({ embeds: [embed], components: [row] }).catch(err => {
          console.error('[DiscordBot Message Edit Err]:', err.message)
        })
      } else {
        // Send fresh board message
        await channel.send({ embeds: [embed], components: [row] }).catch(err => {
          console.error('[DiscordBot Message Send Err]:', err.message)
        })
      }
    }
  } catch (err) {
    console.error('[DiscordBot updateStatusBoards Error]:', err.message)
  }
}

module.exports = {
  startDiscordBot
}
