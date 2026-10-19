# 🌌 MoonPanel

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20.x-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-v18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Docker-Engine-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Nginx-Reverse_Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx" />
  <img src="https://img.shields.io/badge/PostgreSQL-ORM_Prisma-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TailwindCSS-v3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/.NET-Standard_2.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white" alt=".NET" />
  <img src="https://img.shields.io/badge/PM2-Process_Manager-2B037A?style=for-the-badge&logo=pm2&logoColor=white" alt="PM2" />
</p>

---

## 📖 Descripción General

**MoonPanel** es una potente plataforma todo-en-uno autohospedada que unifica dos mundos críticos sobre un único servidor VPS de recursos moderados (ej. Contabo con 4 vCPUs y 8 GB de RAM):

1. **PaaS Ligero (Platform-as-a-Service):** Gestión automatizada de clientes de desarrollo web con contenedores Docker independientes, subdominios secuenciales correlativos (`vmi01.moondev.online` a `vmi99.moondev.online`), bases de datos aisladas (PostgreSQL / MySQL), acceso SSH directo por clave pública, y despliegue continuo vía Git con streaming de logs en vivo.
2. **Administración de Servidores de Videojuegos:** Orquestación bajo demanda de servidores dedicados de **Minecraft Bedrock** y **Valheim**, optimizados mediante un **Auto-Sleep Scheduler** por inactividad de jugadores, plugins nativos en C# para limpieza de memoria y suelo, reparación binaria NBT (`level.dat`) e integración bidireccional con **Discord**.

---

## 🌟 Características Principales

### 🖥️ 1. PaaS Multi-Inquilino y Aprovisionamiento Aislado
* **Subdominios Dinámicos Correlativos:** Asignación automática de subdominios (`vmi01`–`vmi99`) sobre el wildcard principal, configurando bloques proxy de Nginx y certificados SSL en caliente.
* **Bases de Datos Aisladas por Contenedor:** Creación bajo demanda de instancias PostgreSQL o MySQL con puertos expuestos únicos y **Consola SQL Web interactiva**.
* **Acceso SSH Seguro sin Inyección de Shell:** Mecanismo seguro de inyección de claves públicas autorizadas codificadas en Base64 directamente al archivo `/root/.ssh/authorized_keys` del contenedor.
* **Despliegue Git con Server-Sent Events (SSE):** Detección automática del stack tecnológico (Node.js, React, HTML estático), compilación en segundo plano y transmisión de logs de compilación en tiempo real.
* **Límites de Recursos Granulares:** Asignación dinámica de cuotas de CPU (`CpuQuota`/`CpuPeriod`) y límites de memoria RAM aplicados vía Docker API.

### 🎮 2. Gestión Avanzada de Servidores de Juegos (Valheim & Minecraft)
* **Consola Interactiva y Editor de Parámetros:** Modificación de modificadores de mundo (Valheim world modifiers) y propiedades del servidor con toggles reactivos.
* **Plugin Nativo C# BepInEx (`MoonPanelPlugin` para Valheim):**
  * Canal de comunicación seguro a través de archivos vigilados por timestamp (`/config/moonpanel_cmd.txt`), sin requerir RCON.
  * **Limpieza de Suelo Inteligente (`cleardrops`):** Descubre dinámicamente más de 1,000 prefabs registrados en el `ObjectDB` y escanea más de 600,000 ZDOs en memoria.
  * **Protección de Flora Silvestre:** Discrimina estrictamente items tirados (`ItemDrop`) de plantas y arbustos naturales cosechables (`Pickable` como Bayacardas / Pukeberries o Dientes de León), garantizando que la flora silvestre nunca sea destruida.
  * Supresión de ejecuciones dobles, silenciamiento de avisos innecesarios cuando se limpian 0 items, y anuncio global automático en el chat del juego.
* **Reparación Binaria NBT de `level.dat` (Minecraft Bedrock):**
  * Decodificación y reconstrucción del encabezado de 8 bytes de Mojang.
  * Actualización exacta del tamaño del payload NBT en los bytes 4–7, erradicando el crash crítico `gsl::narrowing_error` al ingresar jugadores.
