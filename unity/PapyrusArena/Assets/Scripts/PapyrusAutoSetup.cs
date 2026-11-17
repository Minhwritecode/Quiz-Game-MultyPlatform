using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using Papyrus.Gamedev;

namespace Papyrus.Editor
{
    [InitializeOnLoad]
    public static class PapyrusAutoSetup
    {
        static PapyrusAutoSetup()
        {
            EditorApplication.delayCall += OnEditorReady;
        }

        private static void OnEditorReady()
        {
            if (GameObject.Find("Celestial_Spire_Arena") == null && GameObject.Find("Papyrus_Mage_Player") == null)
            {
                BuildSurvivalArena();
            }
        }

        // =========================================================================
        // 1. SURVIVAL ARENA (CELESTIAL SPIRE)
        // =========================================================================
        [MenuItem("Papyrus/⚔️ 1. Build Survival Arena (Celestial Spire)")]
        public static void BuildSurvivalArena()
        {
            CleanOldRoots();
            Vector3 origin = GetOrigin();

            GameObject arenaRoot = new GameObject("Celestial_Spire_Arena");
            arenaRoot.transform.position = origin;

            // Materials
            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            Material matStone = CreateMaterial("M_Dark_Slate", new Color(0.08f, 0.11f, 0.18f), 0.1f, 0.8f, shader);
            Material matGold = CreateMaterial("M_Burnished_Gold", new Color(1.0f, 0.82f, 0.22f), 0.9f, 0.25f, shader);
            Material matCyan = CreateMaterial("M_Cyan_Rune_Glow", new Color(0.05f, 0.9f, 1.0f), 0.1f, 0.2f, shader, new Color(0.1f, 0.95f, 1.0f), 8f);
            Material matVoid = CreateMaterial("M_Void_Crimson", new Color(0.45f, 0.05f, 0.12f), 0.2f, 0.4f, shader);
            Material matCrimsonEye = CreateMaterial("M_Crimson_Eye", new Color(1.0f, 0.1f, 0.1f), 0f, 0.1f, shader, new Color(1.0f, 0.15f, 0.15f), 10f);
            Material matHeart = CreateMaterial("M_Crystal_Heart", new Color(1.0f, 0.25f, 0.5f), 0.1f, 0.2f, shader, new Color(1.0f, 0.3f, 0.6f), 7f);
            Material matIndigo = CreateMaterial("M_Royal_Indigo", new Color(0.18f, 0.14f, 0.72f), 0.2f, 0.4f, shader);
            Material matViolet = CreateMaterial("M_Cowl_Violet", new Color(0.45f, 0.20f, 0.88f), 0.1f, 0.4f, shader);
            Material matSkin = CreateMaterial("M_Face_Skin", new Color(1.0f, 0.88f, 0.78f), 0f, 0.6f, shader);

            // Circular Stone Dais
            GameObject dais = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            dais.name = "Dais_Floor";
            dais.transform.parent = arenaRoot.transform;
            dais.transform.localPosition = new Vector3(0, -0.3f, 0);
            dais.transform.localScale = new Vector3(10.4f, 0.3f, 10.4f);
            dais.GetComponent<Renderer>().sharedMaterial = matStone;

            // Magic Circle Inscription
            GameObject mCircle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mCircle.name = "Magic_Circle";
            mCircle.transform.parent = arenaRoot.transform;
            mCircle.transform.localPosition = new Vector3(0, 0.02f, 0);
            mCircle.transform.localScale = new Vector3(6.5f, 0.01f, 6.5f);
            mCircle.GetComponent<Renderer>().sharedMaterial = matCyan;

            // 4 Ancient Rune Pillars
            float pDist = 4.3f;
            float[] angles = { 45f, 135f, 225f, 315f };
            for (int i = 0; i < angles.Length; i++)
            {
                float rad = Mathf.Deg2Rad * angles[i];
                Vector3 pPos = new Vector3(pDist * Mathf.Cos(rad), 1.6f, pDist * Mathf.Sin(rad));

                GameObject pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pillar.name = $"Rune_Pillar_{i + 1}";
                pillar.transform.parent = arenaRoot.transform;
                pillar.transform.localPosition = pPos;
                pillar.transform.localScale = new Vector3(0.76f, 1.6f, 0.76f);
                pillar.GetComponent<Renderer>().sharedMaterial = matStone;

                // Floating Crystal Cap
                GameObject crystal = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                crystal.name = $"Pillar_Crystal_{i + 1}";
                crystal.transform.parent = arenaRoot.transform;
                crystal.transform.localPosition = new Vector3(pPos.x, 3.6f, pPos.z);
                crystal.transform.localScale = new Vector3(0.5f, 0.7f, 0.5f);
                crystal.GetComponent<Renderer>().sharedMaterial = matCyan;
            }

            // --- BOSS: CHIMERA OF IGNORANCE ---
            GameObject boss = new GameObject("Boss_Chimera");
            boss.transform.parent = arenaRoot.transform;
            boss.transform.localPosition = new Vector3(0, 1.4f, 2.4f);

            GameObject bCore = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            bCore.name = "Chimera_Core";
            bCore.transform.parent = boss.transform;
            bCore.transform.localPosition = Vector3.zero;
            bCore.transform.localScale = new Vector3(1.8f, 1.6f, 1.8f);
            bCore.GetComponent<Renderer>().sharedMaterial = matVoid;

            // Spikes on Boss
            for (int s = 0; s < 6; s++)
            {
                float sAng = Mathf.Deg2Rad * (s * 60f + 15f);
                GameObject spike = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                spike.name = $"Spike_{s + 1}";
                spike.transform.parent = boss.transform;
                spike.transform.localPosition = new Vector3(Mathf.Cos(sAng) * 0.9f, 0.4f, Mathf.Sin(sAng) * 0.9f);
                spike.transform.localScale = new Vector3(0.18f, 0.5f, 0.18f);
                spike.GetComponent<Renderer>().sharedMaterial = matVoid;
            }

            // Boss Glowing Eyes
            for (int e = -1; e <= 1; e++)
            {
                GameObject bEye = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                bEye.name = $"Boss_Eye_{e}";
                bEye.transform.parent = boss.transform;
                bEye.transform.localPosition = new Vector3(e * 0.4f, 0.2f, -0.85f);
                bEye.transform.localScale = new Vector3(0.16f, 0.16f, 0.16f);
                bEye.GetComponent<Renderer>().sharedMaterial = matCrimsonEye;
            }

            // --- PLAYER: CHIBI PAPYRUS MAGE ---
            GameObject mage = new GameObject("Papyrus_Mage_Player");
            mage.transform.parent = arenaRoot.transform;
            mage.transform.localPosition = new Vector3(0, 0, -2.0f);

            // Robe
            GameObject robe = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            robe.name = "Mage_Robe";
            robe.transform.parent = mage.transform;
            robe.transform.localPosition = new Vector3(0, 0.55f, 0);
            robe.transform.localScale = new Vector3(0.7f, 0.55f, 0.7f);
            robe.GetComponent<Renderer>().sharedMaterial = matIndigo;

            // Cowl / Shoulders
            GameObject cowl = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            cowl.name = "Mage_Cowl";
            cowl.transform.parent = mage.transform;
            cowl.transform.localPosition = new Vector3(0, 1.05f, 0);
            cowl.transform.localScale = new Vector3(0.8f, 0.7f, 0.8f);
            cowl.GetComponent<Renderer>().sharedMaterial = matViolet;

            // Cute Head
            GameObject head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            head.name = "Mage_Head";
            head.transform.parent = mage.transform;
            head.transform.localPosition = new Vector3(0, 1.25f, -0.05f);
            head.transform.localScale = new Vector3(0.6f, 0.55f, 0.6f);
            head.GetComponent<Renderer>().sharedMaterial = matSkin;

            // Sapphire Eyes
            for (int side = -1; side <= 1; side += 2)
            {
                GameObject eye = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                eye.name = $"Eye_{(side < 0 ? "Left" : "Right")}";
                eye.transform.parent = mage.transform;
                eye.transform.localPosition = new Vector3(side * 0.14f, 1.28f, -0.32f);
                eye.transform.localScale = new Vector3(0.1f, 0.14f, 0.08f);
                eye.GetComponent<Renderer>().sharedMaterial = matCyan;
            }

            // Golden Halo
            GameObject halo = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            halo.name = "Wisdom_Halo";
            halo.transform.parent = mage.transform;
            halo.transform.localPosition = new Vector3(0, 1.72f, 0);
            halo.transform.localScale = new Vector3(0.55f, 0.02f, 0.55f);
            halo.GetComponent<Renderer>().sharedMaterial = matGold;

            // Wisdom Staff
            GameObject staff = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            staff.name = "Wisdom_Staff";
            staff.transform.parent = mage.transform;
            staff.transform.localPosition = new Vector3(0.52f, 0.95f, -0.1f);
            staff.transform.localScale = new Vector3(0.06f, 0.95f, 0.06f);
            staff.GetComponent<Renderer>().sharedMaterial = matGold;

            // Staff Gem (Radiant crystal)
            GameObject gem = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            gem.name = "Staff_Gem";
            gem.transform.parent = staff.transform;
            gem.transform.localPosition = new Vector3(0, 1.05f, 0);
            gem.transform.localScale = new Vector3(3.2f, 0.25f, 3.2f);
            gem.GetComponent<Renderer>().sharedMaterial = matCyan;

            // Staff Light
            GameObject sLight = new GameObject("Staff_Light");
            sLight.transform.parent = staff.transform;
            sLight.transform.localPosition = new Vector3(0, 1.1f, 0);
            Light pLight = sLight.AddComponent<Light>();
            pLight.type = LightType.Point;
            pLight.color = new Color(0.1f, 0.9f, 1.0f);
            pLight.range = 3.5f;
            pLight.intensity = 2.5f;

            // Floating Spellbook
            GameObject book = GameObject.CreatePrimitive(PrimitiveType.Cube);
            book.name = "Floating_Tome";
            book.transform.parent = mage.transform;
            book.transform.localPosition = new Vector3(-0.55f, 1.1f, -0.1f);
            book.transform.localScale = new Vector3(0.32f, 0.08f, 0.42f);
            book.transform.localRotation = Quaternion.Euler(25f, 20f, -30f);
            book.GetComponent<Renderer>().sharedMaterial = matViolet;

            // 3 Crystal Hearts
            List<GameObject> hearts = new List<GameObject>();
            for (int h = 0; h < 3; h++)
            {
                float hAng = Mathf.Deg2Rad * (h * 120f);
                GameObject heart = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                heart.name = $"Crystal_Heart_{h + 1}";
                heart.transform.parent = mage.transform;
                heart.transform.localPosition = new Vector3(Mathf.Cos(hAng) * 0.95f, 1.45f, Mathf.Sin(hAng) * 0.95f);
                heart.transform.localScale = new Vector3(0.2f, 0.24f, 0.2f);
                heart.GetComponent<Renderer>().sharedMaterial = matHeart;
                hearts.Add(heart);
            }

            // --- CONTROLLER COMPONENT ---
            PapyrusCharacterController ctrl = mage.AddComponent<PapyrusCharacterController>();
            ctrl.staffTip = gem.transform;
            ctrl.staffLight = pLight;
            ctrl.haloRing = halo.transform;
            ctrl.bossTarget = boss;
            ctrl.crystalHearts = hearts;

            // --- LOGIC BRIDGE ---
            if (arenaRoot.GetComponent<PapyrusGameLogicBridge>() == null)
            {
                PapyrusGameLogicBridge bridge = arenaRoot.AddComponent<PapyrusGameLogicBridge>();
                bridge.characterController = ctrl;
            }

            // --- LIGHTING SETUP ---
            GameObject lightsObj = new GameObject("Arena_Lighting");
            lightsObj.transform.parent = arenaRoot.transform;

            // Key Light
            GameObject keyL = new GameObject("Key_Light_Gold");
            keyL.transform.parent = lightsObj.transform;
            keyL.transform.localPosition = new Vector3(4f, 6f, -5f);
            Light kl = keyL.AddComponent<Light>();
            kl.type = LightType.Directional;
            kl.color = new Color(1.0f, 0.88f, 0.55f);
            kl.intensity = 1.3f;
            keyL.transform.LookAt(origin);

            // Fill Light
            GameObject fillL = new GameObject("Fill_Light_Cyan");
            fillL.transform.parent = lightsObj.transform;
            fillL.transform.localPosition = new Vector3(-5f, 4f, 3f);
            Light fl = fillL.AddComponent<Light>();
            fl.type = LightType.Directional;
            fl.color = new Color(0.25f, 0.75f, 1.0f);
            fl.intensity = 0.6f;
            fillL.transform.LookAt(origin);

            // Frame camera
            if (SceneView.lastActiveSceneView != null)
            {
                SceneView.lastActiveSceneView.Frame(new Bounds(origin + Vector3.up * 1.5f, Vector3.one * 8f), false);
            }

            Debug.Log("🎉 [Papyrus] Built Survival Arena (Celestial Spire) with full characters & lighting!");
        }

