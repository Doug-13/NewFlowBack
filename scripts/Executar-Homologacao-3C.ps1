#requires -Version 5.1
param([string]$Back = 'C:\Users\ResTIC55\Desktop\NewFlow - Atual 20_11\NewFlowBack')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $Back -PathType Container)) { throw 'Repositorio nao encontrado.' }
Set-Location -LiteralPath $Back
if ((git branch --show-current).Trim() -ne 'feature/eventos-3c') { throw 'Branch incorreta.' }
if (-not (Test-Path -LiteralPath 'tests/integration/automations-3c.integration.ts')) { throw 'Teste 3C ausente.' }
if ($env:NEWFLOW_AUTOMATION_WORKER_ENABLED -eq 'true') { throw 'Desligue o worker antes da homologacao.' }
$Url = $env:DATABASE_URL
if (-not $Url -and (Test-Path -LiteralPath '.env')) {
  $Line = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($Line) { $Url = ($Line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
}
if (-not $Url) { throw 'DATABASE_URL nao identificada.' }
try { $Uri = [Uri]$Url; $DbHost = $Uri.Host } catch { throw 'DATABASE_URL invalida.' }
if (-not $DbHost.EndsWith('.neon.tech')) { throw 'Use somente Neon de testes.' }
if ($Uri.AbsolutePath -ne '/neondb') { throw 'Nome de banco inesperado.' }
Write-Host "Conexao: $DbHost/neondb" -ForegroundColor Yellow
Write-Host 'Pare o backend e mantenha o worker desativado. Teste cria e remove apenas a conta BPMN3C_*.' -ForegroundColor Yellow
Write-Host 'Confirme que este Neon e EXCLUSIVAMENTE de testes; este script cria e apaga fixtures.' -ForegroundColor Yellow
$Hostname = Read-Host 'Digite o hostname COMPLETO mostrado acima'
if ($Hostname -cne $DbHost) { throw 'Hostname nao corresponde.' }
$Confirm = Read-Host 'Digite HOMOLOGAR3C para executar os testes reais no banco de TESTES'
if ($Confirm -cne 'HOMOLOGAR3C') { throw 'Operacao cancelada.' }
$OldHost = [Environment]::GetEnvironmentVariable('BPMN_3C_EXPECTED_HOST', 'Process')
$OldConfirm = [Environment]::GetEnvironmentVariable('BPMN_3C_CONFIRM', 'Process')
try {
  $env:BPMN_3C_EXPECTED_HOST = $Hostname
  $env:BPMN_3C_CONFIRM = 'HOMOLOGAR3C'
  npx.cmd tsx 'tests/integration/automations-3c.integration.ts'
  if ($LASTEXITCODE -ne 0) { throw 'Homologacao 3C falhou. Nao faca commit nem habilite worker.' }
  Write-Host 'HOMOLOGACAO REAL 3C APROVADA!' -ForegroundColor Green
} finally {
  if ($null -eq $OldHost) { Remove-Item Env:BPMN_3C_EXPECTED_HOST -ErrorAction SilentlyContinue } else { $env:BPMN_3C_EXPECTED_HOST = $OldHost }
  if ($null -eq $OldConfirm) { Remove-Item Env:BPMN_3C_CONFIRM -ErrorAction SilentlyContinue } else { $env:BPMN_3C_CONFIRM = $OldConfirm }
}
