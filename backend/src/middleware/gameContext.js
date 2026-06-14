// backend/src/middleware/gameContext.js
const SUBDOMAIN_MAP = {
  'vh.moondev.online':    'valheim',
  'mc.moondev.online':    'minecraft',
  'panel.moondev.online': 'admin',
}

function gameContextMiddleware(req, res, next) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0]
  let gameType = SUBDOMAIN_MAP[host] ?? null
  
  if (!gameType && req.headers['x-game-type']) {
    gameType = req.headers['x-game-type']
  }

  req.gameType = gameType
  next()
}

module.exports = {
  gameContextMiddleware
}
