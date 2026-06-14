# MoonPanel

**MoonPanel** es un panel de control ligero y auto-hospedado (PaaS) diseñado para simplificar el aprovisionamiento, administración y despliegue automático de aplicaciones web en contenedores Docker aislados. Es una solución ideal para gestionar múltiples clientes sobre un único servidor VPS (como Contabo), automatizando la creación de bases de datos, asignación de puertos, generación de subdominios, enrutamiento Nginx y certificados SSL automáticos con Certbot.

---

## Características Principales

### Panel de Administración (ADMIN)
*   **Gestión de Clientes**: Creación y gestión de usuarios clientes con aislamiento completo.
*   **Asignación de Múltiples Instancias**: Capacidad de asignar y vincular más de una instancia independiente (hasta un límite de 10) a una misma cuenta de cliente.
*   **Reserva de Servidores**: Las nuevas instancias se crean inicialmente en estado reservado (PENDING) sin consumir recursos de CPU, RAM o disco del host hasta su activación.
*   **Subdominios vmiXX Secuenciales**: Asignación automática del siguiente subdominio disponible correlativo (vmi01 a vmi99) bajo el comodín wildcard de Nginx.
*   **Asignación de Puertos Dinámica**: Mapeo automático de rangos de puertos HTTP (3010-3129), SSH (2210-2260) y base de datos (5440-5499) libres.
*   **Control del Ciclo de Vida**: Encendido, apagado, reinicio en caliente y lanzamiento forzado de contenedores desde la administración.
*   **Límites de Recursos en Tiempo Real**: Configuración y escalado vertical instantáneo de CPU (shares) y memoria RAM con soporte para MemorySwap en ejecución.
*   **Gestión de Disco Lógico**: Monitoreo y cálculo en tiempo real del almacenamiento consumido (`du -sm`) en el directorio del cliente (`/home/clients/{containerName}`).
*   **Telemetría y Gráficos**: Polling periódico de estadísticas de uso (CPU, RAM, Disco) representado mediante gráficos de área interactivos con Recharts.

### Portal del Cliente (CLIENT)
*   **Selector de Instancias**: Alternancia sencilla y rápida entre múltiples instancias asignadas directamente desde la barra lateral.
*   **Activación bajo Demanda**: Pantalla de configuración inicial para instancias en estado PENDING, permitiendo al cliente elegir el modo de despliegue preferido y aprovisionar su servidor físico en segundos.
*   **Control del Servidor**: Acceso a encendido, apagado y reinicio de su instancia activa.
*   **Acceso SSH**: Registro de claves SSH públicas autorizadas, inyectadas automáticamente al contenedor para su posterior conexión por terminal.
*   **Flujo Secuencial de Despliegue (Pasos 1-4)**:
    1.  **Paso 1: Gestión de Base de Datos**: Instalación instantánea de PostgreSQL o MySQL dentro del contenedor aislado. Cuenta con consola SQL integrada para ejecutar scripts `.sql` directamente y obtener feedback en tiempo real.
    2.  **Paso 2: Variables de Entorno (.env)**: Configuración segura de secretos y credenciales de entorno inyectados directamente a la aplicación.
    3.  **Paso 3: Desplegar Nuevo Repositorio**: Conexión con repositorios públicos de GitHub. Cuenta con auto-detección de entornos (NodeJS, React, Python, HTML estático) y autoconfiguración de proxies. Incluye un acordeón de guías de compatibilidad estructurada.
    4.  **Paso 4: Historial de Despliegues**: Listado de compilaciones previas y conexión vía Server-Sent Events (SSE) a la terminal de logs en tiempo real.

---

## Arquitectura del Proyecto

El proyecto se estructura como un monorepo dividido en dos componentes esenciales:

```
MoonPanel/
├── backend/            # Servidor NodeJS + Express API + Docker & Nginx Services
│   ├── src/
│   │   ├── controllers/# Controladores de autenticación, clientes e instancias
│   │   ├── routes/     # Endpoints REST expuestos (Admin & Client)
│   │   ├── services/   # Motores de comunicación con Docker, Nginx y Git Deploy
│   │   └── index.js    # Punto de entrada principal
│   ├── prisma/         # Esquemas de base de datos y migraciones
│   └── package.json
├── frontend/           # Interfaz de usuario React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/ # Componentes (Layout responsivo, Sidebar drawer, metrics)
│   │   ├── pages/      # Páginas de Cliente (Deployments, MyInstance, SSHKeys) y Admin
│   │   └── App.jsx     # Enrutamiento principal y protección de sesión
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

### Tecnologías Clave
*   **Frontend**: React 18, Vite, Tailwind CSS v3, Recharts, Lucide Icons, Axios.
*   **Backend**: NodeJS, Express, Prisma ORM, JWT, Dockerode (Docker API socket integration), Ripgrep.
*   **Infraestructura**: Docker Engine, Nginx Reverse Proxy, Certbot (Let's Encrypt), PostgreSQL (Base de datos del sistema central).

---

## Guía de Instalación y Configuración

### Requisitos Previos
1.  **Sistema Operativo**: Linux (Ubuntu 24.04 LTS recomendado).
2.  **Docker**: Motor Docker instalado y corriendo. El usuario ejecutor debe pertenecer al grupo `docker` o correr el panel como `root`.
3.  **Nginx**: Servidor web Nginx instalado en el host.
4.  **Certbot**: Utilidad de Let's Encrypt para gestionar SSL automáticos.
5.  **PostgreSQL**: Base de datos del sistema instalada localmente o accesible por red.

---

### Configuración del VPS en Producción

#### 1. Configurar los Registros DNS
Añade los siguientes registros tipo **A** en el panel de control de tu proveedor DNS (apuntando a la IP pública de tu VPS):
*   `moondev.online` → `IP_PUBLICA_VPS`
*   `*.moondev.online` → `IP_PUBLICA_VPS` *(DNS Wildcard para subdominios)*

#### 2. Preparar el Directorio de Clientes
El panel monta volúmenes del sistema de archivos del VPS en los contenedores. Ejecuta lo siguiente:
```bash
mkdir -p /home/clients
chmod 755 /home/clients
```

#### 3. Configurar el Firewall (UFW)
Asegura los accesos del VPS habilitando únicamente los puertos correspondientes:
```bash
# Permitir acceso general a la web y SSH principal
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 4000/tcp # Backend del panel

