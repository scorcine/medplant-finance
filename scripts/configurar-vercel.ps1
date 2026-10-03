# Configuração única: liga GitHub + Vercel para deploy automático.
# Execute na pasta do projeto:  .\scripts\configurar-vercel.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== MedPlant — deploy automático na Vercel ===`n" -ForegroundColor Cyan

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "Instale o GitHub CLI: https://cli.github.com/" -ForegroundColor Yellow
  exit 1
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Host "Criando repositório no GitHub e enviando código..." -ForegroundColor Green
  git branch -M main 2>$null
  git add -A
  $status = git status --porcelain
  if ($status) {
    git commit -m "MedPlant: interface inicial Next.js para Vercel"
  }
  gh repo create medplant-finance --public --source=. --remote=origin --push
} else {
  Write-Host "Remote origin já existe: $remote" -ForegroundColor Gray
  git push -u origin main 2>$null
  if ($LASTEXITCODE -ne 0) { git push -u origin master }
}

$repoUrl = (gh repo view --json url -q .url)
Write-Host "`nRepositório: $repoUrl" -ForegroundColor Green

Write-Host "`n--- Passo 1 (só uma vez): conectar na Vercel ---" -ForegroundColor Cyan
$import = "https://vercel.com/new/clone?repository-url=$([uri]::EscapeDataString($repoUrl + '.git'))&project-name=medplant-finance&framework=nextjs"
Write-Host $import
Start-Process $import

Write-Host "`nNa Vercel: Import → Deploy. Depois disso, cada 'git push' pode publicar sozinho.`n" -ForegroundColor White

Write-Host "--- Opção B: GitHub Actions (secrets VERCEL_*) ---" -ForegroundColor Cyan
Write-Host "Após criar o projeto na Vercel, rode localmente (logado): npx vercel link"
Write-Host "Depois: npx vercel env pull  e adicione VERCEL_TOKEN, ORG_ID e PROJECT_ID nos secrets do GitHub.`n"
