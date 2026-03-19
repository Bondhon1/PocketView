Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$pocketViewPath = 'f:\tmp\projects\PocketView'
$asadWebPath = 'f:\tmp\projects\ASAD\web'
$targetUrl = 'http://localhost:3000'
$proxyPort = 5076
$desktopUrl = "http://localhost:$proxyPort/?mode=desktop"
$mobileUrl = "http://localhost:$proxyPort/?mode=mobile&mw=412&mh=915&device=Pixel%207"

Set-Location $pocketViewPath

$outLog = Join-Path $pocketViewPath '.tmp_proxy_out.log'
$errLog = Join-Path $pocketViewPath '.tmp_proxy_err.log'

if (Test-Path $outLog) { Remove-Item $outLog -Force }
if (Test-Path $errLog) { Remove-Item $errLog -Force }

$targetOutLog = Join-Path $pocketViewPath '.tmp_target_out.log'
$targetErrLog = Join-Path $pocketViewPath '.tmp_target_err.log'

if (Test-Path $targetOutLog) { Remove-Item $targetOutLog -Force }
if (Test-Path $targetErrLog) { Remove-Item $targetErrLog -Force }

function Test-Url([string]$url, [int]$timeoutSeconds = 5) {
  try {
    $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSeconds
    return $true
  } catch {
    return $false
  }
}

function Wait-Url([string]$url, [int]$retries, [int]$timeoutSecondsPerTry = 5) {
  for ($index = 0; $index -lt $retries; $index += 1) {
    if (Test-Url -url $url -timeoutSeconds $timeoutSecondsPerTry) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

$targetProc = $null
$targetAlreadyUp = Test-Url -url $targetUrl -timeoutSeconds 4

if (-not $targetAlreadyUp) {
  $targetProc = Start-Process npm.cmd -ArgumentList 'run', 'dev' -WorkingDirectory $asadWebPath -PassThru -RedirectStandardOutput $targetOutLog -RedirectStandardError $targetErrLog
  $targetReady = Wait-Url -url $targetUrl -retries 180 -timeoutSecondsPerTry 4
  if (-not $targetReady) {
    Write-Output 'TARGET_NOT_UP'
    if (Test-Path $targetOutLog) { Get-Content $targetOutLog -Raw | Write-Output }
    if (Test-Path $targetErrLog) { Get-Content $targetErrLog -Raw | Write-Output }
    exit 1
  }
}

$proc = Start-Process node -ArgumentList './bin/mlp.js', $targetUrl, "$proxyPort", '--device', 'Pixel 7' -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

try {
  $proxyUp = Wait-Url -url $desktopUrl -retries 90 -timeoutSecondsPerTry 5

  if (-not $proxyUp) {
    Write-Output 'PROXY_NOT_UP'
    if (Test-Path $outLog) { Get-Content $outLog -Raw | Write-Output }
    if (Test-Path $errLog) { Get-Content $errLog -Raw | Write-Output }
    exit 1
  }

  $desktopResponse = Invoke-WebRequest -Uri $desktopUrl -UseBasicParsing -TimeoutSec 60
  $mobileResponse = Invoke-WebRequest -Uri $mobileUrl -UseBasicParsing -TimeoutSec 60

  $desktopOk = $desktopResponse.Content -match '__pocketview_ws'
  $mobileOk = ($mobileResponse.Content -match '__pocketview_ws') -and
              ($mobileResponse.Content -match 'isMobileMode') -and
              ($mobileResponse.Content -match 'pocketview-mobile-frame') -and
              ($mobileResponse.Content -match 'getMobileWidth')

  if ($desktopOk -and $mobileOk) {
    Write-Output 'E2E_PROXY_TEST_OK'
    exit 0
  }

  Write-Output 'E2E_PROXY_TEST_MISSING_MARKERS'
  exit 1
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
  if ($targetProc -and -not $targetProc.HasExited) {
    Stop-Process -Id $targetProc.Id -Force
  }
}