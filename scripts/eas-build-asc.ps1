<#
  Runs an EAS iOS build signed in to Apple with the App Store Connect API key.
  Only needed when a build has to create or change signing credentials, such
  as the first build after the widget extension was added. Other builds can
  run `eas build` directly and answer No to logging in to Apple.

  The key's path and IDs are read from eas.json (submit.production.ios) and
  the team ID from app.json, so nothing is written here. Sync the PC clock
  first: Apple rejects the key's token if the clock runs ahead.

  Usage:  & .\scripts\eas-build-asc.ps1 development
          & .\scripts\eas-build-asc.ps1 production
          & .\scripts\eas-build-asc.ps1 production -Submit

  -Submit sends a production build to App Store Connect (TestFlight) once it
  finishes, using the same key. Answer Yes to logging in to Apple. If it ever
  asks for an Apple ID password instead, press Ctrl+C.
#>
param(
  [ValidateSet('development', 'production')]
  [string]$BuildProfile = 'development',
  [switch]$Submit
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$ios = (Get-Content (Join-Path $root 'eas.json') -Raw | ConvertFrom-Json).submit.production.ios
if (-not (Test-Path $ios.ascApiKeyPath)) {
  Write-Error "No App Store Connect API key file at $($ios.ascApiKeyPath)"
  exit 1
}

$env:EXPO_ASC_API_KEY_PATH = $ios.ascApiKeyPath
$env:EXPO_ASC_KEY_ID = $ios.ascApiKeyId
$env:EXPO_ASC_ISSUER_ID = $ios.ascApiKeyIssuerId
$env:EXPO_APPLE_TEAM_ID = (Get-Content (Join-Path $root 'app.json') -Raw | ConvertFrom-Json).expo.ios.appleTeamId
$env:EXPO_APPLE_TEAM_TYPE = 'INDIVIDUAL'

if ($Submit -and $BuildProfile -ne 'production') {
  Write-Error 'Only production builds can be sent to TestFlight.'
  exit 1
}

$easArgs = @('build', '--profile', $BuildProfile, '--platform', 'ios')
if ($Submit) { $easArgs += '--auto-submit' }
eas @easArgs
