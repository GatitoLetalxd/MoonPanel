module.exports = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next()
  } else {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' })
  }
}
