# 📋 Especificación de Requerimientos del Sistema — MoonPanel

Documento central de seguimiento para los requerimientos funcionales, arquitectónicos y tareas del proyecto MoonPanel, divididos entre funcionalidades completamente implementadas y requerimientos pendientes en el backlog.

---

## 📊 Matriz de Estado General

| Módulo / Funcionalidad | Área | Estado | Versión / Hito |
| :--- | :--- | :---: | :--- |
| **Aprovisionamiento PaaS Web (`vmiXX`)** | PaaS / Clientes | ✅ Implementado | v1.0 |
| **Bases de datos dedicadas (PostgreSQL/MySQL)** | PaaS / BD | ✅ Implementado | v1.0 |
| **Despliegue Git con Logs SSE en Vivo** | PaaS / CI-CD | ✅ Implementado | v1.0 |
| **Acceso SSH Dinámico por Contenedor** | PaaS / Seguridad | ✅ Implementado | v1.0 |
| **Manipulación Binaria NBT `level.dat`** | Juegos / Bedrock | ✅ Implementado | v1.2 |
| **Gestor de Add-ons con Resolución `.lang`** | Juegos / Bedrock | ✅ Implementado | v1.3 |
| **Query UDP RakNet & Steam A2S** | Juegos / Telemetría | ✅ Implementado | v1.3 |
| **Scheduler de Auto-Sleep (5 min inactividad)** | Juegos / Optimización | ✅ Implementado | v1.4 |
| **Bot de Discord Multicanal con Botones** | Integraciones / Bot | ✅ Implementado | v1.4 |
| **Plugin BepInEx de Limpieza de Suelo** | Juegos / Valheim | ✅ Implementado | v1.5 |
| **Normalización de CPU & RAM Docker Stats** | Monitoreo / Core | ✅ Implementado | v1.6 |
| **Storage Dinámico para Servidores de Juego** | Monitoreo / Core | ✅ Implementado | v1.6 |
| **Persistencia /opt/valheim (Caché Steam)** | Juegos / Valheim | ✅ Implementado | v1.7 |
| **Sistema de Whitelist de Items en Limpieza** | Juegos / Valheim | ⏳ Pendiente | Backlog |
| **Backups Automatizados con Rotación** | Juegos / Backups | ⏳ Pendiente | Backlog |
| **Historial Gráfico de Telemetría (24h / 7d)** | Monitoreo / DB | ⏳ Pendiente | Backlog |

---

## 1. Requerimientos Implementados

### 1.1 Módulo PaaS de Clientes Web
* **Asignación Correlativa de Subdominios:** Asignación automática desde `vmi01` hasta `vmi99` bajo el wildcard de `moondev.online`.
* **Configuración de Nginx Reverse Proxy:** Creación de bloques de configuración dinámicos en `/etc/nginx/sites-available/` y recarga en caliente sin reiniciar el servicio global.
* **Aislamiento de Contenedores:** Imagen Docker base optimizada (`moonpanel-client-base:latest`) con ejecución de código independiente.
* **Inyección de Claves SSH:** Endpoint seguro para codificar claves públicas en Base64 e inyectarlas dentro de `/root/.ssh/authorized_keys` del contenedor respectivo, evitando inyecciones de comandos en la shell.
* **Bases de Datos Aisladas:** Soporte para aprovisionar PostgreSQL y MySQL con puertos mapeados únicos y consola SQL interactiva web para ejecución de consultas DDL/DML.
* **Flujo Git y Compilación:** Clonación segura de repositorios públicos o privados de GitHub con detección de entornos (Node.js, React, HTML estático) y streaming de logs de compilación mediante Server-Sent Events (SSE).

### 1.2 Monitoreo y Normalización de Recursos
* **Normalización de CPU (Multi-core Standard):**
  - Implementación de la fórmula estándar de `docker stats`: `(cpuDelta / systemDelta) * online_cpus * 100`.
  - Escala coherente en sistemas multi-core (100% = 1 núcleo completamente saturado, hasta 400% en host de 4 vCPUs).
* **RAM Real Activa (Descuento de Caché Inactiva):**
  - Descuento de `inactive_file` (cgroups v2) o `total_inactive_file` (cgroups v1) de la métrica bruta `stats.memory_stats.usage`.
  - Refleja únicamente la memoria de trabajo no reciclable (RSS), evitando falsas alarmas de saturación por el Page Cache de disco.
* **Detección Automática de Almacenamiento en Disco:**
  - Resolución inteligente de rutas de almacenamiento: verifica si el contenedor pertenece a un cliente web (`/home/clients/{containerName}`) o a un servidor de videojuegos (`/opt/gameservers/{valheim|mc1|mc2}/data`), calculando con precisión los megabytes consumidos en disco.
* **Polling en Tiempo Real:** Sincronización automática de métricas en el frontend cada 7 segundos en la vista de servidor activo.

### 1.3 Servidores de Juegos: Valheim
* **Control de Ciclo de Vida:** Encendido, apagado limpio y reinicio de contenedores basados en `lloesche/valheim-server`.
* **Plugin Nativo C# (`MoonPanelPlugin`):**
  - Desarrollado sobre `.NET Standard 2.0` con BepInEx 5.x.
  - Bridge de comandos por sistema de archivos con validación por marca de tiempo (`/config/moonpanel_cmd.txt`), eliminando la dependencia de RCON o puertos extraños.
