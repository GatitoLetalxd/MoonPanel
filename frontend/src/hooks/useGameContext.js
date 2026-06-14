// frontend/src/hooks/useGameContext.js

const CONTEXT_MAP = {
  'vh.moondev.online': {
    gameType: 'valheim',
    label:    'Valheim',
    color:    '#00f5ff',  // cyan eléctrico moondev
    bg:       '#050508',  // negro moondev
    accent:   '#0a0a1a',  // dark blue moondev
    icon:     '⚔',
    serverLabel: 'Servidor Valheim',
  },
  'mc.moondev.online': {
    gameType: 'minecraft',
    label:    'Minecraft',
    color:    '#4ade80',  // verde MC
    bg:       '#050508',
    accent:   '#052e16',
    icon:     '⛃',
    serverLabel: 'Servidor Minecraft',
  },
  'panel.moondev.online': {
    gameType: 'admin',
    label:    'MoonPanel',
    color:    '#00f5ff',
    bg:       '#050508',
    accent:   '#0a0a1a',
    icon:     '☾',
    serverLabel: 'Instancia',
  },
}

export function useGameContext() {
  const hostname = window.location.hostname
  // Fallback para desarrollo local
  return CONTEXT_MAP[hostname] ?? CONTEXT_MAP['panel.moondev.online']
}
