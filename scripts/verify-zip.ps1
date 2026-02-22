[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ZipPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ZipPath)) {
    throw "Zip file not found: $ZipPath"
}

$bannedPrefixes = @(
    '.git/',
    'node_modules/',
    '.vscode/',
    'dist/'
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

try {
    $offendingEntries = New-Object System.Collections.Generic.List[string]

    foreach ($entry in $zip.Entries) {
        $entryPath = ($entry.FullName -replace '\\', '/').TrimStart('/')

        if ([string]::IsNullOrWhiteSpace($entryPath)) {
            continue
        }

        $normalizedPath = $entryPath.ToLowerInvariant()
        $matchesBannedPrefix = $bannedPrefixes | Where-Object {
            $normalizedPath.StartsWith($_.ToLowerInvariant())
        }

        if ($matchesBannedPrefix) {
            $offendingEntries.Add($entry.FullName)
        }
    }

    if ($offendingEntries.Count -gt 0) {
        throw "Release zip verification failed. Banned entries found:`n - $($offendingEntries -join "`n - ")"
    }

    Write-Output 'Release zip is clean'
    Write-Output $ZipPath
}
finally {
    $zip.Dispose()
}
