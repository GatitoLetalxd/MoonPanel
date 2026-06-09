const express = require('express')
const clientController = require('../controllers/clientController')
const auth = require('../middleware/auth')

const router = express.Router()

// Aplicar autenticación a todas las rutas de clientes
router.use(auth)

// Instancia del cliente
router.get('/instance', clientController.getInstance)
router.post('/instance/start', clientController.startInstance)
router.post('/instance/stop', clientController.stopInstance)
router.post('/instance/restart', clientController.restartInstance)
router.get('/instance/stats', clientController.getInstanceStats)

// Llaves SSH
router.get('/ssh-keys', clientController.getSSHKeys)
router.post('/ssh-keys', clientController.addSSHKey)
router.delete('/ssh-keys/:id', clientController.deleteSSHKey)

module.exports = router
