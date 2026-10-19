# 🌐 Contexto del Proyecto — MoonPanel

## 1. Visión y Propósito del Proyecto

**MoonPanel** es una plataforma integral autohospedada que combina dos mundos en un único servidor VPS de recursos contenidos (como Contabo con 4 vCPUs y 8 GB de RAM):

1. **PaaS Ligero (Platform-as-a-Service):** Gestión automatizada de clientes de desarrollo web. Cada cliente recibe un contenedor Docker aislado, un subdominio asignado secuencialmente (`vmi01.moondev.online` a `vmi99.moondev.online`), acceso SSH seguro directo al contenedor, base de datos dedicada (PostgreSQL o MySQL), control de variables de entorno y despliegue continuo mediante Git con logs en tiempo real vía Server-Sent Events (SSE).
2. **Administrador de Servidores de Juegos (Game Server Manager):** Gestión bajo demanda de servidores dedicados (Minecraft Bedrock y Valheim) con telemetría en tiempo real, consola web interactiva, manipulación binaria de archivos de mundo (`level.dat`), gestor de add-ons/mods, plugins nativos para optimización in-game, y control multiplataforma desde Discord.

La filosofía principal del proyecto es la **máxima eficiencia de recursos**: permitir que un servidor modesto corra tanto instancias de desarrollo web como servidores de juegos pesados sin degradar el rendimiento, suspendiendo dinámicamente lo que no se use.

---

## 2. Entorno del Host e Infraestructura

* **Servidor Host:** VPS Linux (Ubuntu x86_64) con 4 núcleos virtuales (vCPUs) y 8 GB de RAM.
* **Dominio Principal:** `moondev.online` con certificado SSL Wildcard gestionado mediante Certbot / Nginx.
* **Gestión de Procesos:** PM2 supervisa el backend (`moonpanel-backend`) en modo fork con reinicio automático.
* **Contenedores y Virtualización:** Docker Engine interactuando directamente a través del socket UNIX `/var/run/docker.sock`.
* **Base de Datos Central del Panel:** PostgreSQL gestionado a través de Prisma ORM.

### Rutas Críticas en el Sistema de Archivos
* `/root/Proyectos/MoonPanel/MoonPanel/`: Código fuente del monorepo (backend y frontend).
* `/var/www/moonpanel/`: Archivos estáticos del frontend en producción (compilación Vite / React).
* `/opt/gameservers/`: Configuración y volúmenes de los servidores de juego administrados por Docker Compose.
  * `/opt/gameservers/valheim/data/`: Datos del mundo, saves y plugins BepInEx de Valheim (montado en `/config`).
  * `/opt/gameservers/valheim/server/`: Archivos del motor del servidor y caché descargada de SteamCMD (montado en `/opt/valheim`).
  * `/opt/gameservers/mc1/data/`: Datos y mundos del servidor 1 de Minecraft Bedrock.
  * `/opt/gameservers/mc2/data/`: Datos y mundos del servidor 2 de Minecraft Bedrock.
  * `/opt/gameservers/docker-compose.yml`: Definición de los contenedores de juegos.
* `/home/clients/`: Carpetas persistentes asociadas a los contenedores web de clientes PaaS (`vmiXX`).

---

## 3. Arquitectura del Monorepo

```
MoonPanel/
├── backend/                      # API REST Express + Controladores Docker/Nginx + Discord Bot
│   ├── prisma/                   # Esquema relacional y migraciones PostgreSQL
│   ├── src/
│   │   ├── controllers/          # Lógica de clientes, auth y servidores de juego
│   │   ├── middleware/           # Autenticación JWT, validación y roles
│   │   ├── routes/               # Rutas de la API (/api/game, /api/clients, /api/auth...)
│   │   ├── services/
│   │   │   ├── dockerService.js  # Telemetría de contenedores (CPU, RAM, Disco) y límites
│   │   │   ├── discordBot.js     # Bot de Discord multicanal interactivo con botones
│   │   │   ├── gameScheduler.js  # Auto-sleep scheduler por inactividad de jugadores
│   │   │   ├── playerQuery.js    # Consultas UDP RakNet (Minecraft) y Steam A2S (Valheim)
│   │   │   ├── levelDatService.js# Modificación binaria NBT segura de level.dat
│   │   │   ├── addonService.js   # Extracción, sanitización y lectura .lang de addons MC
│   │   │   └── nginxService.js   # Generación de bloques de proxy inverso Nginx y SSL
│   │   └── index.js              # Punto de entrada del backend
│   └── package.json
├── frontend/                     # SPA React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/           # Componentes UI (Terminal, Modales, Barras de Recursos, Toasts)
│   │   ├── pages/                # Páginas (GameDashboard, InstanceDetail, MyInstance, Auth)
│   │   ├── api/                  # Configuración de Axios con baseURL dinámica
│   │   └── App.jsx               # Enrutamiento y protección de rutas
│   └── package.json
└── plugins/                      # Código fuente de plugins nativos para servidores de juego
    └── valheim/
        ├── MoonPanelPlugin.cs    # Plugin C# BepInEx para limpieza de suelo y comandos
        └── MoonPanelPlugin.csproj# Configuración de compilación .NET Standard 2.0
```

