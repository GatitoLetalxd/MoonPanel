# Requerimientos y Tareas Pendientes — MoonPanel

Documento de seguimiento para nuevas funcionalidades, mejoras y optimizaciones solicitadas.

---

## 1. Sistema de Limpieza de Suelo en Valheim (Manual Drops Cleanup)

### [PENDIENTE] Sistema de Excepciones / Lista Blanca de Items (Whitelist)

- **Descripción:**  
  Permitir a los administradores definir una lista de objetos/prefabs protegidos que nunca deben ser eliminados durante la limpieza manual de items tirados en el suelo, evitando pérdidas accidentales de recursos de alto valor o rareza.

- **Casos de uso típicos:**  
  - Objetos pesados que se tiran temporalmente al suelo para liberar peso (Huevos de dragón / `DragonEgg`, Minerales de Flametal / `FlametalOre`).
  - Items valiosos de progreso (Núcleos negros / `BlackCore`, Núcleos de Surtling / `SurtlingCore`).
  - Trofeos raros de jefes o enemigos élite (ej. `TrophySeekerQueen`, `TrophyGoblinKing`).

- **Alcance técnico propuesto:**
  1. **Frontend (MoonPanel):**
     - Añadir en la pestaña de configuración/mantenimiento de Valheim un componente visual (selector de tags o lista) para gestionar los items protegidos.
     - Permitir buscar por nombre legible o prefab y guardar los cambios.
  2. **Backend (API REST):**
     - Endpoint para consultar y actualizar la lista de excepciones (`GET/PUT /api/game/instances/:id/valheim/cleanup-whitelist`).
     - Almacenar la lista en la base de datos y sincronizarla en el archivo `bepinex/cleanup_whitelist.txt` de la instancia.
  3. **Plugin BepInEx (`MoonPanelPlugin`):**
     - Lectura del archivo `cleanup_whitelist.txt` al ejecutar la limpieza.
     - Conversión de nombres a hashes (`GetStableHashCode`) y filtrado en el bucle de ZDOs:
       ```csharp
       if (whitelistHashes.Contains(prefab))
       {
           continue; // Inmune a la eliminación
       }
       ```
     - Aplicación en tiempo real sin requerir reinicio del servidor.

- **Estado:** Pendiente de implementación.
