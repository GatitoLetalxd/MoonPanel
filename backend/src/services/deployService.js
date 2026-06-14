const prisma = require('../lib/prisma')
const fs = require('fs')
const path = require('path')
const { execInContainer } = require('./dockerService')
const { decrypt } = require('./cryptoService')
const EventEmitter = require('events')

class DeployEmitter extends EventEmitter {}
const deployEmitter = new DeployEmitter()
deployEmitter.setMaxListeners(50) // Evitar warnings cuando múltiples clientes ven logs simultáneamente

async function appendLog(deploymentId, text) {
  deployEmitter.emit(`logs:${deploymentId}`, { type: 'log', text })
  
  try {
    // Concatenación atómica para evitar race condition (BUG-13)
    await prisma.$executeRawUnsafe(
      `UPDATE "Deployment" SET "logs" = COALESCE("logs", '') || $1 WHERE "id" = $2`,
      text,
      deploymentId
    )
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
  
  // Parse GitHub URL
  const githubRegex = /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/(.+))?$/
  const match = repoUrl.trim().match(githubRegex)
  let cleanRepoUrl = repoUrl
  let gitBranch = branch || 'main'
  let subdirectory = null
  
  if (match) {
    cleanRepoUrl = `https://github.com/${match[1]}/${match[2]}`
    if (match[3]) gitBranch = match[3]
    if (match[4]) subdirectory = match[4]
  }

  const hostDir = `/home/clients/${containerName}`
  
  try {
    // 1. CLONING
    await updateStatus(deploymentId, 'CLONING')
    await appendLog(deploymentId, `Starting deployment for instance ${instance.subdomain}...\n`)
    await appendLog(deploymentId, `Cloning repository ${cleanRepoUrl} (branch: ${gitBranch})...\n`)
    
    // Clean old files, preserving database directories
    await runCommandWithLogs(containerName, deploymentId, "find /app -mindepth 1 -maxdepth 1 ! -name 'postgres' ! -name 'mysql' -exec rm -rf {} +")
    
    // Clone to a temporary directory, then copy to /app to support non-empty target directory (preserving postgres/mysql data)
    await runCommandWithLogs(containerName, deploymentId, 'rm -rf /tmp/clone')
    const cloneRes = await runCommandWithLogs(containerName, deploymentId, `git clone --depth 1 -b ${gitBranch} ${cleanRepoUrl} /tmp/clone`)
    if (!cloneRes.success) {
      await updateStatus(deploymentId, 'FAILED')
      return
    }
    await runCommandWithLogs(containerName, deploymentId, 'cp -a /tmp/clone/. /app/ && rm -rf /tmp/clone')
    
    // Determine project directories
    let projectHostDir = hostDir
    let projectContainerPath = '/app'
    let isMonorepo = false
    let foundFrontendDir = null
    let foundBackendDir = null

    if (subdirectory) {
      projectHostDir = path.join(hostDir, subdirectory)
      projectContainerPath = `/app/${subdirectory}`
      await appendLog(deploymentId, `Deploying subdirectory context: ${subdirectory}\n`)
    } else {
      // Check for monorepo pattern
      const frontendNames = ['frontend', 'client', 'web', 'ui']
      const backendNames = ['backend', 'server', 'api'] // 'app' eliminado: causa falsos positivos con Next.js App Router (BUG-16)
      
      for (const name of frontendNames) {
        if (fs.existsSync(path.join(hostDir, name)) && fs.statSync(path.join(hostDir, name)).isDirectory()) {
          foundFrontendDir = name
          break
        }
      }
      for (const name of backendNames) {
        if (fs.existsSync(path.join(hostDir, name)) && fs.statSync(path.join(hostDir, name)).isDirectory()) {
          foundBackendDir = name
          break
        }
      }
      
      if (foundFrontendDir && foundBackendDir) {
        isMonorepo = true
        await appendLog(deploymentId, `Monorepo detected! Frontend: /${foundFrontendDir}, Backend: /${foundBackendDir}\n`)
      }
    }

    if (isMonorepo) {
      // ==========================================================
      // MONOREPO HYBRID DEPLOYMENT FLOW
      // ==========================================================
      await updateStatus(deploymentId, 'INSTALLING', 'monorepo')
      
      // 1. Write environment variables to both directories
      await appendLog(deploymentId, `Writing environment variables for frontend and backend...\n`)
      const envVars = await prisma.envVar.findMany({ where: { instanceId: instance.id } })
      const dotenvLines = envVars.map(ev => `${ev.key}=${decrypt(ev.value)}`)
      
      // Write to frontend
      fs.writeFileSync(path.join(hostDir, foundFrontendDir, '.env'), dotenvLines.join('\n'), 'utf8')
      // Write to backend (add PORT=5000)
      const backendDotenvLines = [...dotenvLines, 'PORT=5000']
      fs.writeFileSync(path.join(hostDir, foundBackendDir, '.env'), backendDotenvLines.join('\n'), 'utf8')
      await appendLog(deploymentId, `.env files generated successfully.\n`)

      // 2. Deploy Backend
      await appendLog(deploymentId, `\n=== Deploying Backend (/${foundBackendDir}) ===\n`)
      const backendHostDir = path.join(hostDir, foundBackendDir)
      const backendContainerPath = `/app/${foundBackendDir}`
      let backendType = 'unknown'
      
      if (fs.existsSync(path.join(backendHostDir, 'package.json'))) {
        backendType = 'nodejs'
      } else if (fs.existsSync(path.join(backendHostDir, 'requirements.txt')) || fs.existsSync(path.join(backendHostDir, 'manage.py')) || fs.existsSync(path.join(backendHostDir, 'app.py'))) {
        backendType = 'python'
      }
      await appendLog(deploymentId, `Backend project type detected: ${backendType.toUpperCase()}\n`)

      // Install backend dependencies
      if (backendType === 'nodejs') {
        let instRes = await runCommandWithLogs(containerName, deploymentId, `cd ${backendContainerPath} && npm install`)
        if (!instRes.success) {
          await appendLog(deploymentId, `[WARNING] npm install failed. Retrying with --legacy-peer-deps...\n`)
          instRes = await runCommandWithLogs(containerName, deploymentId, `cd ${backendContainerPath} && npm install --legacy-peer-deps`)
          if (!instRes.success) {
            await updateStatus(deploymentId, 'FAILED')
            return
          }
        }
      } else if (backendType === 'python') {
        if (fs.existsSync(path.join(backendHostDir, 'requirements.txt'))) {
          const instRes = await runCommandWithLogs(containerName, deploymentId, `cd ${backendContainerPath} && pip3 install -r requirements.txt --break-system-packages`)
          if (!instRes.success) {
            await updateStatus(deploymentId, 'FAILED')
            return
          }
        }
      }

      // Start backend with PM2
      await runCommandWithLogs(containerName, deploymentId, 'pm2 delete all || true')
      let backendStartCmd = ''
      if (backendType === 'nodejs') {
        backendStartCmd = 'npm start'
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(backendHostDir, 'package.json'), 'utf8'))
          if (pkg.scripts && pkg.scripts.start) {
            backendStartCmd = 'npm start'
          } else if (fs.existsSync(path.join(backendHostDir, 'index.js'))) {
            backendStartCmd = 'node index.js'
          } else if (fs.existsSync(path.join(backendHostDir, 'app.js'))) {
            backendStartCmd = 'node app.js'
          } else if (fs.existsSync(path.join(backendHostDir, 'server.js'))) {
            backendStartCmd = 'node server.js'
          }
        } catch (err) {}
      } else if (backendType === 'python') {
        backendStartCmd = 'python3 app.py'
        if (fs.existsSync(path.join(backendHostDir, 'manage.py'))) {
          backendStartCmd = 'python3 manage.py runserver 0.0.0.0:5000'
        } else if (fs.existsSync(path.join(backendHostDir, 'main.py'))) {
          try {
            const mainContent = fs.readFileSync(path.join(backendHostDir, 'main.py'), 'utf8')
            if (mainContent.includes('FastAPI') || mainContent.includes('uvicorn')) {
              backendStartCmd = 'uvicorn main:app --host 0.0.0.0 --port 5000'
            } else {
              backendStartCmd = 'python3 main.py'
            }
          } catch (err) {
            backendStartCmd = 'python3 main.py'
          }
        }
      }

      if (backendStartCmd) {
        const pm2Res = await runCommandWithLogs(containerName, deploymentId, `cd ${backendContainerPath} && pm2 start "${backendStartCmd}" --name "backend"`)
        if (!pm2Res.success) {
          await updateStatus(deploymentId, 'FAILED')
          return
        }
      }

      // 3. Deploy Frontend
      await appendLog(deploymentId, `\n=== Deploying Frontend (/${foundFrontendDir}) ===\n`)
      const frontendHostDir = path.join(hostDir, foundFrontendDir)
      const frontendContainerPath = `/app/${foundFrontendDir}`

      // Install frontend dependencies
      let frontInstRes = await runCommandWithLogs(containerName, deploymentId, `cd ${frontendContainerPath} && npm install`)
      if (!frontInstRes.success) {
        await appendLog(deploymentId, `[WARNING] npm install failed. Retrying with --legacy-peer-deps...\n`)
        frontInstRes = await runCommandWithLogs(containerName, deploymentId, `cd ${frontendContainerPath} && npm install --legacy-peer-deps`)
        if (!frontInstRes.success) {
          await updateStatus(deploymentId, 'FAILED')
          return
        }
      }

      // Build frontend
      await updateStatus(deploymentId, 'BUILDING', 'monorepo')
      const buildRes = await runCommandWithLogs(containerName, deploymentId, `cd ${frontendContainerPath} && npm run build`)
      if (!buildRes.success) {
        await updateStatus(deploymentId, 'FAILED')
        return
      }

      // 4. Configure Hybrid Nginx
      await updateStatus(deploymentId, 'STARTING', 'monorepo')
      let buildPath = frontendContainerPath
      if (fs.existsSync(path.join(frontendHostDir, 'dist'))) {
        buildPath = `${frontendContainerPath}/dist`
      } else if (fs.existsSync(path.join(frontendHostDir, 'build'))) {
        buildPath = `${frontendContainerPath}/build`
      }

      const hybridNginxConfig = `
server {
    listen 3000 default_server;
    listen [::]:3000 default_server;
    root ${buildPath};
    index index.html index.htm;
    server_name _;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /downloads {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`
      fs.writeFileSync(path.join(hostDir, 'nginx.conf'), hybridNginxConfig, 'utf8')
      await runCommandWithLogs(containerName, deploymentId, `mv /app/nginx.conf /etc/nginx/sites-available/default && service nginx restart`)
      await runCommandWithLogs(containerName, deploymentId, 'pm2 save')
      
      await appendLog(deploymentId, `\nMonorepo deployment successfully completed!\n`)
      await updateStatus(deploymentId, 'SUCCESS')
      
    } else {
      // ==========================================================
      // SINGLE PROJECT DEPLOYMENT FLOW (Retrocompatible)
      // ==========================================================
      
      // 2. DETECT PROJECT TYPE
      await appendLog(deploymentId, `Detecting project type...\n`)
      let projectType = 'unknown'
      if (fs.existsSync(path.join(projectHostDir, 'package.json'))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(projectHostDir, 'package.json'), 'utf8'))
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
      } else if (fs.existsSync(path.join(projectHostDir, 'requirements.txt')) || fs.existsSync(path.join(projectHostDir, 'manage.py')) || fs.existsSync(path.join(projectHostDir, 'app.py'))) {
        projectType = 'python'
      } else if (fs.existsSync(path.join(projectHostDir, 'index.html'))) {
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
      
      fs.writeFileSync(path.join(projectHostDir, '.env'), dotenvLines.join('\n'), 'utf8')
      await appendLog(deploymentId, `.env file generated successfully.\n`)
      
      // 4. INSTALL DEPENDENCIES
      if (projectType === 'nodejs' || projectType === 'frontend') {
        let instRes = await runCommandWithLogs(containerName, deploymentId, `cd ${projectContainerPath} && npm install`)
        if (!instRes.success) {
          await appendLog(deploymentId, `[WARNING] npm install failed. Retrying with --legacy-peer-deps...\n`)
          instRes = await runCommandWithLogs(containerName, deploymentId, `cd ${projectContainerPath} && npm install --legacy-peer-deps`)
          if (!instRes.success) {
            await updateStatus(deploymentId, 'FAILED')
            return
          }
        }
      } else if (projectType === 'python') {
        if (fs.existsSync(path.join(projectHostDir, 'requirements.txt'))) {
          const instRes = await runCommandWithLogs(containerName, deploymentId, `cd ${projectContainerPath} && pip3 install -r requirements.txt --break-system-packages`)
          if (!instRes.success) {
            await updateStatus(deploymentId, 'FAILED')
            return
          }
        }
      }
      
      // 5. BUILDING
      if (projectType === 'frontend') {
        await updateStatus(deploymentId, 'BUILDING')
        const buildRes = await runCommandWithLogs(containerName, deploymentId, `cd ${projectContainerPath} && npm run build`)
        if (!buildRes.success) {
          await updateStatus(deploymentId, 'FAILED')
          return
        }
      }
      
      // 6. STARTING / CONFIGURING SERVER
      await updateStatus(deploymentId, 'STARTING')
      
      if (projectType === 'frontend' || projectType === 'static') {
        let buildPath = projectContainerPath
        if (projectType === 'frontend') {
          if (fs.existsSync(path.join(projectHostDir, 'dist'))) {
            buildPath = `${projectContainerPath}/dist`
          } else if (fs.existsSync(path.join(projectHostDir, 'build'))) {
            buildPath = `${projectContainerPath}/build`
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
        fs.writeFileSync(path.join(projectHostDir, 'nginx.conf'), nginxConfig, 'utf8')
        await runCommandWithLogs(containerName, deploymentId, `mv ${projectContainerPath}/nginx.conf /etc/nginx/sites-available/default && service nginx restart`)
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
`
        fs.writeFileSync(path.join(projectHostDir, 'nginx.conf'), nginxProxyConfig, 'utf8')
        await runCommandWithLogs(containerName, deploymentId, `mv ${projectContainerPath}/nginx.conf /etc/nginx/sites-available/default && service nginx restart`)
        
        await runCommandWithLogs(containerName, deploymentId, 'pm2 delete all || true')
        
        let startCmd = 'npm start'
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(projectHostDir, 'package.json'), 'utf8'))
          if (pkg.scripts && pkg.scripts.start) {
            startCmd = 'npm start'
          } else if (fs.existsSync(path.join(projectHostDir, 'index.js'))) {
            startCmd = 'node index.js'
          } else if (fs.existsSync(path.join(projectHostDir, 'app.js'))) {
            startCmd = 'node app.js'
          } else if (fs.existsSync(path.join(projectHostDir, 'server.js'))) {
            startCmd = 'node server.js'
          }
        } catch (err) {}
        
        const pm2Res = await runCommandWithLogs(containerName, deploymentId, `cd ${projectContainerPath} && pm2 start "${startCmd}" --name "app"`)
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
`
        fs.writeFileSync(path.join(projectHostDir, 'nginx.conf'), nginxProxyConfig, 'utf8')
        await runCommandWithLogs(containerName, deploymentId, `mv ${projectContainerPath}/nginx.conf /etc/nginx/sites-available/default && service nginx restart`)
        
        await runCommandWithLogs(containerName, deploymentId, 'pm2 delete all || true')
        
        let startCmd = 'python3 app.py'
        if (fs.existsSync(path.join(projectHostDir, 'manage.py'))) {
          startCmd = 'python3 manage.py runserver 0.0.0.0:5000'
        } else if (fs.existsSync(path.join(projectHostDir, 'main.py'))) {
          try {
            const mainContent = fs.readFileSync(path.join(projectHostDir, 'main.py'), 'utf8')
            if (mainContent.includes('FastAPI') || mainContent.includes('uvicorn')) {
              startCmd = 'uvicorn main:app --host 0.0.0.0 --port 5000'
            } else {
              startCmd = 'python3 main.py'
            }
          } catch (err) {
            startCmd = 'python3 main.py'
          }
        }
        
        const pm2Res = await runCommandWithLogs(containerName, deploymentId, `cd ${projectContainerPath} && pm2 start "${startCmd}" --name "app"`)
        if (!pm2Res.success) {
          await updateStatus(deploymentId, 'FAILED')
          return
        }
      }
      
      await runCommandWithLogs(containerName, deploymentId, 'pm2 save')
      await appendLog(deploymentId, `\nDeployment successfully completed!\n`)
      await updateStatus(deploymentId, 'SUCCESS')
    }
    
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
