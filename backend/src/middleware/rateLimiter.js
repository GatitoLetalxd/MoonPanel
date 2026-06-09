const rateLimitStore = new Map()

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
