param(
  [string]$OutputRoot = "backups"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

$schemaFile = Join-Path $backupDirectory "schema.sql"
$dataFile = Join-Path $backupDirectory "data.sql"

Write-Host "Creating schema backup..."
npx --yes supabase db dump --linked --file $schemaFile
if ($LASTEXITCODE -ne 0) { throw "Schema backup failed." }

Write-Host "Creating data backup..."
npx --yes supabase db dump --linked --data-only --use-copy --file $dataFile
if ($LASTEXITCODE -ne 0) { throw "Data backup failed." }

$files = Get-ChildItem -LiteralPath $backupDirectory -File | ForEach-Object {
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName
  [pscustomobject]@{
    Name = $_.Name
    Bytes = $_.Length
    Sha256 = $hash.Hash
  }
}

$manifest = [pscustomobject]@{
  CreatedAt = (Get-Date).ToUniversalTime().ToString("o")
  BackupType = "Supabase logical schema and data"
  Files = $files
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDirectory "manifest.json") -Encoding UTF8
Write-Host "Backup completed: $backupDirectory"

