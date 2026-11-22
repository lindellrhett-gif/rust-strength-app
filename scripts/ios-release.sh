#!/usr/bin/env bash
# Builds Rust Strength for iOS on this Mac and uploads it to TestFlight, the
# same way Shelfsmith and Orbit Arena do. Signs in to Apple with the App Store
# Connect API key, so there are no Apple ID password or two-factor prompts.
#
#   scripts/ios-release.sh build      production build on this Mac, .ipa in dist/
#   scripts/ios-release.sh submit     uploads the newest .ipa in dist/ to TestFlight
#   scripts/ios-release.sh sim        simulator build on this Mac, .tar.gz in dist/
#
# Builds use eas build --local: Xcode on this Mac, the signing credentials and
# environment variables stored on EAS, and remote build numbers. They don't use
# the Expo plan's monthly builds and take about 10-20 minutes. EAS builds in a
# temporary copy of the project, so the space in "Rust Strength" doesn't matter.
# Add --cloud to build (or submit the latest build) on Expo's servers instead.
#
# Local builds need Xcode, CocoaPods and fastlane from Homebrew, and
# LANG=en_US.UTF-8. Xcode 27 also needs plugins/withSceneLifecycle.js.
# Add --check to check the settings and the key file without building.
#
# Settings come from submit.production.ios in eas.json and the team id from
# app.json. The key file stays outside the project and is never committed.
# If EAS ever asks for an Apple ID password, press Ctrl+C.

set -euo pipefail
cd "$(dirname "$0")/.."

step="${1:-}"
shift || true
check=false
cloud=false

while [ $# -gt 0 ]; do
  case "$1" in
    --check) check=true ;;
    --cloud) cloud=true ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

case "$step" in
  build|submit|sim) ;;
  *) echo "Usage: scripts/ios-release.sh build|submit|sim [--check] [--cloud]" >&2; exit 2 ;;
esac

read_field() {
  node -e 'process.stdout.write(String(require("./eas.json").submit.production.ios[process.argv[1]] ?? ""))' "$1"
}
key_path="$(read_field ascApiKeyPath)"
key_id="$(read_field ascApiKeyId)"
issuer_id="$(read_field ascApiKeyIssuerId)"
app_id="$(read_field ascAppId)"
team_id="$(node -e 'process.stdout.write(String(require("./app.json").expo.ios.appleTeamId ?? ""))')"

problems=()
for pair in "ascApiKeyPath:$key_path" "ascApiKeyId:$key_id" "ascApiKeyIssuerId:$issuer_id" "ascAppId:$app_id"; do
  [ -n "${pair#*:}" ] || problems+=("eas.json: fill in submit.production.ios.${pair%%:*}")
done
[ -n "$team_id" ] || problems+=("app.json: fill in expo.ios.appleTeamId")
if [ -n "$key_path" ] && [ ! -f "$key_path" ]; then
  problems+=("Key file not found at $key_path")
fi
if ! $cloud && [ "$step" != "submit" ]; then
  for tool in pod fastlane xcodebuild; do
    command -v "$tool" >/dev/null 2>&1 || problems+=("$tool is not installed (brew install cocoapods fastlane, and Xcode)")
  done
  # Shelfsmith and Orbit Arena sign with a different distribution certificate
  # that has the same name as this app's. Each local build puts its certificate
  # in a temporary keychain, and Xcode's export step picks a certificate by
  # name, so two local builds at once can sign with the other app's
  # certificate and fail ("doesn't include signing certificate").
  if pgrep -f eas-cli-local-build-plugin >/dev/null 2>&1; then
    problems+=("Another local iOS build is running (Shelfsmith or Orbit Arena?). Wait for it to finish; two at once can pick the wrong certificate.")
  fi
  if security list-keychains -d user | grep -q "eas-build-"; then
    problems+=("A keychain from an earlier EAS build is still in the keychain list. If no build is running, remove it: security list-keychains -d user -s ~/Library/Keychains/login.keychain-db")
  fi
fi
latest_ipa="$(ls -t dist/*.ipa 2>/dev/null | head -1 || true)"
if ! $cloud && [ "$step" = "submit" ] && [ -z "$latest_ipa" ]; then
  problems+=("No .ipa in dist/. Run scripts/ios-release.sh build first, or use submit --cloud.")
fi
command -v eas >/dev/null 2>&1 || problems+=("eas-cli is not installed: npm install -g eas-cli")

if [ ${#problems[@]} -gt 0 ]; then
  echo "Not ready yet:"
  for p in "${problems[@]}"; do echo "  - $p"; done
  exit 1
fi

if $check; then
  echo "Ready for $step. Key file found, all settings filled in."
  exit 0
fi

# How eas-cli signs in to Apple without an Apple ID. The developer account
# belongs to Bluestem Software LLC, an organisation.
export EXPO_ASC_API_KEY_PATH="$key_path"
export EXPO_ASC_KEY_ID="$key_id"
export EXPO_ASC_ISSUER_ID="$issuer_id"
export EXPO_APPLE_TEAM_ID="$team_id"
export EXPO_APPLE_TEAM_TYPE="COMPANY_OR_ORGANIZATION"
export LANG="${LANG:-en_US.UTF-8}"

stamp="$(date +%Y%m%d-%H%M)"
case "$step" in
  build)
    if $cloud; then
      echo "Building the production profile for iOS on Expo's servers."
      eas build --platform ios --profile production
    else
      mkdir -p dist
      out="dist/rust-strength-production-$stamp.ipa"
      echo "Building the production profile for iOS on this Mac. This takes about 10-20 minutes."
      # Interactive on purpose: if the app gains a capability, EAS asks before
      # making a new provisioning profile, and --non-interactive would refuse.
      eas build --local --platform ios --profile production --output "$out"
      echo "Built $out"
    fi
    ;;
  sim)
    mkdir -p dist
    out="dist/rust-strength-simulator-$stamp.tar.gz"
    echo "Building a simulator app (the ios-check profile) on this Mac."
    eas build --local --platform ios --profile ios-check --non-interactive --output "$out"
    echo "Built $out. Unpack it and drag the .app onto a simulator, or: xcrun simctl install booted <the .app>"
    ;;
  submit)
    if $cloud; then
      echo "Uploading Expo's latest build to TestFlight."
      eas submit --platform ios --profile production --latest --non-interactive
    else
      echo "Uploading $latest_ipa to TestFlight."
      eas submit --platform ios --profile production --path "$latest_ipa" --non-interactive
    fi
    ;;
esac
