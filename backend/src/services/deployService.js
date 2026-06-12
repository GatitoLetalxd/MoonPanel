const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const fs = require('fs')
const path = require('path')
const { execInContainer } = require('./dockerService')
const { decrypt } = require('./cryptoService')
const EventEmitter = require('events')

class DeployEmitter extends EventEmitter {}
const deployEmitter = new DeployEmitter()

async function appendLog(deploymentId, text) {
  deployEmitter.emit(`logs:${deploymentId}`, { type: 'log', text })
  
  try {
    const deploy = await prisma.deployment.findUnique({ where: { id: deploymentId } })
    if (deploy) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { logs: (deploy.logs || '') + text }
      })
    }
  } catch (err) {
    console.error('Error updating deploy logs in DB:', err)
  }
}

async function updateStatus(deploymentId, status, projectType = null) {
  deployEmitter.emit(`logs:${deploymentId}`, { type: 'status', status, projectType })
  
  try {
    const data = { status }
    if (projectType) data.projectType = projectType
    await prisma.deployment.update({
      where: { id: deploymentId },
      data
    })
  } catch (err) {
    console.error('Error updating deploy status in DB:', err)
  }
}

// Helper to execute inside container and stream output
async function runCommandWithLogs(containerName, deploymentId, command) {
  await appendLog(deploymentId, `\n$ ${command}\n`)
  try {
    const output = await execInContainer(containerName, command)
    await appendLog(deploymentId, output)
    return { success: true, output }
  } catch (error) {
    await appendLog(deploymentId, `[ERROR] Command failed: ${error.message}\n`)
    return { success: false, error }
  }
}