        // =========================================================================
        // 2. COLOSSEUM OF WISDOM
        // =========================================================================
        [MenuItem("Papyrus/🏆 2. Build Colosseum of Wisdom")]
        public static void BuildColosseum()
        {
            CleanOldRoots();
            Vector3 origin = GetOrigin();
            GameObject arenaRoot = new GameObject("Colosseum_Of_Wisdom");
            arenaRoot.transform.position = origin;

            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            Material matMarble = CreateMaterial("M_Marble", new Color(0.92f, 0.94f, 0.96f), 0.1f, 0.35f, shader);
            Material matGold = CreateMaterial("M_Colosseum_Gold", new Color(1.0f, 0.82f, 0.2f), 0.85f, 0.25f, shader);
            Material matStone = CreateMaterial("M_Roman_Pillar", new Color(0.65f, 0.62f, 0.58f), 0f, 0.8f, shader);

            // Octagonal Arena Floor
            GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            floor.name = "Colosseum_Floor";
            floor.transform.parent = arenaRoot.transform;
            floor.transform.localPosition = new Vector3(0, -0.25f, 0);
            floor.transform.localScale = new Vector3(12f, 0.25f, 12f);
            floor.GetComponent<Renderer>().sharedMaterial = matMarble;

            // 8 Pillars
            for (int i = 0; i < 8; i++)
            {
                float ang = Mathf.Deg2Rad * (i * 45f + 22.5f);
                Vector3 pos = new Vector3(5.6f * Mathf.Cos(ang), 1.9f, 5.6f * Mathf.Sin(ang));
                GameObject p = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                p.name = $"Pillar_{i + 1}";
                p.transform.parent = arenaRoot.transform;
                p.transform.localPosition = pos;
                p.transform.localScale = new Vector3(0.64f, 1.9f, 0.64f);
                p.GetComponent<Renderer>().sharedMaterial = matStone;
            }

            // 3-Tier Podium
            for (int st = 0; st < 3; st++)
            {
                float rad = 2.4f - st * 0.6f;
                GameObject step = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                step.name = $"Podium_Step_{st + 1}";
                step.transform.parent = arenaRoot.transform;
                step.transform.localPosition = new Vector3(0, st * 0.2f + 0.1f, 0);
                step.transform.localScale = new Vector3(rad, 0.1f, rad);
                step.GetComponent<Renderer>().sharedMaterial = matGold;
            }

            Debug.Log("🎉 [Papyrus] Built Colosseum of Wisdom!");
        }