# Permitir puertos de conexión SSH de clientes
ufw allow 2210:2260/tcp

# Bloquear accesos HTTP directos a contenedores de clientes
ufw deny 3010:3129/tcp

# Activar firewall
ufw enable
```

#### 4. Crear Base de Datos PostgreSQL del Panel
Instala PostgreSQL en el VPS e inicializa la base de datos principal:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo service postgresql start

# Configurar credenciales nativas
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'TU_PASSWORD_SEGURO';"
sudo -u postgres psql -c "CREATE DATABASE moonpanel;"
sudo -u postgres psql -c "CREATE USER moonpanel WITH PASSWORD 'TU_PASSWORD_SEGURO';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE moonpanel TO moonpanel;"
sudo -u postgres psql -c "ALTER DATABASE moonpanel OWNER TO moonpanel;"
sudo -u postgres psql -d moonpanel -c "GRANT ALL ON SCHEMA public TO moonpanel;"
sudo -u postgres psql -c "ALTER USER moonpanel CREATEDB;"
```

#### 5. Configurar el Backend
1.  Ingresa a la carpeta `backend` y crea un archivo `.env`:
    ```env
    DATABASE_URL="postgresql://moonpanel:TU_PASSWORD_SEGURO@localhost:5432/moonpanel?schema=public"
    JWT_SECRET="JWT_SECRET_SEGURO"
    JWT_REFRESH_SECRET="JWT_REFRESH_SECRET_SEGURO"
    PORT=4000
    NODE_ENV=production
    DOMAIN="moondev.online"
    ADMIN_EMAIL="admin@tudominio.com"
    ADMIN_USERNAME="GatitoLetal"
    ADMIN_PASSWORD="PASSWORD_INICIAL_ADMIN"
    ```
2.  Instala las dependencias y ejecuta las migraciones de Prisma:
    ```bash
    npm install
    npx prisma migrate deploy
    ```
3.  Inicia el servidor backend mediante **PM2** (debe ejecutarse como **root** para tener permisos de escritura sobre las carpetas de Nginx en `/etc/nginx/sites-available/` y para interactuar con Certbot):
    ```bash
    npm install -g pm2
    pm2 start src/index.js --name "moonpanel-backend"
    pm2 save
    pm2 startup
    ```

#### 6. Desplegar el Frontend
1.  Ingresa a la carpeta `frontend` e instala las dependencias:
    ```bash
    npm install
    ```
2.  Construye el bundle de producción de Vite:
    ```bash
    npm run build
    ```
3.  Copia los archivos compilados en la carpeta `dist` a la ruta final en el servidor web (por ejemplo, `/var/www/moonpanel`):
    ```bash
    mkdir -p /var/www/moonpanel
    cp -r dist/* /var/www/moonpanel/
    ```
4.  Crea un bloque de Nginx para servir la aplicación en `/etc/nginx/sites-available/panel.moondev.online`:
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
5.  Habilita el sitio en Nginx, reinicia el servicio y genera el certificado SSL automático con Certbot:
    ```bash
    ln -sf /etc/nginx/sites-available/panel.moondev.online /etc/nginx/sites-enabled/
    nginx -s reload
    certbot --nginx -d panel.moondev.online --non-interactive --agree-tos -m admin@tudominio.com
    ```

---

## Desarrollo Local

Si deseas probar cambios localmente:

1.  Asegúrate de tener un motor Docker local en ejecución.
2.  Inicia el backend en modo desarrollo:
    ```bash
    cd backend
    npm install
    npx prisma db push
    npm run dev
    ```
3.  Inicia el servidor de desarrollo del frontend:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    *Nota: Axios está configurado en `frontend/src/api/axios.js` para resolver automáticamente la URL base dependiendo de `window.location.hostname`, lo que permite probar el frontend desde dispositivos en la misma red local.*
