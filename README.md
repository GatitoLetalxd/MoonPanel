# 🌌 MoonPanel

[![Node.js](https://img.shields.io/badge/Node.js-v20.x-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18.x-blue.svg?style=flat-square&logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?style=flat-square&logo=docker)](https://www.docker.com/)
[![Nginx](https://img.shields.io/badge/Nginx-Reverse--Proxy-green?style=flat-square&logo=nginx)](https://nginx.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**MoonPanel** es una plataforma autohospedada de PaaS (Platform-as-a-Service) y administración de servidores diseñada para simplificar el aprovisionamiento, aislamiento y despliegue automático de aplicaciones web y servidores de videojuegos (**Minecraft Bedrock** y **Valheim**) en contenedores Docker independientes. 

Optimiza y exprime al máximo un único servidor VPS (como Contabo), automatizando puertos, subdominios secuenciales, enrutamiento reverso Nginx, bases de datos y certificados SSL con Let's Encrypt de manera instantánea.

---

## 🚀 Pilares Tecnológicos

### 🖥️ 1. Orquestación y Aislamiento PaaS
* **Despliegue GitHub en 4 Pasos:** Auto-detección del entorno de ejecución (NodeJS, React, Python, HTML estático) y auto-configuración de proxies inversos en segundos.
* **Aislamiento Total Docker:** Inyección automática de llaves SSH públicas al contenedor para el acceso seguro de los desarrolladores.
* **Administración de Bases de Datos:** Aprovisionamiento instantáneo de bases de datos PostgreSQL o MySQL integradas dentro del contenedor de la aplicación, con una consola interactiva de consulta SQL.
* **Control de Recursos y Telemetría:** Monitoreo en tiempo real de consumo de CPU, RAM y almacenamiento en disco de cada cliente con hermosas gráficas reactivas.

### 🎮 2. Servidores de Videojuegos (Minecraft & Valheim)
* **Consola Interactiva y server.properties:** Panel de control total estilo *Aternos* con toggles de configuración reactiva rápidos y sin redirección de página.
* **Editor NBT Seguro (level.dat):** Edición segura de reglas internas del mundo en Minecraft Bedrock (cheats, modo educativo, dificultades) procesando de forma nativa la cabecera y el payload NBT.
* **Gestor de Add-ons Inteligente:**
  * Soporte completo para subir archivos `.mcpack`, `.mcaddon` y `.zip`.
  * **Auto-descompresión recursiva:** Desenpaqueta de forma automática meta-archivos con compresión múltiple (ej. mods que traen carpetas de comportamiento y recursos anidados).
  * **Sanitización de Caracteres Especiales:** Evasión de bloqueos en nombres de archivos con caracteres no ASCII, emojis o códigos de color de Minecraft.
  * **Localización Automática:** Resolución del nombre del Add-on consultando los archivos `.lang` internos para evitar que se guarden con etiquetas genéricas (como `pack.name`).
* **Query UDP Nativo:** Monitoreo periódico del estado y número de jugadores activos mediante protocolos RakNet (Minecraft) y Steam A2S (Valheim).

### 💤 3. Programador de Apagado por Inactividad (Auto-Sleep)
* **Cero Desperdicio de Recursos:** Un servicio en segundo plano (Scheduler) monitoriza la actividad de los servidores de juego y detiene el contenedor automáticamente tras 5 minutos sin usuarios conectados, liberando la memoria RAM y ciclos de CPU para las demás instancias activas del servidor.

### 🎨 4. Interfaz de Usuario Cyberpunk & Toasts No Invasivos
* **Alineación Visual Premium:** Diseñado con una paleta oscura, bordes brillantes de acento futuristas, y paneles modales con desenfoque de fondo (`backdrop-blur`).
* **Cero Alertas del Navegador:** Eliminación total de ventanas flotantes `alert()` o `confirm()`. Se ha integrado un sistema propio de **toasts de notificación animados** en la esquina inferior derecha para advertencias, errores y éxitos.

---

## 📂 Arquitectura del Repositorio

El proyecto se estructura como un monorepo ordenado:

```
MoonPanel/
├── backend/            # Express REST API + Motores Docker, Nginx, Git y NBT
│   ├── src/
│   │   ├── controllers/# Lógica para autenticación, gestión de clientes e instancias
│   │   ├── middleware/ # Control de sesión, roles de administrador y contextos
│   │   ├── routes/     # Endpoints REST estructurados por dominio (Admin, Client, Game)
│   │   ├── services/   # Servicios核心 (addonService, levelDatService, deployService...)
│   │   └── index.js    # Punto de entrada de la API Express
│   ├── prisma/         # Esquema de base de datos relacional (PostgreSQL)
│   └── package.json
├── frontend/           # SPA React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/ # Componentes reutilizables, telemetría e indicadores visuales
│   │   ├── pages/      # Dashboards de Cliente, Administrador y Videojuegos (GameDashboard)
│   │   └── App.jsx     # Enrutador y middleware de vistas
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
