const express = require('express')
const clientController = require('../controllers/clientController')
const auth = require('../middleware/auth')

const router = express.Router()

// Aplicar autenticación a todas las rutas de clientes
router.use(auth)

// Instancia del cliente
router.get('/instance', clientController.getInstance)
router.post('/instance/launch', clientController.launchInstance)
router.post('/instance/start', clientController.startInstance)
router.post('/instance/stop', clientController.stopInstance)
router.post('/instance/restart', clientController.restartInstance)
router.get('/instance/stats', clientController.getInstanceStats)
router.delete('/instance', clientController.deleteInstance)
router.patch('/instance/mode', clientController.updateInstanceMode)
router.post('/instance/database', clientController.enableDatabase)
router.post('/instance/database/execute-sql', clientController.executeSql)

// Llaves SSH
router.get('/ssh-keys', clientController.getSSHKeys)
router.post('/ssh-keys', clientController.addSSHKey)
router.delete('/ssh-keys/:id', clientController.deleteSSHKey)

// Variables de entorno
router.get('/envvars', clientController.getEnvVars)
router.post('/envvars', clientController.addOrUpdateEnvVar)
router.delete('/envvars/:id', clientController.deleteEnvVar)

// Despliegues
router.get('/deployments', clientController.getDeployments)
router.post('/deploy', clientController.triggerDeploy)
router.get('/deploy/logs/:deploymentId', clientController.getDeployLogs)

module.exports = router
