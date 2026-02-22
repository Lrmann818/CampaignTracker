[CmdletBinding()]
param(
    [string]$OutputDir = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$projectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$verifyScript = Join-Path $scriptDir 'verify-zip.ps1'

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'
$zipName = "refactor-export-$timestamp.zip"
$zipPath = Join-Path $OutputDir $zipName

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("refactor-export-" + [System.Guid]::NewGuid().ToString('N'))
$stagingDir = Join-Path $tempRoot 'payload'

$excludeDirs = @('.git', 'node_modules', 'dist', '.vscode')
$excludeDirPaths = $excludeDirs | ForEach-Object { Join-Path $projectRoot $_ }
$excludeFiles = @('*.zip', '.DS_Store', 'Thumbs.db')

try {
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

    $robocopyArgs = @(
        $projectRoot,
        $stagingDir,
        '*',
        '/E',
        '/R:1',
        '/W:1',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/NC',
        '/NS',
        '/NP',
        '/XD'
    ) + $excludeDirPaths + @(
        '/XF'
    ) + $excludeFiles

    & robocopy @robocopyArgs | Out-Null
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -gt 7) {
        throw "Robocopy failed with exit code $robocopyExitCode."
    }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force

    if (-not (Test-Path -LiteralPath $verifyScript)) {
        throw "Verification script not found: $verifyScript"
    }

    & $verifyScript -ZipPath $zipPath
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
