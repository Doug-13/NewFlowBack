#requires -Version 5.1
param([string]$Back='C:\Users\ResTIC55\Desktop\NewFlow - Atual 20_11\NewFlowBack')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $Back -PathType Container)) { throw 'Repositorio nao encontrado.' }
Set-Location -LiteralPath $Back
if ((git branch --show-current).Trim() -ne 'feature/integracoes-http-3d') { throw 'Branch incorreta.' }
if ($env:NEWFLOW_AUTOMATION_WORKER_ENABLED -eq 'true') { throw 'Desligue o worker antes da homologacao.' }
$Url=$env:DATABASE_URL
if (-not $Url -and (Test-Path '.env')) {
  $Line=Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($Line) { $Url=($Line -replace '^\s*DATABASE_URL\s*=\s*','').Trim().Trim('"').Trim("'") }
}
if (-not $Url) { throw 'DATABASE_URL nao identificada.' }
try { $Uri=[Uri]$Url; $DbHost=$Uri.Host } catch { throw 'DATABASE_URL invalida.' }
if (-not $DbHost.EndsWith('.neon.tech')) { throw 'Somente Neon de testes.' }
if ($Uri.AbsolutePath -ne '/neondb') { throw 'Banco inesperado; esperado neondb.' }
Write-Host "Destino: $DbHost/neondb" -ForegroundColor Yellow
Write-Host 'Testes REAIS no Neon, cliente HTTP SIMULADO; nenhuma chamada para a Internet.' -ForegroundColor Yellow
Write-Host 'PARE backend/worker; confira que o Neon usado e EXCLUSIVAMENTE de TESTES.' -ForegroundColor Yellow
$Hostname=Read-Host 'Digite hostname COMPLETO acima'
if ($Hostname -cne $DbHost) { throw 'Hostname nao corresponde.' }
$Confirm=Read-Host 'Digite HOMOLOGAR3D para criar e remover conta temporaria BPMN3D_*'
if ($Confirm -cne 'HOMOLOGAR3D') { throw 'Cancelado.' }
$OldHost=[Environment]::GetEnvironmentVariable('BPMN_3D_EXPECTED_HOST','Process')
$OldConfirm=[Environment]::GetEnvironmentVariable('BPMN_3D_CONFIRM','Process')
try {
  $env:BPMN_3D_EXPECTED_HOST=$Hostname
  $env:BPMN_3D_CONFIRM='HOMOLOGAR3D'
  npx.cmd tsx 'tests/integration/automations-3d.integration.ts'
  if ($LASTEXITCODE -ne 0) { throw 'Homologacao 3D falhou; nao faca commit nem habilite worker.' }
  Write-Host 'HOMOLOGACAO NEON + TRANSPORTE SIMULADO 3D APROVADA!' -ForegroundColor Green
} finally {
  if ($null -eq $OldHost) { Remove-Item Env:BPMN_3D_EXPECTED_HOST -ErrorAction SilentlyContinue } else { $env:BPMN_3D_EXPECTED_HOST=$OldHost }
  if ($null -eq $OldConfirm) { Remove-Item Env:BPMN_3D_CONFIRM -ErrorAction SilentlyContinue } else { $env:BPMN_3D_CONFIRM=$OldConfirm }
}
