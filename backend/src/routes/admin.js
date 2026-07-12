const express = require('express')
const adminController = require('../controllers/adminController')
const auth = require('../middleware/auth')
const isAdmin = require('../middleware/isAdmin')

const router = express.Router()

// Aplicar autenticación y verificación de rol ADMIN a todas las rutas
router.use(auth)
router.use(isAdmin)

// Clientes
router.get('/clients', adminController.getClients)
router.post('/clients', adminController.createClient)
router.delete('/clients/:id', adminController.deleteClient)

// Instancias
router.get('/instances', adminController.getInstances)
router.post('/instances', adminController.createInstance)
router.patch('/instances/:id', adminController.updateInstanceLimits)
router.delete('/instances/:id', adminController.deleteInstance)

// Controles de contenedor
router.post('/instances/:id/start', adminController.startInstance)
router.post('/instances/:id/stop', adminController.stopInstance)
router.post('/instances/:id/restart', adminController.restartInstance)
router.post('/instances/:id/force-launch', adminController.forceLaunchInstance)
router.post('/discord/recreate', adminController.recreateDiscordBoards)

// Stats y SSH Info
router.get('/instances/:id/stats', adminController.getInstanceStats)
router.get('/instances/:id/ssh-info', adminController.getInstanceSSHInfo)

// Llaves SSH del cliente (como admin)
router.delete('/instances/:id/ssh-keys/:keyId', adminController.deleteSSHKey)

module.exports = router