* **Limpieza de Suelo In-Memory (`cleardrops`):**
  - Recolección dinámica de más de 1,000 prefabs de items registrados en `ObjectDB.instance.m_items`.
  - Iteración segura sobre la memoria de `ZDOMan` (más de 600,000 objetos).
  - Discriminación precisa entre items arrojados (`ItemDrop`) y flora/arbustos silvestres cosechables (`Pickable` como Bayacardas o Dientes de León), garantizando que las plantas naturales del mundo nunca sean eliminadas.
  - Eliminación de triggers duplicados y supresión de notificaciones cuando se eliminan 0 items para evitar spam confuso en el chat del juego.
  - Anuncio global en el chat del juego notificando a los jugadores la cantidad exacta de items limpiados.
* **Persistencia de Binarios y Caché (`/opt/valheim` Bind Mount):**
  - Mapeo persistente de `/opt/gameservers/valheim/server` hacia `/opt/valheim`.
  - Evita la re-descarga de ~2.5 GB en cada guardado de configuración o `--force-recreate`, reduciendo el tiempo de recreación del contenedor a ~1.3 segundos y eliminando el consumo innecesario de tráfico en el VPS.

### 1.4 Servidores de Juegos: Minecraft Bedrock
* **Estabilidad del Mundo (`level.dat` NBT Repair):**
  - Motor de decodificación y reconstrucción binaria del encabezado de 8 bytes de Mojang.
  - Cálculo estricto del tamaño de payload en bytes 4-7, erradicando el crash fatal `gsl::narrowing_error` que ocurría al guardar configuraciones desde paneles web tradicionales.
* **Gestor de Add-ons y Mods:**
  - Extractor recursivo de paquetes `.mcpack` y `.mcaddon` con sanitización de caracteres especiales (Unicode, símbolos de formato `§`).
  - Resolución dinámica de traducciones leyendo archivos `.lang` para evitar nombres genéricos como `pack.name`.
  - Modo protegido: visualización de mods en modo solo lectura mientras el servidor se encuentra en línea.
* **Toggles de Experimentos:** Activación y desactivación de opciones experimentales de Bedrock directamente sincronizadas con el archivo del mundo.

### 1.5 Optimización y Automatización (Auto-Sleep & Discord)
* **Scheduler de Auto-Sleep:**
  - Monitor continuo que consulta periódicamente los puertos UDP de juego (RakNet 19132 y Steam A2S 2457).
  - Apagado automático y guardado de mundo tras 5 minutos continuos (300 segundos) sin jugadores conectados, liberando hasta 2 GB de RAM y ciclos de CPU para los clientes web.
* **Bot de Discord Multicanal:**
  - Mensajes interactivos tipo Embed actualizados en tiempo real en canales dedicados por juego.
  - Botones de acción (**Encender**, **Apagar**, **Refrescar**) con secuencias animadas de arranque cada 3 segundos.

---

## 2. Requerimientos Pendientes (Backlog de Desarrollo)

### 2.1 [PENDIENTE] Sistema de Excepciones / Lista Blanca de Items en Valheim (Whitelist)
* **Objetivo:** Permitir a los administradores definir una lista de objetos y prefabs protegidos que nunca deben eliminarse durante la ejecución de `cleardrops`.
* **Casos Críticos:**
  - Huevos de dragón (`DragonEgg`) y Minerales pesados (`FlametalOre`, `IronScrap`).
  - Núcleos de progresión (`BlackCore`, `SurtlingCore`).
  - Trofeos de jefes (`TrophySeekerQueen`, `TrophyGoblinKing`).
* **Plan de Implementación:**
  1. **Frontend:** Componente de selección múltiple y búsqueda de prefabs en la pestaña de mantenimiento de Valheim.
  2. **Backend:** Endpoints `GET` y `PUT /api/game/instances/:id/valheim/cleanup-whitelist`, persistiendo en base de datos y escribiendo el archivo `/opt/gameservers/valheim/data/bepinex/cleanup_whitelist.txt`.
  3. **Plugin C#:** Carga del archivo de texto, hash de prefabs con `GetStableHashCode()` y exclusión inmediata en el bucle de `ZDOMan`.

### 2.2 [PENDIENTE] Copias de Seguridad Automatizadas con Rotación (Backups)
* **Objetivo:** Generación programada de copias de seguridad de mundos y bases de datos con retención configurable.
* **Alcance:**
  - Snapshot periódico (ej. diario a las 04:00 AM) de `/opt/gameservers/{game}/data`.
  - Compresión en `.tar.gz` almacenada en `/opt/gameservers/backups/`.
  - Política de retención: conservar últimos 7 respaldos diarios y eliminar automáticamente los anteriores para no agotar el disco del VPS.
  - Botón de descarga y restauración en 1 clic desde el panel de control.

### 2.3 [PENDIENTE] Histórico de Telemetría y Gráficos Extendidos
* **Objetivo:** Visualizar el comportamiento de recursos en ventanas de tiempo prolongadas (1 hora, 24 horas, 7 días).
* **Alcance:**
  - Worker en segundo plano que almacena promedios de CPU y RAM cada 5 minutos en una tabla relacional `ResourceTelemetry`.
  - Gráficos tipo AreaChart interactivos en Recharts permitiendo identificar picos de carga o fugas de memoria.
