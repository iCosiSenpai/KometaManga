[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingPlainTextForPassword', '')]
param(
    [string]$KomgaBaseUri = $env:KOMF_KOMGA_BASE_URI,
    [string]$KomgaUser = $env:KOMF_KOMGA_USER,
    [string]$KomgaPassword = $env:KOMF_KOMGA_PASSWORD,
    [string]$JarPath = "./komf-app/build/libs/komf-app-1.0.0-all.jar",
    [string]$BaseUrl = "http://127.0.0.1:8085",
    [switch]$Build,
    [switch]$RequireConnected,
    [int]$StartupTimeoutSeconds = 60,
    [int]$MinimumLibraries = 1,
    [string]$JavaPath
)

$ErrorActionPreference = "Stop"

function Resolve-JavaExe {
    param([string]$ExplicitPath)

    if ($ExplicitPath) {
        if (-not (Test-Path $ExplicitPath)) {
            throw "Java path not found: $ExplicitPath"
        }
        return $ExplicitPath
    }

    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        return $javaCmd.Source
    }

    if ($env:JAVA_HOME) {
        $javaBin = if ($IsWindows) { "java.exe" } else { "java" }
        $candidate = Join-Path $env:JAVA_HOME "bin/$javaBin"
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $adoptiumCandidate = "C:/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot/bin/java.exe"
    if (Test-Path $adoptiumCandidate) {
        return $adoptiumCandidate
    }

    throw "Java executable not found. Set JAVA_HOME, install Java in PATH, or pass -JavaPath."
}

function Wait-ForConnectedEndpoint {
    param(
        [string]$Url,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5
            if ($null -ne $response.success) {
                return $response
            }
        } catch {
            # Keep polling until timeout.
        }

        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    throw "Timed out waiting for endpoint: $Url"
}

$repoRoot = (Resolve-Path ".").Path

if ($Build) {
    Write-Host "[smoke] Building shadow JAR..."
    if ($IsWindows) {
        & ./gradlew.bat shadowjar
    } else {
        & bash ./gradlew shadowjar
    }
}

$resolvedJarPath = if ([System.IO.Path]::IsPathRooted($JarPath)) {
    $JarPath
} else {
    Join-Path $repoRoot $JarPath
}

if (-not (Test-Path $resolvedJarPath)) {
    throw "JAR not found: $resolvedJarPath"
}

$javaExe = Resolve-JavaExe -ExplicitPath $JavaPath
$stdoutLog = Join-Path $repoRoot "smoke-backend.stdout.log"
$stderrLog = Join-Path $repoRoot "smoke-backend.stderr.log"

$previousBaseUri = $env:KOMF_KOMGA_BASE_URI
$previousUser = $env:KOMF_KOMGA_USER
$previousPassword = $env:KOMF_KOMGA_PASSWORD
$previousLogLevel = $env:KOMF_LOG_LEVEL

if ($KomgaBaseUri) { $env:KOMF_KOMGA_BASE_URI = $KomgaBaseUri }
if ($KomgaUser) { $env:KOMF_KOMGA_USER = $KomgaUser }
if ($KomgaPassword) { $env:KOMF_KOMGA_PASSWORD = $KomgaPassword }
$env:KOMF_LOG_LEVEL = "INFO"

Write-Host "[smoke] Starting backend..."
$startInfo = @(
    "-jar",
    $resolvedJarPath
)

$process = Start-Process -FilePath $javaExe -ArgumentList $startInfo -PassThru -NoNewWindow `
    -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

$connectedEndpoint = "$BaseUrl/api/komga/media-server/connected"
$librariesEndpoint = "$BaseUrl/api/komga/media-server/libraries"

try {
    $connected = Wait-ForConnectedEndpoint -Url $connectedEndpoint -TimeoutSeconds $StartupTimeoutSeconds
    Write-Host "[smoke] connected.success=$($connected.success) connected.httpStatusCode=$($connected.httpStatusCode)"

    if ($RequireConnected -and -not $connected.success) {
        throw "RequireConnected is set, but backend reports success=false. error=$($connected.errorMessage)"
    }

    if ($connected.success) {
        $libraries = Invoke-RestMethod -Uri $librariesEndpoint -Method Get -TimeoutSec 15
        $libraryCount = @($libraries).Count
        Write-Host "[smoke] libraries.count=$libraryCount"

        if ($libraryCount -lt $MinimumLibraries) {
            throw "Expected at least $MinimumLibraries libraries, got $libraryCount"
        }
    } else {
        Write-Host "[smoke] Skipping libraries check because connection is not established"
    }

    # Verify frontend is served at root
    $rootResponse = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 5
    if ($rootResponse.StatusCode -ne 200) {
        throw "Root URL returned status $($rootResponse.StatusCode), expected 200"
    }
    if ($rootResponse.Content -notmatch 'KometaManga') {
        throw "Root URL does not contain 'KometaManga' — frontend not bundled correctly"
    }
    Write-Host "[smoke] frontend served at / : OK"

    Write-Host "[smoke] PASS"
} catch {
    Write-Host "[smoke] FAIL: $($_.Exception.Message)"
    if (Test-Path $stdoutLog) {
        Write-Host "[smoke] Backend stdout tail:"
        Get-Content $stdoutLog -Tail 40
    }
    if (Test-Path $stderrLog) {
        Write-Host "[smoke] Backend stderr tail:"
        Get-Content $stderrLog -Tail 40
    }
    throw
} finally {
    $env:KOMF_KOMGA_BASE_URI = $previousBaseUri
    $env:KOMF_KOMGA_USER = $previousUser
    $env:KOMF_KOMGA_PASSWORD = $previousPassword
    $env:KOMF_LOG_LEVEL = $previousLogLevel

    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
