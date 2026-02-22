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

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

try {
    $offendingEntries = New-Object System.Collections.Generic.List[string]

    foreach ($entry in $zip.Entries) {
        $entryPath = ($entry.FullName -replace '\\', '/').TrimStart('/')

        if ([string]::IsNullOrWhiteSpace($entryPath)) {
            continue
        }

        $segments = $entryPath.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
        $leafName = if ($segments.Length -gt 0) { $segments[$segments.Length - 1] } else { $entryPath }

        $containsBannedDir = $segments | Where-Object {
            $_ -ieq '.git' -or $_ -ieq 'node_modules' -or $_ -ieq 'dist' -or $_ -ieq '.vscode'
        }

        $isBannedFile = $leafName -ieq '.DS_Store' -or $leafName -ieq 'Thumbs.db'

        if ($containsBannedDir -or $isBannedFile) {
            $offendingEntries.Add($entry.FullName)
        }
    }

    if ($offendingEntries.Count -gt 0) {
        throw "Release zip verification failed. Banned entries found:`n - $($offendingEntries -join "`n - ")"
    }

    Write-Output 'Release zip is clean ✅'
}
finally {
    $zip.Dispose()
}
