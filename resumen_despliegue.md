# Resumen de Desarrollo y Guía de Despliegue en VPS

Este documento detalla el estado actual de **MoonPanel** para **moondev.online**, resumiendo todo el trabajo realizado en el entorno de desarrollo local y enumerando los pasos críticos para el despliegue final en tu **VPS Contabo (Ubuntu 24.04 LTS)**.

---

## 1. Lo Realizado (Estructura y Lógica Completadas)

Hemos desarrollado todo el stack tecnológico conforme a los requerimientos:

### Base de Datos
* **Esquema de Prisma (`schema.prisma`):** Modelos de base de datos para `User`, `Instance`, y `SSHKey` con relaciones y eliminación en cascada.
* **Migración:** Inicializado exitosamente de forma nativa en tu PostgreSQL local.

### Backend (Node.js + Express)
* **Controlador y Rutas de Autenticación:** 
  * Login con **Rate Limiting** (máximo 5 intentos por minuto) usando encriptación `bcryptjs` y firma de JWT (Access Token + Refresh Token).
  * Endpoint `/me` para verificar sesiones y cerrar sesión de forma segura.
* **Zona de Administración (ADMIN):** 
  * CRUD completo de clientes (`User` con rol `CLIENT`).
  * Creación y despliegue automatizado de instancias Docker al registrar un cliente (asignación automática de puertos web 3010-3129 y SSH 2210-2260, generación de password temporal y config de Nginx).
  * Control del ciclo de vida del contenedor (encendido, apagado, reinicio en caliente).
  * Actualización en caliente de recursos (CPU, RAM y límite de disco).
  * Gestión administrativa de llaves SSH autorizadas del cliente.
* **Zona de Cliente (CLIENT):**
  * Vista de su propio contenedor con control básico (encendido/apagado/reinicio).
  * Lectura de estadísticas de telemetría y credenciales SSH técnicas.
  * Formulario completo para registrar llaves SSH públicas (inyectadas al contenedor) y eliminarlas.
* **Servicio Docker (`dockerService.js`):**
  * Conexión por socket local `/var/run/docker.sock`.
  * Compilación automática de la imagen base `moonpanel-client-base:latest` al primer inicio.
  * **Corrección de Límite en Caliente:** Integración de `MemorySwap` (2x RAM) para evitar errores 409 al modificar límites de memoria sobre la marcha.
  * **Límite de Disco Lógico (Enfoque A):** Cálculo en vivo de almacenamiento consumido por carpeta del cliente en el host (`/home/clients/{containerName}`) usando `du -sm`.
* **Servicio Nginx (`nginxService.js`):**
  * Mockeado en `development`. En producción genera configs en `/etc/nginx/sites-available`, symlinks a `sites-enabled`, recarga Nginx y llama a Certbot para SSL.

### Frontend (React 18 + Vite + Tailwind CSS v3)
* **Estética Lunar Oscura:** Colores y fuentes corporativas (Inter y JetBrains Mono) con bordes delgados y badges animados.
* **Lógica de Redirección:** `AuthContext` administra las sesiones y protege las rutas redirigiendo según roles.
* **Llamadas Axios Dinámicas:** Corrección en el base URL para que resuelva `window.location.hostname` dinámicamente en desarrollo, posibilitando pruebas desde dispositivos remotos sin bloqueos de `localhost`.
* **Gráficas en Tiempo Real:** Dashboard y detalles de administrador con polling de telemetría cada 5s y gráficos de Recharts.

---

## 2. Lo que Falta por Hacer (Checklist de Despliegue en VPS)

Dado que vas a desplegar en producción en tu VPS Contabo (`209.145.59.115`), debes seguir esta secuencia para configurar la infraestructura real:

### Paso 1: Configurar el DNS Wildcard
Para que los subdominios de tus clientes (`cliente.moondev.online`) apunten a tu panel, debes ir al proveedor de DNS de tu dominio y añadir estos registros A:
1. `moondev.online` → `209.145.59.115`
2. `*.moondev.online` → `209.145.59.115`

### Paso 2: Crear el Directorio de Clientes en el VPS
El backend monta los directorios locales del VPS en los contenedores. Ejecuta esto en tu VPS para prepararlo:
```bash
mkdir -p /home/clients
chmod 755 /home/clients
```