        // =========================================================================
        // 3. GRAND PAPYRUS ARCHIVES
        // =========================================================================
        [MenuItem("Papyrus/🧩 3. Build Grand Papyrus Archives")]
        public static void BuildLibraryArchives()
        {
            CleanOldRoots();
            Vector3 origin = GetOrigin();
            GameObject libRoot = new GameObject("Grand_Papyrus_Archives");
            libRoot.transform.position = origin;

            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            Material matWood = CreateMaterial("M_Dark_Oak", new Color(0.28f, 0.15f, 0.08f), 0f, 0.75f, shader);
            Material matParchment = CreateMaterial("M_Parchment_Rune", new Color(0.95f, 0.90f, 0.78f), 0f, 0.6f, shader);
            Material matRuneGlow = CreateMaterial("M_Tablet_Cyan_Glow", new Color(0.1f, 0.9f, 1.0f), 0f, 0.2f, shader, new Color(0.1f, 0.95f, 1.0f), 8f);

            // Floor
            GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Library_Floor";
            floor.transform.parent = libRoot.transform;
            floor.transform.localPosition = new Vector3(0, -0.2f, 0);
            floor.transform.localScale = new Vector3(12f, 0.4f, 10f);
            floor.GetComponent<Renderer>().sharedMaterial = matWood;

            // 6 3D Rune Tablets
            Vector3[] coords = {
                new Vector3(-1.6f, 1.6f, -0.6f), new Vector3(0f, 1.6f, -0.6f), new Vector3(1.6f, 1.6f, -0.6f),
                new Vector3(-1.6f, 1.0f, -1.8f), new Vector3(0f, 1.0f, -1.8f), new Vector3(1.6f, 1.0f, -1.8f)
            };
            for (int t = 0; t < coords.Length; t++)
            {
                GameObject tab = GameObject.CreatePrimitive(PrimitiveType.Cube);
                tab.name = $"Rune_Tablet_{t + 1}";
                tab.transform.parent = libRoot.transform;
                tab.transform.localPosition = coords[t];
                tab.transform.localScale = new Vector3(0.9f, 1.1f, 0.12f);
                tab.GetComponent<Renderer>().sharedMaterial = matParchment;

                GameObject rune = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                rune.name = $"Rune_Glyph_{t + 1}";
                rune.transform.parent = tab.transform;
                rune.transform.localPosition = new Vector3(0, 0, -0.6f);
                rune.transform.localScale = new Vector3(0.35f, 0.35f, 0.35f);
                rune.GetComponent<Renderer>().sharedMaterial = matRuneGlow;
            }

            Debug.Log("🎉 [Papyrus] Built Grand Papyrus Archives!");
        }

