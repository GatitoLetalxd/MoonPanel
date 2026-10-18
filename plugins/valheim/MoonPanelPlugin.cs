using System;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
using BepInEx;
using BepInEx.Logging;
using UnityEngine;

namespace MoonPanel.Valheim
{
    [BepInPlugin("com.moonpanel.valheim", "MoonPanel Plugin", "1.0.0")]
    public class MoonPanelPlugin : BaseUnityPlugin
    {
        private static ManualLogSource Log;
        private float checkTimer = 0f;
        private float lastCleanupTime = -10f;
        private static int s_pieceHash = 156685568; // "piece".GetStableHashCode()
        private static FieldInfo m_objectsByIDField = null;

        private readonly string[] triggerPaths = new string[]
        {
            "/config/bepinex/cleanup_drops",
            "/config/bepinex/config/cleanup_drops"
        };

        private readonly string[] commandFilePaths = new string[]
        {
            "/config/bepinex/moonpanel_command.txt",
            "/config/bepinex/config/moonpanel_command.txt"
        };

        public static int GetStableHashCode(string str)
        {
            if (string.IsNullOrEmpty(str)) return 0;
            int hash1 = 5381;
            int hash2 = hash1;
            int i = 0;
            while (i < str.Length)
            {
                int c = (int)str[i];
                hash1 = ((hash1 << 5) + hash1) ^ c;
                if (i == str.Length - 1) break;
                int c2 = (int)str[i + 1];
                hash2 = ((hash2 << 5) + hash2) ^ c2;
                i += 2;
            }
            return hash1 + (hash2 * 1566083941);
        }

