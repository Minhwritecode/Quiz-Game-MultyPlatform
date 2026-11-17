using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Papyrus.Gamedev
{
    [System.Serializable]
    public class QuizGameAction
    {
        public string action; // "correct", "wrong", "victory", "levelup", "heartbreak"
        public string gameMode; // "survival", "battle", "match", "study"
        public int score;
        public int streak;
        public int lives;
    }

    public class PapyrusGameLogicBridge : MonoBehaviour
    {
        public static PapyrusGameLogicBridge Instance { get; private set; }

        public PapyrusCharacterController characterController;

        [DllImport("__Internal")]
        private static extern void PostMessageToReactNative(string message);

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }

            if (characterController == null)
            {
                characterController = FindObjectOfType<PapyrusCharacterController>();
            }
        }

        /// <summary>
        /// Called from React Native WebView / WebGL:
        /// unityInstance.SendMessage("GameBridge", "ReceiveQuizAction", jsonString);
        /// </summary>
        public void ReceiveQuizAction(string json)
        {
            Debug.Log("[PapyrusBridge] Received action: " + json);
            try
            {
                QuizGameAction actionData = JsonUtility.FromJson<QuizGameAction>(json);
                if (characterController == null)
                {
                    characterController = FindObjectOfType<PapyrusCharacterController>();
                }

                if (characterController != null && actionData != null)
                {
                    characterController.OnWebAction(actionData.action);
                }
            }
            catch (Exception ex)
            {
                // Fallback to plain string action
                if (characterController != null)
                {
                    characterController.OnWebAction(json);
                }
                Debug.LogWarning("[PapyrusBridge] JSON parse failed, used plain string: " + ex.Message);
            }
        }

        /// <summary>
        /// Sends game event back to React Native
        /// </summary>
        public void SendEventToRN(string eventType, string payload)
        {
            string message = $"{{\"event\":\"{eventType}\",\"payload\":{payload}}}";
#if UNITY_WEBGL && !UNITY_EDITOR
            try
            {
                PostMessageToReactNative(message);
            }
            catch (Exception) {}
#else
            Debug.Log("[PapyrusBridge -> RN] " + message);
#endif
        }
    }
}
