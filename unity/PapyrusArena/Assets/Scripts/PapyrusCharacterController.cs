using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Papyrus.Gamedev
{
    public class PapyrusCharacterController : MonoBehaviour
    {
        [Header("Procedural Motion")]
        public float bobSpeed = 2.0f;
        public float bobHeight = 0.12f;
        public float rotateSpeed = 15.0f;

        [Header("Visual References")]
        public Transform staffTip;
        public Light staffLight;
        public Transform haloRing;
        public GameObject bossTarget;
        public List<GameObject> crystalHearts = new List<GameObject>();

        [Header("VFX & Particles")]
        public LineRenderer knowledgeBeam;
        public ParticleSystem hitParticles;
        public ParticleSystem victoryParticles;
        public ParticleSystem levelUpParticles;

        private Vector3 startPos;
        private Vector3 originalScale;
        private int currentLives = 3;

        private void Start()
        {
            startPos = transform.position;
            originalScale = transform.localScale;

            // Setup knowledge beam if missing
            if (knowledgeBeam == null)
            {
                knowledgeBeam = gameObject.GetComponent<LineRenderer>();
                if (knowledgeBeam == null)
                {
                    knowledgeBeam = gameObject.AddComponent<LineRenderer>();
                    knowledgeBeam.startWidth = 0.15f;
                    knowledgeBeam.endWidth = 0.05f;
                    knowledgeBeam.material = new Material(Shader.Find("Sprites/Default"));
                    knowledgeBeam.startColor = new Color(0.1f, 0.9f, 1f, 1f);
                    knowledgeBeam.endColor = new Color(0.9f, 0.8f, 0.2f, 0.8f);
                    knowledgeBeam.positionCount = 2;
                    knowledgeBeam.enabled = false;
                }
            }
        }

        private void Update()
        {
            // Idle floating bob
            float newY = startPos.y + Mathf.Sin(Time.time * bobSpeed) * bobHeight;
            transform.position = new Vector3(startPos.x, newY, startPos.z);

            // Halo gentle spin
            if (haloRing != null)
            {
                haloRing.Rotate(Vector3.up, rotateSpeed * Time.deltaTime, Space.Self);
            }
        }

        /// <summary>
        /// Triggered on CORRECT ANSWER -> Casts Knowledge Beam to Boss
        /// </summary>
        public void PlayAttack()
        {
            StopAllCoroutines();
            StartCoroutine(AttackRoutine());
        }

        private IEnumerator AttackRoutine()
        {
            // 1. Staff Glow Flare
            if (staffLight != null) staffLight.intensity = 6.0f;

            // 2. Lunge forward
            Vector3 forwardPos = startPos + transform.forward * 0.75f;
            float t = 0f;
            while (t < 1f)
            {
                t += Time.deltaTime * 8f;
                transform.position = Vector3.Lerp(startPos, forwardPos, t);
                transform.localScale = Vector3.Lerp(originalScale, originalScale * 1.2f, t);
                yield return null;
            }

            // 3. Fire Knowledge Beam to Boss
            Vector3 beamStart = staffTip != null ? staffTip.position : transform.position + Vector3.up * 1.5f;
            Vector3 beamEnd = bossTarget != null ? bossTarget.transform.position : transform.position + transform.forward * 4f;

            if (knowledgeBeam != null)
            {
                knowledgeBeam.SetPosition(0, beamStart);
                knowledgeBeam.SetPosition(1, beamEnd);
                knowledgeBeam.enabled = true;
            }

            // Trigger boss damage reaction
            if (bossTarget != null)
            {
                StartCoroutine(BossHurtRoutine(bossTarget));
            }

            if (hitParticles != null)
            {
                hitParticles.transform.position = beamEnd;
                hitParticles.Play();
            }

            yield return new WaitForSeconds(0.25f);

            if (knowledgeBeam != null) knowledgeBeam.enabled = false;

            // 4. Return to start position
            t = 0f;
            while (t < 1f)
            {
                t += Time.deltaTime * 4f;
                transform.position = Vector3.Lerp(forwardPos, startPos, t);
                transform.localScale = Vector3.Lerp(transform.localScale, originalScale, t);
                if (staffLight != null) staffLight.intensity = Mathf.Lerp(staffLight.intensity, 1.5f, t);
                yield return null;
            }
        }

        private IEnumerator BossHurtRoutine(GameObject boss)
        {
            Vector3 bStart = boss.transform.position;
            float elapsed = 0f;
            while (elapsed < 0.35f)
            {
                float shake = Random.Range(-0.15f, 0.15f);
                boss.transform.position = new Vector3(bStart.x + shake, bStart.y, bStart.z + shake);
                elapsed += Time.deltaTime;
                yield return null;
            }
            boss.transform.position = bStart;
        }

        /// <summary>
        /// Triggered on WRONG ANSWER / TIMEOUT -> Breaks 1 Crystal Heart & Stumbles
        /// </summary>
        public void PlayHurt()
        {
            StopAllCoroutines();
            StartCoroutine(HurtRoutine());
        }

        private IEnumerator HurtRoutine()
        {
            // Break 1 Crystal Heart if any remain
            if (crystalHearts != null && crystalHearts.Count > 0 && currentLives > 0)
            {
                currentLives--;
                int heartIdx = Mathf.Clamp(currentLives, 0, crystalHearts.Count - 1);
                if (crystalHearts[heartIdx] != null)
                {
                    crystalHearts[heartIdx].SetActive(false);
                }
            }

            float elapsed = 0f;
            float duration = 0.45f;
            float magnitude = 0.15f;

            while (elapsed < duration)
            {
                float x = Random.Range(-1f, 1f) * magnitude;
                float z = Random.Range(-1f, 1f) * magnitude;
                transform.position = new Vector3(startPos.x + x, transform.position.y - 0.1f, startPos.z + z);
                elapsed += Time.deltaTime;
                yield return null;
            }

            transform.position = startPos;
        }

        /// <summary>
        /// Triggered on VICTORY -> Triumphant Celebration Spin & Burst
        /// </summary>
        public void PlayVictory()
        {
            StopAllCoroutines();
            StartCoroutine(VictoryRoutine());
        }

        private IEnumerator VictoryRoutine()
        {
            if (victoryParticles != null) victoryParticles.Play();

            float t = 0f;
            while (t < 2.5f)
            {
                t += Time.deltaTime;
                transform.Rotate(Vector3.up, 420f * Time.deltaTime, Space.World);
                yield return null;
            }
        }

        /// <summary>
        /// Triggered on STUDY LEVEL UP -> Golden Halo Expansion
        /// </summary>
        public void PlayLevelUp()
        {
            if (levelUpParticles != null) levelUpParticles.Play();
            StartCoroutine(LevelUpRoutine());
        }

        private IEnumerator LevelUpRoutine()
        {
            float t = 0f;
            Vector3 peakScale = originalScale * 1.35f;
            while (t < 1f)
            {
                t += Time.deltaTime * 3f;
                transform.localScale = Vector3.Lerp(originalScale, peakScale, t);
                yield return null;
            }
            t = 0f;
            while (t < 1f)
            {
                t += Time.deltaTime * 2f;
                transform.localScale = Vector3.Lerp(peakScale, originalScale, t);
                yield return null;
            }
        }

        // --- JavaScript WebGL Bridge Interface ---
        public void OnWebAction(string action)
        {
            string clean = action.Trim().ToLower();
            if (clean == "attack" || clean == "correct")
            {
                PlayAttack();
            }
            else if (clean == "hurt" || clean == "wrong")
            {
                PlayHurt();
            }
            else if (clean == "victory")
            {
                PlayVictory();
            }
            else if (clean == "levelup")
            {
                PlayLevelUp();
            }
        }
    }
}
