# Windows setup helper for The Sixty's Gelato & Café (development).
# Run in PowerShell from the project root:  ./scripts/setup-windows.ps1
# It checks prerequisites, installs dependencies, prepares the env file, and
# prints the next steps. It does not touch any other project or push anything.

$ErrorActionPreference = "Stop"

Write-Host "== The Sixty's Gelato & Cafe - Windows setup ==" -ForegroundColor Magenta

# 1. Node.js >= 20
try {
  $nodeVersion = (node --version).TrimStart("v")
  $major = [int]($nodeVersion.Split(".")[0])
  if ($major -lt 20) { throw "Node $nodeVersion found; version 20+ is required." }
  Write-Host "Node.js $nodeVersion OK" -ForegroundColor Green
} catch {
  Write-Host "Node.js 20+ is required. Install the LTS from https://nodejs.org/ and re-run." -ForegroundColor Red
  exit 1
}

# 2. Dependencies
Write-Host "Installing dependencies (npm install)..." -ForegroundColor Cyan
npm install

# 3. Environment file
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created .env.local from .env.example - fill in your Supabase keys." -ForegroundColor Yellow
} else {
  Write-Host ".env.local already exists - leaving it as is." -ForegroundColor Green
}

# 4. Sanity check: run the tested calculation core (no database needed)
Write-Host "Running the calculation test suite..." -ForegroundColor Cyan
npm test

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Magenta
Write-Host "  1. Edit .env.local with your Supabase URL and keys."
Write-Host "  2. (Optional) Install the Supabase CLI, then: supabase start; supabase db reset"
Write-Host "  3. Start the app:  npm run dev   ->  http://localhost:3000"
Write-Host "  4. To install as a Windows app, see docs/guides/install-windows.md"
