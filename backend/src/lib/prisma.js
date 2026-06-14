const { PrismaClient } = require('@prisma/client')

// Singleton de PrismaClient para evitar múltiples pools de conexiones a PostgreSQL.
// Todos los archivos deben importar este módulo en vez de crear su propio `new PrismaClient()`.
const prisma = new PrismaClient()

module.exports = prisma