* **Gestor de Add-ons con Resolución `.lang`:**
  * Descompresor recursivo de `.mcpack` y `.mcaddon` con sanitización de caracteres especiales y códigos de color (`§`).
  * Lectura de archivos de idioma para mostrar el nombre traducido real de los mods en lugar de identificadores genéricos como `pack.name`.
* **Telemetría UDP Nativa:** Consultas en vivo a través de RakNet (Minecraft puerto UDP 19132) y Steam A2S (Valheim puerto UDP 2457) para determinar el estado y jugadores conectados.

### 📊 3. Motor de Telemetría Normalizado
* **CPU Multi-Core Real:** Multiplicación de la tasa de uso por la cantidad de vCPUs (`online_cpus = 4`), alineándose 1:1 con el estándar UNIX de `docker stats` y `top` (donde 100% representa un núcleo saturado al máximo).
* **RAM Activa (Sin Inflación por Caché):** Descuento automático de la caché inactiva de archivos (`inactive_file`), mostrando el consumo real no reciclable (RSS) de la aplicación en caliente en lugar de la memoria del Page Cache de disco.
* **Detección Dinámica de Almacenamiento:** Mapeo automático de volúmenes persistentes tanto para clientes web (`/home/clients/`) como para servidores de videojuegos (`/opt/gameservers/.../data`).

### 💤 4. Programador de Suspensión por Inactividad (Auto-Sleep)
* **Ahorro de Recursos Crítico:** Servicio en segundo plano que supervisa continuamente la cantidad de jugadores conectados.
* **Apagado Seguro:** Tras 5 minutos consecutivos (300 segundos) con 0 jugadores, el scheduler guarda el mundo de forma limpia y detiene el contenedor Docker, liberando gigabytes de memoria RAM y núcleos de CPU para las aplicaciones web activas.

### 🤖 5. Panel de Control Integrado en Discord
* **Bot Multicanal Dedicado (`MoonBot`):** Canales independientes para Minecraft y Valheim con mensajes tipo Embed actualizados en tiempo real.
* **Controles Interactivos:** Botones de **Encender**, **Apagar** y **Refrescar**.
* **Secuencia de Inicio Animada:** Ciclo de actualización visual cada 3 segundos que muestra el avance del arranque del contenedor en Docker.

---

## 📂 Estructura del Monorepo

```
MoonPanel/
├── backend/                      # API REST Express + Controladores Docker/Nginx + Discord Bot
│   ├── prisma/                   # Esquema relacional (schema.prisma) y migraciones
│   ├── src/
│   │   ├── controllers/          # Controladores (clientes, autenticación, servidores de juego)
│   │   ├── middleware/           # Autenticación JWT, control de roles y validaciones
│   │   ├── routes/               # Endpoints REST (/api/game, /api/clients, /api/auth...)
│   │   ├── services/
│   │   │   ├── dockerService.js  # Telemetría de recursos Docker, límites y gestión de SSH
│   │   │   ├── discordBot.js     # Bot de Discord interactivo con embeds y botones
│   │   │   ├── gameScheduler.js  # Auto-sleep scheduler por inactividad de jugadores
│   │   │   ├── playerQuery.js    # Consultas UDP RakNet y Steam A2S
│   │   │   ├── levelDatService.js# Modificación binaria NBT sin corrupción de cabecera
│   │   │   ├── addonService.js   # Extracción recursiva y localización de addons MC
│   │   │   └── nginxService.js   # Generación de bloques de proxy inverso Nginx y SSL
│   │   └── index.js              # Inicialización de Express, Discord y listeners de Docker
│   └── package.json
├── frontend/                     # SPA React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/           # Componentes UI (Terminal, Barras de Recursos, Toasts)
│   │   ├── pages/                # Vistas principales (GameDashboard, InstanceDetail, MyInstance)
│   │   ├── api/                  # Cliente Axios con resolución de host dinámica
│   │   └── App.jsx               # Enrutamiento protegido
│   ├── tailwind.config.js
│   └── package.json
├── plugins/                      # Código fuente de plugins nativos para servidores de juegos
│   └── valheim/
│       ├── MoonPanelPlugin.cs    # Plugin C# BepInEx para limpieza de suelo y comandos
│       └── MoonPanelPlugin.csproj# Configuración de compilación .NET Standard 2.0
├── contexto.md                   # Documento de contexto técnico de la arquitectura
├── requerimientos.md             # Matriz de requerimientos implementados y backlog
└── cambios y detalles.md         # Registro histórico detallado de cambios
```

