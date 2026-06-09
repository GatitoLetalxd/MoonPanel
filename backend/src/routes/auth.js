const express = require('express')
const authController = require('../controllers/authController')
const authMiddleware = require('../middleware/auth')
const rateLimiter = require('../middleware/rateLimiter')

const router = express.Router()

// Login con rate limit (máximo 5 intentos por minuto para prevenir brute force)
router.post('/login', rateLimiter(5, 60 * 1000), authController.login)

// Logout
router.post('/logout', authController.logout)

// Obtener datos del usuario logueado
router.get('/me', authMiddleware, authController.me)

module.exports = router