        // =========================================================================
        // 4. SANCTUARY OF SCHOLARS
        // =========================================================================
        [MenuItem("Papyrus/📖 4. Build Sanctuary of Scholars")]
        public static void BuildSanctuary()
        {
            CleanOldRoots();
            Vector3 origin = GetOrigin();
            GameObject sRoot = new GameObject("Sanctuary_Of_Scholars");
            sRoot.transform.position = origin;

            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            Material matGrass = CreateMaterial("M_Lush_Moss", new Color(0.15f, 0.55f, 0.22f), 0f, 0.6f, shader);
            Material matFoliage = CreateMaterial("M_Crystal_Foliage", new Color(0.2f, 0.95f, 0.55f), 0f, 0.2f, shader, new Color(0.25f, 1f, 0.6f), 6f);
            Material matWood = CreateMaterial("M_Tree_Trunk", new Color(0.35f, 0.2f, 0.12f), 0f, 0.8f, shader);

            // Floating Island
            GameObject island = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            island.name = "Floating_Island";
            island.transform.parent = sRoot.transform;
            island.transform.localPosition = new Vector3(0, -0.6f, 0);
            island.transform.localScale = new Vector3(11f, 0.6f, 11f);
            island.GetComponent<Renderer>().sharedMaterial = matGrass;

            // Sacred Tree
            GameObject trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.name = "Tree_Trunk";
            trunk.transform.parent = sRoot.transform;
            trunk.transform.localPosition = new Vector3(2.2f, 1.75f, 1.5f);
            trunk.transform.localScale = new Vector3(0.9f, 1.75f, 0.9f);
            trunk.GetComponent<Renderer>().sharedMaterial = matWood;

            GameObject leaves = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            leaves.name = "Crystal_Leaves";
            leaves.transform.parent = sRoot.transform;
            leaves.transform.localPosition = new Vector3(2.2f, 3.8f, 1.5f);
            leaves.transform.localScale = new Vector3(2.6f, 2.6f, 2.6f);
            leaves.GetComponent<Renderer>().sharedMaterial = matFoliage;

            Debug.Log("🎉 [Papyrus] Built Sanctuary of Scholars!");
        }