async function runDeploy(deploymentId) {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { instance: true }
  })
  
  if (!deployment) {
    console.error(`Deployment ${deploymentId} not found`)
    return
  }
  
  const { instance, repoUrl, branch } = deployment
  const containerName = instance.containerName
  const hostDir = `/home/clients/${containerName}`
  
  try {
    // 1. CLONING
    await updateStatus(deploymentId, 'CLONING')
    await appendLog(deploymentId, `Starting deployment for instance ${instance.subdomain}...\n`)
    await appendLog(deploymentId, `Cloning repository ${repoUrl} (branch: ${branch})...\n`)
    
    // Clean old files
    await runCommandWithLogs(containerName, deploymentId, 'rm -rf /app/* /app/.[!.]*')
    
    // Clone
    const cloneRes = await runCommandWithLogs(containerName, deploymentId, `git clone --depth 1 -b ${branch} ${repoUrl} /app`)
    if (!cloneRes.success) {
      await updateStatus(deploymentId, 'FAILED')
      return
    }
    
    // 2. DETECT PROJECT TYPE
    await appendLog(deploymentId, `Detecting project type...\n`)
    let projectType = 'unknown'
    if (fs.existsSync(path.join(hostDir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(hostDir, 'package.json'), 'utf8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps['next']) {
          projectType = 'nodejs'
        } else if (deps['express'] || deps['koa'] || deps['fastify'] || deps['nest'] || deps['nodemon']) {
          projectType = 'nodejs'
        } else if (pkg.scripts && pkg.scripts.build && (deps['vite'] || deps['react'] || deps['vue'] || deps['svelte'] || deps['astro'])) {
          projectType = 'frontend'
        } else {
          projectType = 'nodejs'
        }
      } catch (err) {
        projectType = 'nodejs'
      }
    } else if (fs.existsSync(path.join(hostDir, 'requirements.txt')) || fs.existsSync(path.join(hostDir, 'manage.py')) || fs.existsSync(path.join(hostDir, 'app.py'))) {
      projectType = 'python'
    } else if (fs.existsSync(path.join(hostDir, 'index.html'))) {
      projectType = 'static'
    }
    
    await appendLog(deploymentId, `Project type detected: ${projectType.toUpperCase()}\n`)
    await updateStatus(deploymentId, 'INSTALLING', projectType)
    
    // 3. WRITE ENVIRONMENT VARIABLES
    await appendLog(deploymentId, `Writing environment variables...\n`)
    const envVars = await prisma.envVar.findMany({ where: { instanceId: instance.id } })
    const dotenvLines = envVars.map(ev => `${ev.key}=${decrypt(ev.value)}`)
    
    if (projectType === 'nodejs' || projectType === 'python') {
      dotenvLines.push('PORT=5000')
    }
    
    fs.writeFileSync(path.join(hostDir, '.env'), dotenvLines.join('\n'), 'utf8')
    await appendLog(deploymentId, `.env file generated successfully.\n`)
    
    // 4. INSTALL DEPENDENCIES
    if (projectType === 'nodejs' || projectType === 'frontend') {
      const instRes = await runCommandWithLogs(containerName, deploymentId, 'npm install')
      if (!instRes.success) {
        await updateStatus(deploymentId, 'FAILED')
        return
      }
    } else if (projectType === 'python') {
      if (fs.existsSync(path.join(hostDir, 'requirements.txt'))) {
        const instRes = await runCommandWithLogs(containerName, deploymentId, 'pip install -r requirements.txt')
        if (!instRes.success) {
          await updateStatus(deploymentId, 'FAILED')
          return
        }
      }
    }
    
    // 5. BUILDING
    if (projectType === 'frontend') {
      await updateStatus(deploymentId, 'BUILDING')
      const buildRes = await runCommandWithLogs(containerName, deploymentId, 'npm run build')
      if (!buildRes.success) {
        await updateStatus(deploymentId, 'FAILED')
        return
      }
    }
    
    // 6. STARTING / CONFIGURING SERVER
    await updateStatus(deploymentId, 'STARTING')
    
    if (projectType === 'frontend' || projectType === 'static') {
      let buildPath = '/app'
      if (projectType === 'frontend') {
        if (fs.existsSync(path.join(hostDir, 'dist'))) {
          buildPath = '/app/dist'
        } else if (fs.existsSync(path.join(hostDir, 'build'))) {
          buildPath = '/app/build'
        }
      }
      
      const nginxConfig = `
server {
    listen 3000 default_server;
    listen [::]:3000 default_server;
    root ${buildPath};
    index index.html index.htm;
    server_name _;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`
      fs.writeFileSync(path.join(hostDir, 'nginx.conf'), nginxConfig, 'utf8')
      await runCommandWithLogs(containerName, deploymentId, 'mv /app/nginx.conf /etc/nginx/sites-available/default && service nginx restart')
      await execInContainer(containerName, 'pm2 delete all || true')
      
    } else if (projectType === 'nodejs') {
      const nginxProxyConfig = `
server {
    listen 3000 default_server;
    listen [::]:3000 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`
      fs.writeFileSync(path.join(hostDir, 'nginx.conf'), nginxProxyConfig, 'utf8')
      await runCommandWithLogs(containerName, deploymentId, 'mv /app/nginx.conf /etc/nginx/sites-available/default && service nginx restart')
      
      await runCommandWithLogs(containerName, deploymentId, 'pm2 delete all || true')
      
      let startCmd = 'npm start'
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(hostDir, 'package.json'), 'utf8'))
        if (pkg.scripts && pkg.scripts.start) {
          startCmd = 'npm start'
        } else if (fs.existsSync(path.join(hostDir, 'index.js'))) {
          startCmd = 'node index.js'
        } else if (fs.existsSync(path.join(hostDir, 'app.js'))) {
          startCmd = 'node app.js'
        } else if (fs.existsSync(path.join(hostDir, 'server.js'))) {
          startCmd = 'node server.js'
        }
      } catch (err) {}
      
      const pm2Res = await runCommandWithLogs(containerName, deploymentId, `pm2 start "${startCmd}" --name "app"`)
      if (!pm2Res.success) {
        await updateStatus(deploymentId, 'FAILED')
        return
      }
      
    } else if (projectType === 'python') {
      const nginxProxyConfig = `
server {
    listen 3000 default_server;
    listen [::]:3000 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`
      fs.writeFileSync(path.join(hostDir, 'nginx.conf'), nginxProxyConfig, 'utf8')
      await runCommandWithLogs(containerName, deploymentId, 'mv /app/nginx.conf /etc/nginx/sites-available/default && service nginx restart')
      
      await runCommandWithLogs(containerName, deploymentId, 'pm2 delete all || true')
      
      let startCmd = 'python3 app.py'
      if (fs.existsSync(path.join(hostDir, 'manage.py'))) {
        startCmd = 'python3 manage.py runserver 0.0.0.0:5000'
      } else if (fs.existsSync(path.join(hostDir, 'main.py'))) {
        try {
          const mainContent = fs.readFileSync(path.join(hostDir, 'main.py'), 'utf8')
          if (mainContent.includes('FastAPI') || mainContent.includes('uvicorn')) {
            startCmd = 'uvicorn main:app --host 0.0.0.0 --port 5000'
          } else {
            startCmd = 'python3 main.py'
          }
        } catch (err) {
          startCmd = 'python3 main.py'
        }
      }
      
      const pm2Res = await runCommandWithLogs(containerName, deploymentId, `pm2 start "${startCmd}" --name "app"`)
      if (!pm2Res.success) {
        await updateStatus(deploymentId, 'FAILED')
        return
      }
    }
    
    await runCommandWithLogs(containerName, deploymentId, 'pm2 save')
    
    await appendLog(deploymentId, `\nDeployment successfully completed!\n`)
    await updateStatus(deploymentId, 'SUCCESS')
    
  } catch (error) {
    console.error('Error during deployment execution:', error)
    await appendLog(deploymentId, `\n[FATAL ERROR] Deployment failed: ${error.message}\n`)
    await updateStatus(deploymentId, 'FAILED')
  }
}

module.exports = {
  runDeploy,
  deployEmitter
}