---

## 🛠️ Requisitos de Instalación en Producción

### Infraestructura Recomendada
* **Sistema Operativo:** Ubuntu 22.04 LTS o superior (x86_64).
* **Especificaciones Mínimas:** 4 vCPUs, 8 GB de memoria RAM, 50 GB SSD.
* **Software Base:**
  - Docker Engine & Docker Compose v2+
  - Node.js v20.x LTS o superior
  - PM2 (`npm install -g pm2`)
  - Nginx & Certbot (`python3-certbot-nginx`)
  - PostgreSQL 14+
  - SDK de .NET 8.0 (opcional, para compilar plugins C# de Valheim)

### Configuración del Cortafuegos (UFW)
```bash
sudo ufw allow 22/tcp          # Administración SSH del servidor host
sudo ufw allow 80/tcp          # Tráfico HTTP (Nginx / Certbot)
sudo ufw allow 443/tcp         # Tráfico HTTPS (Nginx SSL)
sudo ufw allow 4000/tcp        # API Backend de MoonPanel (restringible a localhost si se usa proxy)
sudo ufw allow 2210:2260/tcp   # Rango de puertos SSH para contenedores de clientes web
sudo ufw allow 19132/udp       # Puerto de juego y query Minecraft Bedrock
sudo ufw allow 2456:2458/udp   # Puertos de juego y Steam A2S Valheim
sudo ufw enable
```

---

## ⚡ Guía Rápida de Despliegue

### 1. Clonar el Repositorio
```bash
git clone https://github.com/GatitoLetalxd/MoonPanel.git /root/Proyectos/MoonPanel/MoonPanel
cd /root/Proyectos/MoonPanel/MoonPanel
```

### 2. Configurar el Backend
Crea el archivo `backend/.env`:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/moonpanel?schema=public"
JWT_SECRET="GeneraUnSecretSeguroYAleatorio"
PORT=4000
NODE_ENV=production
DOMAIN="moondev.online"
ADMIN_EMAIL="admin@moondev.online"
ADMIN_USERNAME="GatitoLetal"
ADMIN_PASSWORD="TuPasswordSegura"

# Configuración del Bot de Discord (Opcional):
DISCORD_BOT_TOKEN="TokenDeTuBot"
DISCORD_CLIENT_ID="ClientIDDeTuBot"
DISCORD_MINECRAFT_CHANNEL_ID="IDCanalMinecraft"
DISCORD_VALHEIM_CHANNEL_ID="IDCanalValheim"
```

Instala dependencias, ejecuta las migraciones de base de datos e inicia el servicio con **PM2**:
```bash
cd backend
npm install
npx prisma migrate deploy
sudo pm2 start src/index.js --name "moonpanel-backend"
sudo pm2 save
sudo pm2 startup
```

### 3. Compilar y Desplegar el Frontend
```bash
cd ../frontend
npm install
npm run build
sudo mkdir -p /var/www/moonpanel
sudo cp -r dist/* /var/www/moonpanel/
```

### 4. Configurar el Proxy Inverso en Nginx
Crea `/etc/nginx/sites-available/panel.moondev.online`:
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

Habilita el sitio, recarga Nginx y genera el certificado SSL con Let's Encrypt:
```bash
sudo ln -sf /etc/nginx/sites-available/panel.moondev.online /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
sudo certbot --nginx -d panel.moondev.online --non-interactive --agree-tos -m admin@moondev.online
```

---

## 🕹️ Servidores de Juego y Directorios Persistentes

Los servidores de videojuegos se gestionan a través de `/opt/gameservers/docker-compose.yml`:
* **Valheim:** Montado en `/opt/gameservers/valheim/data:/config`. Los plugins de BepInEx residen en `/opt/gameservers/valheim/data/bepinex/plugins/`.
* **Minecraft Bedrock 1:** Montado en `/opt/gameservers/mc1/data:/data`.
* **Minecraft Bedrock 2:** Montado en `/opt/gameservers/mc2/data:/data`.

---

## 📄 Licencia

Este proyecto se encuentra bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información.
