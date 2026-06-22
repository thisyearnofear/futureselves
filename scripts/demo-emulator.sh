#!/usr/bin/env bash
# One-command runner for the QVAC hackathon demo on an Android emulator.
#
# Prerequisites (one-time, GUI work):
#   1. brew install --cask android-studio  (done)
#   2. Open Android Studio, complete the first-launch setup wizard
#      (accepts SDK license, downloads platform-tools + a default system
#      image). The wizard puts SDK at ~/Library/Android/sdk.
#
# This script then:
#   - Verifies the SDK is present
#   - Ensures a Pixel 6 AVD with Android 14 (API 34) exists, creating
#     it on the appropriate arch (arm64 on Apple Silicon, x86_64 otherwise)
#   - Starts the emulator if not running
#   - Installs the canonical submission APK
#   - Launches the app
#   - Tails the audit log lines in the foreground so you can record the
#     console output alongside the emulator window
#
# Usage:
#   bash scripts/demo-emulator.sh
#
# After running and exercising the app, pull the JSONL artifact:
#   adb shell run-as com.futureselves.app cat \
#     cache/futureselves-audit/run-$(adb shell run-as com.futureselves.app ls cache/futureselves-audit/ | tail -1) \
#     > demo-run.jsonl

set -euo pipefail

APK_PATH="${APK_PATH:-$HOME/Downloads/futureselves-submission.apk}"
AVD_NAME="${AVD_NAME:-FutureSelves_Pixel6_API34}"
ANDROID_API="${ANDROID_API:-34}"
PACKAGE_ID="com.futureselves.app"

# Detect SDK location
if [[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME}" ]]; then
  SDK="${ANDROID_HOME}"
elif [[ -d "$HOME/Library/Android/sdk" ]]; then
  SDK="$HOME/Library/Android/sdk"
else
  echo "ERROR: Android SDK not found."
  echo "  Either install Android Studio (Apple Silicon DMG from"
  echo "  developer.android.com/studio) and complete its first-launch wizard,"
  echo "  or run the bootstrap commands documented at the top of this script."
  exit 1
fi
export ANDROID_HOME="$SDK"
export PATH="$SDK/platform-tools:$SDK/emulator:$SDK/cmdline-tools/latest/bin:$PATH"

# JDK detection: prefer Android Studio's bundled JBR (arm64 on Apple Silicon).
# sdkmanager/avdmanager need a JVM; system java may be absent on a fresh Mac.
if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  elif /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home)"
  else
    echo "ERROR: No JDK found."
    echo "  Install Android Studio (its bundled JBR will be auto-detected) or"
    echo "  set JAVA_HOME to a JDK 17+ install."
    exit 1
  fi
fi
export PATH="$JAVA_HOME/bin:$PATH"

# Verify the APK is downloaded
if [[ ! -f "$APK_PATH" ]]; then
  echo "ERROR: APK not found at $APK_PATH"
  echo "  Download: curl -L -o '$APK_PATH' https://expo.dev/artifacts/eas/OUI85axlwSS8GQBL8zFend5zJtrfDNwuFkY9tRssrLA.apk"
  exit 1
fi

# Pick the right system image for this host arch
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  IMAGE="system-images;android-${ANDROID_API};google_apis;arm64-v8a"
else
  IMAGE="system-images;android-${ANDROID_API};google_apis;x86_64"
fi

echo "==> SDK: $SDK"
echo "==> Target AVD: $AVD_NAME (API $ANDROID_API, $ARCH)"
echo "==> APK: $APK_PATH"
echo ""

# Install the system image if missing
if ! sdkmanager --list_installed 2>/dev/null | grep -q "$IMAGE"; then
  echo "==> Installing system image: $IMAGE"
  echo "    This may take a few minutes (downloads ~1 GB)."
  yes | sdkmanager --licenses >/dev/null 2>&1 || true
  sdkmanager "$IMAGE" "platform-tools" "emulator" "platforms;android-${ANDROID_API}"
fi

# Create the AVD if missing
if ! avdmanager list avd 2>/dev/null | grep -q "Name: $AVD_NAME"; then
  echo "==> Creating AVD: $AVD_NAME"
  echo "no" | avdmanager create avd \
    --name "$AVD_NAME" \
    --package "$IMAGE" \
    --device "pixel_6" \
    --force
fi

# Start the emulator in background if no device is connected
if ! adb devices | grep -q "emulator-"; then
  echo "==> Starting emulator (full first-boot takes 5-10 min for a fresh AVD)..."
  # Subshell + disown so the emulator survives this script ending or being killed
  ( emulator -avd "$AVD_NAME" -no-snapshot-load -no-boot-anim \
      > /tmp/emulator.log 2>&1 < /dev/null & disown ) >/dev/null 2>&1
  echo "    Emulator log: /tmp/emulator.log"

  echo "==> Waiting for device handshake..."
  adb wait-for-device

  # Some emulator + system-image combinations never set sys.boot_completed
  # reliably. The launcher PID is the practical "boot complete" signal: once
  # com.android.launcher3 is up, the home screen is rendering and the device
  # accepts app installs / activity launches.
  echo "==> Waiting for launcher (first boot of a fresh AVD takes 5-10 min on arm64)..."
  # Different system images use different launcher packages. AOSP images use
  # com.android.launcher3; Google APIs / Pixel images use NexusLauncher. We
  # accept any top activity ending in *Launcher*Activity as "boot complete".
  is_launcher_up() {
    adb shell dumpsys activity activities 2>/dev/null \
      | grep -E 'topResumedActivity.*Launcher.*Activity' \
      | grep -q .
  }

  for i in $(seq 1 120); do
    if is_launcher_up; then
      echo "==> Launcher up (after $((i * 5))s)."
      break
    fi
    sleep 5
  done

  if ! is_launcher_up; then
    echo "ERROR: Launcher did not start within 10 min. Check /tmp/emulator.log."
    exit 1
  fi
fi

# Uninstall old version if present (idempotent)
if adb shell pm list packages | grep -q "$PACKAGE_ID"; then
  echo "==> Removing previous install..."
  adb uninstall "$PACKAGE_ID" >/dev/null
fi

echo "==> Installing APK..."
adb install -r "$APK_PATH"

echo "==> Launching app..."
adb shell am start -n "${PACKAGE_ID}/.MainActivity"

echo ""
echo "================================================================"
echo "App is launching on the emulator."
echo ""
echo "Tailing audit log lines from the React Native console."
echo "Look for: [AuditLog] model.load, [AuditLog] llm.completion, etc."
echo ""
echo "To engage airplane mode for the network-kill demo:"
echo "  emulator toolbar → '...' (Extended Controls)"
echo "  → Cellular → Data status: Denied"
echo "  → AND swipe down emulator notification shade, tap WiFi off"
echo ""
echo "After exercising the app (onboarding → check-in → transmission →"
echo "airplane mode → second check-in), pull the audit log:"
echo ""
echo "  adb shell run-as $PACKAGE_ID ls cache/futureselves-audit/"
echo "  adb shell run-as $PACKAGE_ID cat cache/futureselves-audit/run-<file> > demo-run.jsonl"
echo ""
echo "Ctrl-C to stop the log tail (the app keeps running)."
echo "================================================================"
echo ""

adb logcat -c
adb logcat -s ReactNativeJS:V "*:S" | grep --line-buffered "AuditLog"
