param([string[]]$OriginalFolders = @(
    'C:\Users\I Mine\Documents\Codex\2026-09-19\Agent-Rise-Lead-Desk\Agent-Rise-Fresh-Pour',
    'C:\Users\I Mine\Documents\Codex\2026-09-20\Agent-Rise-Lead-Desk-Fixed-v3\Agent-Rise-Lead-Desk'
))
$ErrorActionPreference = 'Stop'
foreach ($originalFolder in $OriginalFolders) {
    foreach ($name in @('assets','media')) {
        $sourceFolder = Join-Path $originalFolder $name
        if (-not (Test-Path -LiteralPath $sourceFolder -PathType Container)) { throw "Missing source folder: $sourceFolder" }
        $targetFolder = Join-Path $PSScriptRoot $name
        if (-not (Test-Path -LiteralPath $targetFolder)) { New-Item -ItemType Directory -Path $targetFolder | Out-Null }
        Get-ChildItem -LiteralPath $sourceFolder -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $targetFolder $_.Name) -Force }
    }
}
Write-Host 'Assets and media copied from both source builds. The originals were not changed.'
