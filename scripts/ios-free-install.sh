#!/usr/bin/env bash
set -euo pipefail

# Free iPhone installation helper via Xcode on macOS ($0 Personal Team Apple ID).
# Performs pre-flight checks, prepares the native iOS project, and opens Xcode.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "=== Papyrus Free iOS / iPhone Install Helper ==="
echo ""

if [ "$(uname -s)" != "Darwin" ]; then
  echo "ERROR: Free local iPhone signing requires macOS + Xcode."
  exit 1
fi

echo "[1/4] Checking Xcode & Swift compatibility for Expo SDK 58..."
XCODE_VER="$(xcodebuild -version 2>/dev/null | tr '\n' ' ' || echo 'not installed')"
MACOS_VER="$(sw_vers -productVersion 2>/dev/null || echo 'unknown')"
echo "  macOS: ${MACOS_VER}"
echo "  Xcode: ${XCODE_VER}"

if ! node scripts/check-ios-toolchain.cjs; then
  echo ""
  echo "ACTION REQUIRED (100% Free):"
  echo "  Your Mac runs macOS ${MACOS_VER}, which supports Xcode 26 (Swift 6.2+)."
  echo "  1. Download Xcode 26 (free with regular Apple ID) from:"
  echo "       https://developer.apple.com/download/all/"
  echo "  2. Select it after installing:"
  echo "       sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo "  3. Re-run: npm run ios:free-install"
  echo ""
  echo "  Alternative (no Xcode upgrade needed — iOS Simulator only, Free EAS tier):"
  echo "       npx --no-install eas build --platform ios --profile preview-simulator"
  exit 1
fi

echo ""
echo "[2/4] Checking CocoaPods & connected iOS devices..."
if ! command -v pod >/dev/null 2>&1; then
  echo "ERROR: CocoaPods not found. Install with: brew install cocoapods"
  exit 1
fi
echo "  CocoaPods: $(pod --version)"

if [ ! -f ".env.local" ]; then
  echo "  WARNING: .env.local not found. Copy .env.example -> .env.local to connect Supabase/AI."
fi

if command -v xcrun >/dev/null 2>&1; then
  echo "  Detected iOS devices (USB/Network):"
  xcrun devicectl list devices 2>/dev/null | head -n 15 || xcrun xctrace list devices 2>/dev/null | head -n 15 || true
fi

if [ "${1:-}" = "--check" ]; then
  echo ""
  echo "Pre-flight check finished (--check mode; skipped prebuild)."
  exit 0
fi

echo ""
echo "[3/4] Generating native iOS workspace (APP_VARIANT=development)..."
APP_VARIANT=development npx --no-install expo prebuild --platform ios --no-install
(cd ios && pod install)

WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' | head -n 1)"
if [ -z "${WORKSPACE}" ]; then
  echo "ERROR: Could not find generated .xcworkspace under ios/."
  exit 1
fi

echo ""
echo "[4/4] Opening ${WORKSPACE} in Xcode..."
open "${WORKSPACE}"

cat <<'EOF'

=== 4-Step Free iPhone Install Checklist ($0 Apple ID) ===
1. Plug your iPhone into your Mac via USB -> tap "Trust This Computer".
   On iPhone: Settings -> Privacy & Security -> Developer Mode -> ON (reboot if prompted).
2. In Xcode: Settings (Cmd + ,) -> Accounts -> "+" -> sign in with your regular free Apple ID.
3. Select project "PapyrusDev" -> Target "PapyrusDev" -> Signing & Capabilities:
   - Check "Automatically manage signing"
   - Team: choose "<Your Name> (Personal Team)"
   - Bundle Identifier: set a unique ID (e.g. com.<yourname>.papyrus.dev)
   - If Push Notifications capability warns on Personal Team, remove that capability for free local testing.
4. Pick your iPhone in the top toolbar -> click Run (Cmd + R).
   After install: iPhone -> Settings -> General -> VPN & Device Management -> Trust your Apple ID.
   (Note: Apple requires re-clicking Run in Xcode every 7 days for free Personal Teams.)
EOF
