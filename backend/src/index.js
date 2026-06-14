require('dotenv').config()
const express = require('express')
const cors = require('cors')
const prisma = require('./lib/prisma')
const bcrypt = require('bcryptjs')
const dockerService = require('./services/dockerService')

// Routers
const authRouter = require('./routes/auth')
const adminRouter = require('./routes/admin')
const clientRouter = require('./routes/client')

const app = express()
const PORT = process.env.PORT || 4000

// Middleware para parsear cookies de forma manual y evitar dependencias adicionales
app.use((req, res, next) => {
  const cookieStr = req.headers.cookie
  req.cookies = {}
  if (cookieStr) {
    cookieStr.split(';').forEach(cookie => {
      // Dividir solo en el primer '=' para soportar valores con '=' (ej: tokens Base64)
      const eqIndex = cookie.indexOf('=')
      if (eqIndex > 0) {
        const key = cookie.substring(0, eqIndex).trim()
        const value = cookie.substring(eqIndex + 1).trim()
        req.cookies[key] = value
      }
    })
  }
  next()
})

app.use(cors({
  origin: true, // Permitir cualquier origen en desarrollo (se puede restringir en prod)
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rutas base
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/client', clientRouter)

// Ruta de estado del panel
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'MoonPanel Backend is running' })
})

// Crear administrador por defecto si no existe
async function createDefaultAdmin() {
  try {
    const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!adminExists) {
      const adminUsername = process.env.ADMIN_USERNAME || 'GatitoLetal'
      const adminEmail = process.env.ADMIN_EMAIL || 'rogeeromontufar@gmail.com'
      const adminPassword = process.env.ADMIN_PASSWORD || 'temporal123'
      
      const hashed = await bcrypt.hash(adminPassword, 10)
      
      await prisma.user.create({
        data: {
          username: adminUsername,
          email: adminEmail,
          password: hashed,
          role: 'ADMIN'
        }
      })
      console.log(`[SYS] Admin por defecto creado con éxito: ${adminUsername}`)
    } else {
      console.log(`[SYS] Admin por defecto ya existe en la base de datos.`)
    }
  } catch (error) {
    console.error('[SYS] Error al verificar/crear administrador por defecto:', error)
  }
}

async function startServer() {
  try {
    // 1. Conectar a la base de datos
    await prisma.$connect()
    console.log('[SYS] Conectado exitosamente a PostgreSQL con Prisma ORM.')

    // 2. Crear admin por defecto si es necesario
    await createDefaultAdmin()

    // 3. Compilar la imagen Docker base si no existe
    await dockerService.buildBaseImage()

    // 4. Iniciar escucha
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SYS] Servidor MoonPanel iniciado en el puerto ${PORT} (Entorno: ${process.env.NODE_ENV})`)
    })
  } catch (error) {
    console.error('[SYS] Error crítico durante la inicialización del servidor:', error)
    process.exit(1)
  }
}

startServer()
