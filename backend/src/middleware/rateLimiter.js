const rateLimitStore = new Map()

// Limpieza periódica de IPs antiguas para evitar memory leak (BUG-03)
setInterval(() => {
  const now = Date.now()
  for (const [ip, requests] of rateLimitStore.entries()) {
    // Filtrar solo las peticiones dentro de la ventana más reciente (1 minuto)
    const valid = requests.filter(time => now - time < 60 * 1000)
    if (valid.length === 0) {
      rateLimitStore.delete(ip)
    } else {
      rateLimitStore.set(ip, valid)
    }
  }
}, 5 * 60 * 1000) // Cada 5 minutos

module.exports = (maxRequests, windowMs) => {
  return (req, res, next) => {
    const ip = req.ip
    const now = Date.now()

    if (!rateLimitStore.has(ip)) {
      rateLimitStore.set(ip, [])
    }

    const requests = rateLimitStore.get(ip)
    // Filtrar peticiones fuera de la ventana de tiempo
    const validRequests = requests.filter(time => now - time < windowMs)
    validRequests.push(now)
    rateLimitStore.set(ip, validRequests)

    if (validRequests.length > maxRequests) {
      return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo más tarde.' })
    }

    next()
  }
}
