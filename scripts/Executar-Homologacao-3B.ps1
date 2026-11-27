#requires -Version 5.1
param([string]$Back = 'C:\Users\ResTIC55\Desktop\NewFlow - Atual 20_11\NewFlowBack')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $Back -PathType Container)) { throw 'Repositorio nao encontrado.' }
Set-Location -LiteralPath $Back
if ((git branch --show-current).Trim() -ne 'feature/temporizadores-3b') { throw 'Branch incorreta.' }
if (-not (Test-Path -LiteralPath 'tests/integration/automations-3b.integration.ts')) { throw 'Teste 3B nao instalado.' }
if ($env:NEWFLOW_AUTOMATION_WORKER_ENABLED -eq 'true') { throw 'Desligue o worker antes de homologar.' }
$Url = $env:DATABASE_URL
if (-not $Url -and (Test-Path -LiteralPath '.env')) {
  $Line = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($Line) { $Url = ($Line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
}
if (-not $Url) { throw 'DATABASE_URL nao identificada.' }
try { $DbUri = [Uri]$Url; $DbHost = $DbUri.Host } catch { throw 'DATABASE_URL invalida.' }
if (-not $DbHost.EndsWith('.neon.tech')) { throw 'A homologacao exige Neon.' }
if ($DbUri.AbsolutePath -ne '/neondb') { throw 'Banco diferente de neondb. Cancelado.' }
Write-Host "Conexao configurada: $DbHost/neondb" -ForegroundColor Yellow
Write-Host 'PARE backend e worker. Teste cria/remove SOMENTE uma conta aleatoria BPMN3B_*.' -ForegroundColor Yellow
Write-Host 'Nao execute contra producao.' -ForegroundColor Yellow
$Hostname = Read-Host 'Digite o hostname COMPLETO do Neon de testes mostrado acima'
if ($Hostname -cne $DbHost) { throw 'Hostname nao corresponde. Cancelado.' }
$Confirm = Read-Host 'Digite HOMOLOGAR3B para executar os testes e remover dados temporarios'
if ($Confirm -cne 'HOMOLOGAR3B') { throw 'Operacao cancelada.' }
$OldHost = [Environment]::GetEnvironmentVariable('BPMN_3B_EXPECTED_HOST', 'Process')
$OldConfirm = [Environment]::GetEnvironmentVariable('BPMN_3B_CONFIRM', 'Process')
try {
  $env:BPMN_3B_EXPECTED_HOST = $Hostname
  $env:BPMN_3B_CONFIRM = 'HOMOLOGAR3B'
  npx.cmd tsx 'tests/integration/automations-3b.integration.ts'
  if ($LASTEXITCODE -ne 0) { throw 'Falha na homologacao 3B. Nao faca commit nem habilite o worker.' }
  Write-Host 'HOMOLOGACAO REAL 3B APROVADA!' -ForegroundColor Green
} finally {
  if ($null -eq $OldHost) { Remove-Item Env:BPMN_3B_EXPECTED_HOST -ErrorAction SilentlyContinue } else { $env:BPMN_3B_EXPECTED_HOST = $OldHost }
  if ($null -eq $OldConfirm) { Remove-Item Env:BPMN_3B_CONFIRM -ErrorAction SilentlyContinue } else { $env:BPMN_3B_CONFIRM = $OldConfirm }
}
