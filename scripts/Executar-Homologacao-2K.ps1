#requires -Version 5.1
param([string]$Back = 'C:\Users\ResTIC55\Desktop\NewFlow - Atual 20_11\NewFlowBack')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $Back -PathType Container)) { throw "Repositorio nao encontrado: $Back" }
Set-Location -LiteralPath $Back
if ((git branch --show-current) -ne 'feature/bpmn-core-consolidado') {
  throw 'Executar apenas na branch feature/bpmn-core-consolidado.'
}
$F = 'tests/integration/bpmn-2k.integration.ts'
if (-not (Test-Path -LiteralPath $F)) { throw 'Teste de integracao nao encontrado.' }
Write-Host 'Este teste GRAVA e REMOVE apenas registros de uma conta temporaria BPMN2K_* no Neon.' -ForegroundColor Yellow
Write-Host 'Nao execute em banco de producao. Confirme o host exato visto no Prisma migrate status.' -ForegroundColor Yellow
$HostConfirmado = Read-Host 'Digite o hostname COMPLETO do seu Neon (sem URL, sem senha)'
if (-not $HostConfirmado -or $HostConfirmado -notmatch '(^|\.)neon\.tech$') {
  throw 'Hostname Neon invalido.'
}
$Confirma = Read-Host 'Para permitir GRAVACAO e LIMPEZA dos dados de homologacao digite HOMOLOGAR'
if ($Confirma -cne 'HOMOLOGAR') { throw 'Operacao cancelada.' }
$env:BPMN_2K_EXPECTED_HOST = $HostConfirmado
$env:BPMN_2K_CONFIRM = 'HOMOLOGAR'
try {
  npx.cmd tsx 'tests/integration/bpmn-2k.integration.ts'
  if ($LASTEXITCODE -ne 0) { throw "Homologacao falhou. Consulte a saida acima antes do commit." }
  Write-Host 'HOMOLOGACAO REAL BPMN 2K APROVADA NO NEON!' -ForegroundColor Green
} finally {
  Remove-Item Env:BPMN_2K_EXPECTED_HOST -ErrorAction SilentlyContinue
  Remove-Item Env:BPMN_2K_CONFIRM -ErrorAction SilentlyContinue
}
