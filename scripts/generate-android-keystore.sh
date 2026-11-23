#!/usr/bin/env bash
set -euo pipefail

# Generate a permanent RSA-3072 Android release keystore stored outside Git (.local-signing/)
# Used for free alternative Android stores (Amazon Appstore, Samsung Galaxy Store,
# Huawei AppGallery, Firebase App Distribution, APKPure) and GitHub Releases upgrades.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNING_DIR="${ROOT_DIR}/.local-signing"
KEYSTORE_PATH="${SIGNING_DIR}/papyrus-release.jks"
ALIAS="papyrus-release"

if ! command -v keytool >/dev/null 2>&1; then
  echo "ERROR: 'keytool' not found. Install JDK 17+ first."
  exit 1
fi

umask 077
mkdir -p "${SIGNING_DIR}"
chmod 700 "${SIGNING_DIR}"

if [ -f "${KEYSTORE_PATH}" ]; then
  echo "Permanent release keystore already exists at:"
  echo "  ${KEYSTORE_PATH}"
  echo "Refusing to overwrite an existing signing key (rotating keys breaks app updates)."
else
  PASS="$(openssl rand -base64 24 | tr -d '\n')"
  export PAPYRUS_KS_PASS="${PASS}"
  keytool -genkeypair \
    -keystore "${KEYSTORE_PATH}" \
    -storetype JKS \
    -alias "${ALIAS}" \
    -storepass:env PAPYRUS_KS_PASS \
    -keypass:env PAPYRUS_KS_PASS \
    -keyalg RSA \
    -keysize 3072 \
    -validity 10000 \
    -dname "CN=Papyrus Release, OU=Mobile, O=Papyrus, C=VN" \
    -noprompt
  chmod 600 "${KEYSTORE_PATH}"

  cat <<EOF > "${SIGNING_DIR}/release-secrets.txt"
ANDROID_KEY_ALIAS=${ALIAS}
ANDROID_KEYSTORE_PASSWORD=${PASS}
ANDROID_KEY_PASSWORD=${PASS}
EOF
  chmod 600 "${SIGNING_DIR}/release-secrets.txt"
  echo "Created permanent release keystore at: ${KEYSTORE_PATH}"
  echo "Saved password metadata locally (gitignored) at: ${SIGNING_DIR}/release-secrets.txt"
fi

echo ""
echo "=== Certificate Fingerprints (for Huawei AppGallery / Firebase / Supabase OAuth) ==="
if [ -f "${SIGNING_DIR}/release-secrets.txt" ]; then
  # shellcheck disable=SC1091
  source "${SIGNING_DIR}/release-secrets.txt"
  export PAPYRUS_KS_PASS="${ANDROID_KEYSTORE_PASSWORD}"
  keytool -list -v -keystore "${KEYSTORE_PATH}" -alias "${ALIAS}" -storepass:env PAPYRUS_KS_PASS \
    | grep -E "Alias name:|Valid from:|SHA1:|SHA256:" || true
fi

echo ""
echo "=== Next Steps for GitHub Actions (Option #1 & #2) ==="
echo "1. Copy the base64 keystore to your clipboard:"
echo "     base64 -i \"${KEYSTORE_PATH}\" | tr -d '\\n' | pbcopy"
echo "2. Open GitHub -> Repo Settings -> Secrets and variables -> Actions -> New repository secret:"
echo "     - ANDROID_KEYSTORE_BASE64   (paste from clipboard)"
echo "     - ANDROID_KEYSTORE_PASSWORD (see ${SIGNING_DIR}/release-secrets.txt)"
echo "     - ANDROID_KEY_ALIAS         (${ALIAS})"
echo "     - ANDROID_KEY_PASSWORD      (see ${SIGNING_DIR}/release-secrets.txt)"
echo "3. Back up '${SIGNING_DIR}/' in a secure password manager. NEVER commit it to Git."