### Paso 3: Configurar UFW (Firewall del VPS)
Configura las reglas del firewall para permitir el tráfico SSH de los clientes y el tráfico web:
```bash
ufw allow 22       # SSH base del VPS
ufw allow 80       # Nginx HTTP
ufw allow 443      # Nginx HTTPS
ufw allow 4000     # Backend de MoonPanel (si el front le pega directo)
ufw allow 2210:2260/tcp  # Rango de puertos SSH para contenedores de clientes
ufw deny 3010:3129/tcp   # Bloquear accesos directos HTTP a los puertos web internos de clientes
ufw enable
```

### Paso 4: Levantar la Base de Datos Nativa en el VPS
1. Instala PostgreSQL en tu Ubuntu VPS:
   ```bash
   apt update
   apt install postgresql postgresql-contrib -y
   service postgresql start
   ```
2. Configura el usuario y base de datos nativos como hicimos en desarrollo:
   ```bash
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'TU_PASSWORD_SEGURO';"
   sudo -u postgres psql -c "CREATE DATABASE moonpanel;"
   sudo -u postgres psql -c "CREATE USER moonpanel WITH PASSWORD 'TU_PASSWORD_SEGURO';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE moonpanel TO moonpanel;"
   sudo -u postgres psql -c "ALTER DATABASE moonpanel OWNER TO moonpanel;"
   sudo -u postgres psql -d moonpanel -c "GRANT ALL ON SCHEMA public TO moonpanel;"
   sudo -u postgres psql -c "ALTER USER moonpanel CREATEDB;"
   ```

### Paso 5: Subir el Código al VPS y Configurar Variables de Entorno
1. Copia tu carpeta `PanelMoon` al VPS (puedes usar Git o SCP).
2. Actualiza el archivo `backend/.env` del VPS con variables de producción:
   ```env
   DATABASE_URL="postgresql://moonpanel:TU_PASSWORD_SEGURO@localhost:5432/moonpanel?schema=public"
   JWT_SECRET="SECRETO_SUPER_SEGURO_PROD"
   JWT_REFRESH_SECRET="SECRETO_REFRESH_SUPER_SEGURO_PROD"
   PORT=4000
   NODE_ENV=production
   DOMAIN="moondev.online"
   ADMIN_EMAIL="rogeeromontufar@gmail.com"
   ADMIN_USERNAME="GatitoLetal"
   ADMIN_PASSWORD="TU_PASSWORD_DE_ADMIN_SEGURO"
   ```

### Paso 6: Instalar y Desplegar Backend con PM2 (Corriendo como Root)
> [!IMPORTANT]
> El backend en producción debe correr como **root** para poder modificar los archivos de Nginx en `/etc/nginx/` y ejecutar comandos de Certbot.

1. Instala dependencias y ejecuta migraciones de Prisma en el backend:
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   ```
2. Instala PM2 globalmente:
   ```bash
   npm install -g pm2
   ```
3. Arranca el backend con PM2:
   ```bash
   pm2 start src/index.js --name "moonpanel-backend"
   pm2 save
   pm2 startup
   ```

### Paso 7: Desplegar el Frontend (Compilado)
1. Instala dependencias y compila en tu máquina local (o en el VPS):
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Mueve la carpeta `/dist` resultante a una ruta en tu VPS (por ejemplo, `/var/www/moonpanel`).
3. Crea un vhost de Nginx en `/etc/nginx/sites-available/panel.moondev.online` para servir los archivos estáticos del frontend de Vite:
   ```nginx
   server {
       listen 80;
       server_name panel.moondev.online;
       root /var/www/moonpanel;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
4. Habilita el sitio, recarga Nginx y obtén SSL para el panel principal:
   ```bash
   ln -sf /etc/nginx/sites-available/panel.moondev.online /etc/nginx/sites-enabled/
   nginx -s reload
   certbot --nginx -d panel.moondev.online --non-interactive --agree-tos -m rogeeromontufar@gmail.com
   ```

Con esta secuencia de pasos, **MoonPanel** estará 100% operativo en producción.