---

## 4. Componentes Clave y Mecanismos de Funcionamiento

### A. Sistema de Auto-Sleep (Ahorro de Recursos)
Para que los servidores de juego no consuman RAM o CPU de forma ociosa:
* `gameScheduler.js` realiza consultas UDP cada 60 segundos a los puertos de juego (RakNet en puerto 19132 para Minecraft, Steam A2S en puerto 2457 para Valheim).
* Si el número de jugadores conectados se mantiene en 0 durante 5 minutos consecutivos (300 segundos), el scheduler ejecuta un apagado limpio:
  1. Guarda el estado del mundo de forma segura.
  2. Detiene el contenedor Docker correspondiente.
  3. Actualiza el estado en la base de datos a `offline` y notifica a los canales de Discord.

### B. Integración y Control por Discord
* El bot (`MoonBot#8273`) posee canales independientes para Minecraft y Valheim.
* Publica y actualiza un Embed con el estado en vivo, IP, puerto, versión y jugadores en línea.
* Ofrece botones interactivos:
  * **Encender:** Inicia el contenedor Docker e inicia una secuencia animada de progreso (cambio de estado cada 3s).
  * **Apagar:** Detiene el contenedor de forma segura.
  * **Refrescar:** Actualiza la telemetría del mensaje de inmediato.

### C. Plugin Nativo de Valheim (`MoonPanelPlugin`)
Debido a que los contenedores dedicados de Valheim corren mediante BepInEx y Wine/Mono, MoonPanel desarrolló un plugin personalizado en C#:
* **Canal de comunicación seguro:** Lee `/config/moonpanel_cmd.txt` verificando marcas de tiempo de modificación para ejecutar acciones sin tocar la terminal RCON.
* **Limpieza de Items Tirados (`cleardrops`):**
  * Descubre dinámicamente más de 1,000 prefabs registrados en el `ObjectDB` del juego.
  * Itera sobre la piscina de ZDOs de `ZDOMan` (más de 600,000 objetos en memoria).
  * Identifica únicamente objetos dropeados en el suelo (`ItemDrop`), protegiendo plantas silvestres recolectables (`Pickable` como Bayacardas o Dientes de León).
  * Reclama la propiedad del ZDO (`SetOwner`), lo destruye (`m_destroySendList`) y difunde el aviso al chat global del juego.

### D. Manipulación Binaria NBT de Minecraft Bedrock
El archivo `level.dat` de Bedrock cuenta con un encabezado de 8 bytes específico de Mojang (versión de almacenamiento y longitud del payload NBT). Editar este archivo con librerías genéricas alteraba el tamaño sin actualizar los bytes 4 a 7 del encabezado, provocando el fallo fatal `gsl::narrowing_error` al ingresar jugadores.
* `levelDatService.js` decodifica la estructura NBT, aplica toggles (cheats, logros, dificultades, experimentos) y reconstruye el encabezado exacto con el tamaño real de bytes, garantizando 100% de estabilidad.

### E. Telemetría y Normalización de Recursos
* MoonPanel calcula el uso de CPU y RAM a partir del socket de Docker alineándose estrictamente con `docker stats`:
  * **CPU %:** Multiplicado por el número de cores disponibles (`online_cpus = 4`), donde 100% representa la saturación de 1 núcleo físico/virtual completo.
  * **RAM MB:** Descuenta la caché inactiva de archivos del sistema operativo (`inactive_file`), reflejando únicamente la memoria activa no reciclable (RSS).
  * **Disco MB:** Calcula el uso real en disco analizando el directorio persistente asignado en `/opt/gameservers/` o `/home/clients/`.
