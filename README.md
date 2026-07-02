# 🌌 MoonPanel

[![Node.js](https://img.shields.io/badge/Node.js-v20.x-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18.x-blue.svg?style=flat-square&logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?style=flat-square&logo=docker)](https://www.docker.com/)
[![Nginx](https://img.shields.io/badge/Nginx-Reverse--Proxy-green?style=flat-square&logo=nginx)](https://nginx.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**MoonPanel** es una potente plataforma autohospedada de **PaaS (Platform-as-a-Service)** diseñada para automatizar la creación de entornos aislados, aprovisionamiento y despliegue continuo de aplicaciones web y bases de datos en un único servidor VPS (como Contabo). 

Adicionalmente, incorpora una sección especializada de **Administración de Servidores de Videojuegos** (Minecraft Bedrock y Valheim) bajo demanda.

---

## 🚀 Pilares y Características Principales

### 🖥️ 1. Creador de Instancias y Aislamiento PaaS (Foco Principal)
MoonPanel actúa como un panel de control ligero (estilo Caprover o Heroku) enfocado en gestionar clientes y aprovisionar recursos dinámicamente en producción:
* **Creación Automática de Instancias:** Asignación secuencial de subdominios correlativos (`vmi01` a `vmi99` bajo el wildcard principal) asignando proxies enrutados de Nginx y puertos libres.
* **Flujo de Despliegue Git en 4 Pasos:**
  1. **Bases de Datos Dedicadas:** Creación instantánea de bases de datos PostgreSQL o MySQL aisladas por contenedor, con consola interactiva SQL para ejecución de scripts directa.
  2. **Variables de Entorno (.env):** Gestión segura de secretos inyectados en caliente al contenedor.
  3. **Conexión a Repositorios GitHub:** Detección automática del entorno de ejecución (NodeJS, React, Python, HTML estático) y auto-configuración del compilador.
  4. **Logs en Tiempo Real (SSE):** Historial y consola en vivo de despliegues mediante Server-Sent Events.
* **Acceso SSH Directo:** Inyección automatizada de claves públicas autorizadas al contenedor aislado para permitir conexiones directas de los desarrolladores.
* **Control de Recursos en Tiempo Real:** Limitación granular de CPU (shares) y memoria RAM de los contenedores Docker en caliente con gráficos de telemetría interactivos.

### 🎮 2. Administrador de Servidores de Juego (Minecraft & Valheim)
* **Consola Interactiva e Inyección de Comandos:** Editor de propiedades interactivo estilo *Aternos* con toggles reactivos y terminal para inyección de comandos en caliente.
* **Sincronización level.dat NBT:** Lógica binaria integrada para leer y modificar propiedades internas del mundo de Minecraft Bedrock (cheats, logros de Xbox Live, modo educativo, dificultades) recalculando el payload NBT y su encabezado para evitar corrupción de archivos.
* **Gestor de Add-ons con Resolución `.lang`:** Extractor recursivo de complementos `.mcpack` y `.mcaddon` con sanitización de caracteres especiales y lectura de archivos de idioma para mostrar nombres de mods reales (evitando la etiqueta genérica `pack.name`).
* **Query RakNet & Steam A2S:** Consulta UDP en segundo plano para conocer el estado y número de jugadores conectados.

### 💤 3. Programador de Suspensión por Inactividad (Auto-Sleep)
* **Optimización de Recursos VPS:** Servicio automático que detiene el contenedor de juego tras 5 minutos sin jugadores conectados, liberando memoria RAM y ciclos de CPU para las aplicaciones web activas de los clientes.

### 🤖 4. Panel de Control Integrado en Discord
* **Bot de Control Multicanal:** Canales dedicados independientes para cada servidor de videojuegos.
* **Tarjetas Interactivas con Botones:** Embeds actualizados dinámicamente con botones de **Encender**, **Apagar** y **Refrescar**.
* **Secuencia de Inicio Animada:** Ciclo dinámico cada 3 segundos de mensajes con detalles del progreso del arranque en Docker, evitando bloqueos por timeouts o excepciones de Docker.

---

## 📂 Estructura del Proyecto

El proyecto está organizado en un monorepo modular:

```
MoonPanel/
├── backend/            # Express REST API + Docker/Nginx Controller + Bot de Discord
│   ├── src/
│   │   ├── controllers/# Controladores para clientes, autenticación y servidores
│   │   ├── middleware/ # Sesión, roles, límites de peticiones y contexto
│   │   ├── routes/     # Endpoints HTTP (PaaS, Administración de Juegos)
│   │   ├── services/   # Servicios (discordBot, levelDat, deploy, playerQuery...)
│   │   └── index.js    # Inicialización del servidor Express y del Bot
│   ├── prisma/         # Esquema de base de datos relacional (PostgreSQL)
│   └── package.json
├── frontend/           # SPA React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/ # Telemetría de recursos, selectores y modales interactivos
│   │   ├── pages/      # Dashboards PaaS, Clientes y Panel de Videojuegos
│   │   └── App.jsx     # Configuración y enrutado seguro
│   ├── tailwind.config.js
│   └── package.json
└── cambios y detalles.md # Documento histórico de cambios detallados en la app
```

---

## 🛠️ Requisitos de Instalación en Producción

### Preparación del Host (Linux / Ubuntu 22.04 o superior)
1. **Docker Engine:** Asegúrate de tener instalado y activo Docker. El backend debe poder comunicarse con el socket `/var/run/docker.sock`.
2. **Nginx & Certbot:** Instalados en el sistema operativo del host para el proxy y gestión automática de SSL.
3. **PostgreSQL:** Servidor activo con una base de datos principal llamada `moonpanel`.
4. **Firewall (UFW):**
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 4000/tcp        # API Backend
   ufw allow 2210:2260/tcp   # SSH para clientes
   ufw allow 19132/udp       # Minecraft Bedrock
   ufw allow 2456:2457/udp   # Valheim
   ufw enable
   ```

---

## ⚡ Guía Rápida de Despliegue

### 1. Configurar Backend
Crea el archivo `backend/.env` con tus credenciales:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/moonpanel?schema=public"
JWT_SECRET="GeneraUnSecretSeguro"
PORT=4000
NODE_ENV=production
DOMAIN="tudominio.com"
ADMIN_EMAIL="admin@tudominio.com"
ADMIN_USERNAME="AdminUsername"
ADMIN_PASSWORD="AdminPasswordSegura"

# Opcionales para el Bot de Discord:
DISCORD_BOT_TOKEN="TokenDeTuBot"
DISCORD_CLIENT_ID="ClientIDDeTuBot"
DISCORD_MINECRAFT_CHANNEL_ID="IDCanalMinecraft"
DISCORD_VALHEIM_CHANNEL_ID="IDCanalValheim"
```
Ejecuta la base de datos e inicia el backend con **PM2** (requiere privilegios root para administrar Nginx y Certbot):
```bash
cd backend
npm install
npx prisma migrate deploy
sudo pm2 start src/index.js --name "moonpanel-backend"
```

### 2. Configurar Frontend
Construye el bundle del frontend y configúralo en tu ruta estática de Nginx:
```bash
cd ../frontend
npm install
npm run build
sudo mkdir -p /var/www/moonpanel
sudo cp -r dist/* /var/www/moonpanel/
```

Configura un virtual host en Nginx (`/etc/nginx/sites-available/tudominio.com`) redirigiendo `/api` al puerto `4000` y sirve el panel estático desde `/var/www/moonpanel`, luego activa el certificado SSL con `certbot --nginx`.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.