        // =========================================================================
        // HELPER UTILITIES
        // =========================================================================
        private static void CleanOldRoots()
        {
            string[] names = { "Celestial_Spire_Arena", "Colosseum_Of_Wisdom", "Grand_Papyrus_Archives", "Sanctuary_Of_Scholars", "Papyrus_Deluxe_Scholar", "Papyrus_Character_3D", "Papyrus_Character", "Papyrus_Deluxe_Character" };
            foreach (string n in names)
            {
                GameObject obj = GameObject.Find(n);
                if (obj != null) Object.DestroyImmediate(obj);
            }
        }

        private static Vector3 GetOrigin()
        {
            if (SceneView.lastActiveSceneView != null)
            {
                return SceneView.lastActiveSceneView.pivot;
            }
            return new Vector3(-8.06f, 6.5f, 9.91f);
        }

        private static Material CreateMaterial(string name, Color baseCol, float metallic, float roughness, Shader shader, Color? emissive = null, float emissiveStrength = 1f)
        {
            Material m = new Material(shader);
            m.name = name;
            m.color = baseCol;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", baseCol);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 1f - roughness);

            if (emissive.HasValue)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor"))
                {
                    m.SetColor("_EmissionColor", emissive.Value * emissiveStrength);
                }
            }
            return m;
        }
    }
}
