const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const prisma = new PrismaClient()

// POST /api/auth/login
async function login(req, res) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' })
    }

    // Buscar por username o email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      include: {
        instance: true
      }
    })

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' })
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' })
    }

    // Generar Access Token y Refresh Token
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // 1 día de expiración para desarrollo fácil
    )

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )

    // Opcionalmente podemos guardar el refresh token en una cookie o simplemente retornarlo
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    })

    // No retornar el password en la respuesta
    const { password: _, ...userWithoutPassword } = user

    return res.status(200).json({
      accessToken,
      user: userWithoutPassword
    })
  } catch (error) {
    console.error('[AUTH ERROR] Error en login:', error)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  try {
    res.clearCookie('refreshToken')
    return res.status(200).json({ message: 'Sesión cerrada exitosamente.' })
  } catch (error) {
    console.error('[AUTH ERROR] Error en logout:', error)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        instance: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    const { password: _, ...userWithoutPassword } = user
    return res.status(200).json(userWithoutPassword)
  } catch (error) {
    console.error('[AUTH ERROR] Error en me:', error)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}

module.exports = {
  login,
  logout,
  me
}
