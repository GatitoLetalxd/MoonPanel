const fs = require('fs')
const { execSync } = require('child_process')

const IS_DEV = process.env.NODE_ENV !== 'production'
const DOMAIN = process.env.DOMAIN || 'moondev.online'

function generateNginxConfig(subdomain, webPort) {
  return `
server {
    listen 80;
    server_name ${subdomain}.${DOMAIN};

    location / {
        proxy_pass http://localhost:${webPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`
}

async function createVhost(subdomain, webPort) {
  const fullDomain = `${subdomain}.${DOMAIN}`
  if (IS_DEV) {
    console.log(`[NGINX MOCK] Vhost creado: ${fullDomain} → puerto ${webPort}`)
    console.log(`[CERTBOT MOCK] SSL generado para ${fullDomain}`)
    return
  }
  const config = generateNginxConfig(subdomain, webPort)
  const path = `/etc/nginx/sites-available/${fullDomain}`
  const link = `/etc/nginx/sites-enabled/${fullDomain}`
  fs.writeFileSync(path, config)
  
  // Crear symlink y recargar nginx
  try {
    execSync(`ln -sf ${path} ${link}`)
    execSync('nginx -s reload')
    console.log(`[NGINX] Vhost configurado y recargado para ${fullDomain}`)
    
    // Obtener SSL con Certbot
    console.log(`[CERTBOT] Solicitando certificado SSL para ${fullDomain}...`)
    execSync(`certbot --nginx -d ${fullDomain} --non-interactive --agree-tos -m ${process.env.ADMIN_EMAIL}`)
    console.log(`[CERTBOT] Certificado SSL instalado con éxito para ${fullDomain}`)
  } catch (error) {
    console.error(`[NGINX/CERTBOT] Error al configurar Nginx/SSL para ${fullDomain}:`, error.message)
    throw error
  }
}

async function removeVhost(subdomain) {
  const fullDomain = `${subdomain}.${DOMAIN}`
  if (IS_DEV) {
    console.log(`[NGINX MOCK] Vhost eliminado: ${fullDomain}`)
    return
  }
  try {
    execSync(`rm -f /etc/nginx/sites-available/${fullDomain}`)
    execSync(`rm -f /etc/nginx/sites-enabled/${fullDomain}`)
    execSync('nginx -s reload')
    console.log(`[NGINX] Vhost eliminado y recargado para ${fullDomain}`)
  } catch (error) {
    console.error(`[NGINX] Error al eliminar vhost para ${fullDomain}:`, error.message)
    throw error
  }
}

module.exports = { createVhost, removeVhost }