        void Awake()
        {
            Log = Logger;
            Log.LogInfo("=================================================");
            Log.LogInfo("[MoonPanel] Plugin v1.0.0 inicializado con éxito");
            Log.LogInfo("=================================================");

            try
            {
                s_pieceHash = GetStableHashCode("piece");
            }
            catch (Exception ex)
            {
                Log.LogWarning("[MoonPanel] Error inicializando s_pieceHash: " + ex.Message);
            }

            try
            {
                m_objectsByIDField = typeof(ZDOMan).GetField("m_objectsByID", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            }
            catch (Exception ex)
            {
                Log.LogError("[MoonPanel] Error localizando m_objectsByID: " + ex.Message);
            }
        }

        void Update()
        {
            checkTimer += Time.deltaTime;
            if (checkTimer < 0.5f) return;
            checkTimer = 0f;

            // 1. Verificación atómica de trigger para limpieza de suelo
            bool shouldCleanup = false;
            for (int i = 0; i < triggerPaths.Length; i++)
            {
                string p = triggerPaths[i];
                if (File.Exists(p))
                {
                    shouldCleanup = true;
                    try
                    {
                        File.Delete(p);
                    }
                    catch (Exception ex)
                    {
                        Log.LogError("[MoonPanel] Error eliminando trigger: " + ex.Message);
                    }
                }
            }

            if (shouldCleanup)
            {
                if (Time.time - lastCleanupTime > 2f)
                {
                    lastCleanupTime = Time.time;
                    ExecuteCleanup();
                }
                else
                {
                    Log.LogInfo("[MoonPanel] Solicitud de limpieza duplicada ignorada por cooldown.");
                }
            }

            // 2. Verificación de comando bajo demanda
            for (int i = 0; i < commandFilePaths.Length; i++)
            {
                string p = commandFilePaths[i];
                if (File.Exists(p))
                {
                    string cmd = "";
                    try
                    {
                        cmd = File.ReadAllText(p).Trim();
                        File.Delete(p);
                    }
                    catch (Exception ex)
                    {
                        Log.LogError("[MoonPanel] Error procesando moonpanel_command.txt: " + ex.Message);
                    }

                    if (!string.IsNullOrEmpty(cmd))
                    {
                        if (cmd.Equals("cleanup", StringComparison.OrdinalIgnoreCase) ||
                            cmd.Equals("clean_drops", StringComparison.OrdinalIgnoreCase))
                        {
                            ExecuteCleanup();
                        }
                        else
                        {
                            ExecuteConsoleCommand(cmd);
                        }
                    }
                    break;
                }
            }
        }

        private void RegisterItemPrefab(GameObject prefab, HashSet<int> targetSet)
        {
            if (prefab == null) return;
            try
            {
                ItemDrop id = prefab.GetComponent<ItemDrop>();
                if (id == null) id = prefab.GetComponentInChildren<ItemDrop>();

                if (id != null)
                {
                    // Exclusiones estrictas para no borrar nunca recursos naturales ni construcciones
                    if (prefab.GetComponent<Pickable>() != null || prefab.GetComponentInChildren<Pickable>() != null)
                    {
                        return;
                    }
                    if (prefab.GetComponent<Piece>() != null || prefab.GetComponentInChildren<Piece>() != null)
                    {
                        return;
                    }
                    if (prefab.GetComponent<Fish>() != null || prefab.GetComponentInChildren<Fish>() != null)
                    {
                        return;
                    }
                    if (prefab.GetComponent<Character>() != null || prefab.GetComponentInChildren<Character>() != null)
                    {
                        return;
                    }
                    if (prefab.GetComponent<Container>() != null || prefab.GetComponentInChildren<Container>() != null)
                    {
                        return;
                    }

                    int h1 = (ZNetScene.instance != null) ? ZNetScene.instance.GetPrefabHash(prefab) : 0;
                    if (h1 != 0) targetSet.Add(h1);

                    int h2 = GetStableHashCode(prefab.name);
                    if (h2 != 0) targetSet.Add(h2);

                    if (id.m_itemData != null && id.m_itemData.m_dropPrefab != null)
                    {
                        int h3 = GetStableHashCode(id.m_itemData.m_dropPrefab.name);
                        if (h3 != 0) targetSet.Add(h3);
                    }
                }
            }
            catch {}
        }

        private void ExecuteCleanup()
        {
            Log.LogInfo("[MoonPanel] Solicitud de limpieza de suelo recibida. Procesando...");
            int count = 0;
            try
            {
                // 1. Identificar todos los prefabs de tipo ItemDrop legítimos (ZNetScene + ObjectDB)
                HashSet<int> itemDropPrefabHashes = new HashSet<int>();

                // A. Prefabs en ZNetScene
                if (ZNetScene.instance != null)
                {
                    if (ZNetScene.instance.m_prefabs != null)
                    {
                        for (int i = 0; i < ZNetScene.instance.m_prefabs.Count; i++)
                        {
                            RegisterItemPrefab(ZNetScene.instance.m_prefabs[i], itemDropPrefabHashes);
                        }
                    }

                    try
                    {
                        List<string> prefabNames = ZNetScene.instance.GetPrefabNames();
                        if (prefabNames != null)
                        {
                            for (int i = 0; i < prefabNames.Count; i++)
                            {
                                string name = prefabNames[i];
                                if (!string.IsNullOrEmpty(name))
                                {
                                    GameObject go = ZNetScene.instance.GetPrefab(name);
                                    if (go != null)
                                    {
                                        RegisterItemPrefab(go, itemDropPrefabHashes);
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.LogWarning("[MoonPanel] Error leyendo GetPrefabNames: " + ex.Message);
                    }
                }

                // B. Items en ObjectDB (catálogo completo de items del juego)
                if (ObjectDB.instance != null && ObjectDB.instance.m_items != null)
                {
                    for (int i = 0; i < ObjectDB.instance.m_items.Count; i++)
                    {
                        RegisterItemPrefab(ObjectDB.instance.m_items[i], itemDropPrefabHashes);
                    }
                }

                // C. Inclusiones directas explícitas de seguridad para Bayarcadas / Bukeperries
                itemDropPrefabHashes.Add(GetStableHashCode("Pukeberries"));
                itemDropPrefabHashes.Add(GetStableHashCode("Bukeperries"));

                Log.LogInfo("[MoonPanel] Prefabs de items reconocidos para limpieza: " + itemDropPrefabHashes.Count);

                // 2. Escaneo de ZDOs en ZDOMan (cubre objetos en sectores remotos de jugadores)
                if (ZDOMan.instance != null)
                {
                    if (m_objectsByIDField == null)
                    {
                        m_objectsByIDField = typeof(ZDOMan).GetField("m_objectsByID", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                    }

                    if (m_objectsByIDField != null)
                    {
                        Dictionary<ZDOID, ZDO> allZdos = m_objectsByIDField.GetValue(ZDOMan.instance) as Dictionary<ZDOID, ZDO>;
                        if (allZdos != null)
                        {
                            List<ZDO> dropsToRemove = new List<ZDO>();

                            foreach (KeyValuePair<ZDOID, ZDO> kvp in allZdos)
                            {
                                ZDO zdo = kvp.Value;
                                if (zdo == null) continue;

                                // Si está fijado como pieza o expuesto en soportes de items/armaduras, NUNCA borrar
                                if (s_pieceHash != 0 && zdo.GetBool(s_pieceHash, false))
                                {
                                    continue;
                                }

                                int prefab = zdo.GetPrefab();
                                if (prefab != 0 && itemDropPrefabHashes.Contains(prefab))
                                {
                                    dropsToRemove.Add(zdo);
                                }
                            }

                            for (int i = 0; i < dropsToRemove.Count; i++)
                            {
                                ZDO zdo = dropsToRemove[i];
                                if (zdo == null) continue;

                                try
                                {
                                    ZNetView nview = (ZNetScene.instance != null) ? ZNetScene.instance.FindInstance(zdo) : null;
                                    if (nview != null && nview.gameObject != null)
                                    {
                                        if (!nview.IsOwner())
                                        {
                                            nview.ClaimOwnership();
                                        }
                                        if (ZNetScene.instance != null)
                                        {
                                            ZNetScene.instance.Destroy(nview.gameObject);
                                        }
                                        else
                                        {
                                            UnityEngine.Object.Destroy(nview.gameObject);
                                        }
                                    }
                                    else
                                    {
                                        if (!zdo.IsOwner())
                                        {
                                            zdo.SetOwner(ZDOMan.GetSessionID());
                                        }
                                        ZDOMan.instance.DestroyZDO(zdo);
                                    }
                                    count++;
                                }
                                catch (Exception ex)
                                {
                                    Log.LogWarning("[MoonPanel] Excepción destruyendo ZDO drop: " + ex.Message);
                                }
                            }
                        }
                    }
                }

                // 3. Pasada complementaria para GameObjects activos en Unity (si hubiere en la escena local)
                try
                {
                    ItemDrop[] activeDrops = UnityEngine.Object.FindObjectsOfType<ItemDrop>();
                    if (activeDrops != null && activeDrops.Length > 0)
                    {
                        for (int i = 0; i < activeDrops.Length; i++)
                        {
                            ItemDrop drop = activeDrops[i];
                            if (drop == null || drop.gameObject == null) continue;
                            try { if (drop.IsPiece()) continue; } catch {}
                            if (drop.GetComponent<Pickable>() != null || drop.GetComponent<Piece>() != null || drop.GetComponent<Fish>() != null) continue;

                            ZNetView nview = drop.GetComponent<ZNetView>();
                            if (nview != null && nview.IsValid())
                            {
                                if (!nview.IsOwner())
                                {
                                    nview.ClaimOwnership();
                                }
                                nview.Destroy();
                            }
                            else
                            {
                                if (ZNetScene.instance != null)
                                {
                                    ZNetScene.instance.Destroy(drop.gameObject);
                                }
                                else
                                {
                                    UnityEngine.Object.Destroy(drop.gameObject);
                                }
                            }
                            count++;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Log.LogWarning("[MoonPanel] Excepción en pasada activa Unity: " + ex.Message);
                }

                if (count > 0)
                {
                    Log.LogInfo("[MoonPanel] ¡Limpieza completada! Se eliminaron " + count + " items del suelo.");

                    // Notificar en pantalla a todos los jugadores ÚNICAMENTE si se eliminó al menos 1 item
                    if (ZRoutedRpc.instance != null)
                    {
                        try
                        {
                            ZRoutedRpc.instance.InvokeRoutedRPC(ZRoutedRpc.Everybody, "ShowMessage", 2, "Se han eliminado " + count + " items del suelo.");
                        }
                        catch (Exception ex)
                        {
                            Log.LogWarning("[MoonPanel] Aviso en pantalla a jugadores omitido: " + ex.Message);
                        }
                    }
                }
                else
                {
                    Log.LogInfo("[MoonPanel] Limpieza completada: 0 items en el suelo.");
                }
            }
            catch (Exception ex)
            {
                Log.LogError("[MoonPanel] Excepción general durante la limpieza de items: " + ex.Message);
            }
        }

        private void ExecuteConsoleCommand(string cmd)
        {
            try
            {
                if (Console.instance != null)
                {
                    Console.instance.TryRunCommand(cmd, false, true);
                    Log.LogInfo("[MoonPanel] Comando ejecutado con éxito: " + cmd);
                }
                else
                {
                    Log.LogWarning("[MoonPanel] Console.instance es null. No se pudo ejecutar: " + cmd);
                }
            }
            catch (Exception ex)
            {
                Log.LogError("[MoonPanel] Excepción al ejecutar comando (" + cmd + "): " + ex.Message);
            }
        }
    }
}
