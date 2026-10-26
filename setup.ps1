$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 20.19+ or 22 LTS before running setup.'
}
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed. Check the error above.' }
Write-Host 'Dependencies installed. For fictional demo data run: npm run data:demo'
Write-Host 'Then run: npm run dev and open http://127.0.0.1:5173'
