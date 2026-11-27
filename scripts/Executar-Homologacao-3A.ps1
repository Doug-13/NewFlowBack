#requires -Version 5.1
param([string]$Back = 'C:\Users\ResTIC55\Desktop\NewFlow - Atual 20_11\NewFlowBack')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $Back -PathType Container)) { throw 'Repositorio nao encontrado.' }
Set-Location -LiteralPath $Back
if ((git branch --show-current).Trim() -ne 'feature/automacoes-3a') { throw 'Branch incorreta.' }
if (-not (Test-Path -LiteralPath 'tests/integration/automations-3a.integration.ts')) { throw 'Teste nao instalado.' }
$Url = $env:DATABASE_URL
if (-not $Url -and (Test-Path -LiteralPath '.env')) {
  $Line = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($Line) { $Url = ($Line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
}
if (-not $Url) { throw 'DATABASE_URL nao identificada.' }
try { $DbUri = [Uri]$Url; $DbHost = $DbUri.Host } catch { throw 'DATABASE_URL invalida.' }
if (-not $DbHost.EndsWith('.neon.tech')) { throw 'A homologacao exige Neon.' }
Write-Host "Conexao configurada: $DbHost" -ForegroundColor Yellow
Write-Host 'PARE antes qualquer backend/worker conectado ao Neon durante esta homologacao.' -ForegroundColor Yellow
Write-Host 'O teste CRIA e REMOVE apenas uma conta BPMN3A_* aleatoria no banco neondb.' -ForegroundColor Yellow
Write-Host 'Nao utilize ambiente de producao.' -ForegroundColor Yellow
$Hostname = Read-Host 'Digite o hostname COMPLETO mostrado acima'
if ($Hostname -cne $DbHost) { throw 'Hostname nao corresponde ao Neon configurado. Cancelado.' }
$Confirm = Read-Host 'Digite HOMOLOGAR para criar, testar e remover SOMENTE os registros da conta temporaria'
if ($Confirm -cne 'HOMOLOGAR') { throw 'Operacao cancelada.' }
$OldHost = [Environment]::GetEnvironmentVariable('BPMN_3A_EXPECTED_HOST', 'Process')
$OldConfirm = [Environment]::GetEnvironmentVariable('BPMN_3A_CONFIRM', 'Process')
try {
 $env:BPMN_3A_EXPECTED_HOST = $Hostname
 $env:BPMN_3A_CONFIRM = 'HOMOLOGAR'
 npx.cmd tsx 'tests/integration/automations-3a.integration.ts'
 if ($LASTEXITCODE -ne 0) { throw 'Homologacao integrada falhou; nao faca commit nem habilite o worker.' }
 Write-Host 'HOMOLOGACAO REAL 3A APROVADA!' -ForegroundColor Green
} finally {
 if ($null -eq $OldHost) { Remove-Item Env:BPMN_3A_EXPECTED_HOST -ErrorAction SilentlyContinue } else { $env:BPMN_3A_EXPECTED_HOST = $OldHost }
 if ($null -eq $OldConfirm) { Remove-Item Env:BPMN_3A_CONFIRM -ErrorAction SilentlyContinue } else { $env:BPMN_3A_CONFIRM = $OldConfirm }
}
