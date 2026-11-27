param(
    [string]$Back = 'C:\Users\ResTIC55\Desktop\NewFlow - Atual 20_11\NewFlowBack'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $Back)) { throw "Backend nao encontrado: $Back" }
Set-Location -LiteralPath $Back
$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'feature/integracoes-http-3d') {
    throw "Execute na branch feature/integracoes-http-3d. Atual: $branch"
}
if (-not (Test-Path 'src/workflow-automation/workflow-http-client.ts')) {
    throw 'Cliente HTTPS do NewFlow nao encontrado.'
}
if (-not (Test-Path 'tests/integration/automations-3d-https-real.integration.ts')) {
    throw 'Teste HTTPS real nao encontrado. Instale o pacote.'
}
if ($env:NEWFLOW_AUTOMATION_WORKER_ENABLED -eq 'true') {
    throw 'Desative NEWFLOW_AUTOMATION_WORKER_ENABLED antes dos testes.'
}
Write-Host 'HOMOLOGACAO 3D - HTTPS REAL (SEM NEON)' -ForegroundColor Cyan
Write-Host 'Destino externo: https://postman-echo.com (servico publico da Postman)'
Write-Host 'Serao enviados apenas dados ficticios, identificadores aleatorios e cabecalho de idempotencia.'
Write-Host 'GET, POST e PATCH reais, alem de GET 404 e GET 302.'
Write-Host 'Nao usa credenciais, documentos reais, banco de dados ou worker.'
Write-Host 'Verifique se e permitido enviar estes dados ficticios a um servico publico.'
$hostTyped = Read-Host 'Digite exatamente postman-echo.com para autorizar este destino'
if ($hostTyped -cne 'postman-echo.com') { throw 'Destino nao confirmado.' }
$confirm = Read-Host 'Digite TESTARHTTPS para executar requisicoes EXTERNAS reais'
if ($confirm -cne 'TESTARHTTPS') { throw 'Homologacao cancelada.' }

$previousConsent = [Environment]::GetEnvironmentVariable('NEWFLOW_3D_LIVE_TEST_CONSENT', 'Process')
$previousHttp = [Environment]::GetEnvironmentVariable('NEWFLOW_HTTP_ENABLED', 'Process')
$previousHosts = [Environment]::GetEnvironmentVariable('NEWFLOW_HTTP_ALLOWED_HOSTS', 'Process')
try {
    $env:NEWFLOW_3D_LIVE_TEST_CONSENT = 'TESTARHTTPS'
    $env:NEWFLOW_HTTP_ENABLED = 'false'
    $env:NEWFLOW_HTTP_ALLOWED_HOSTS = 'postman-echo.com'
    & npx --no-install tsx --test 'tests/integration/automations-3d-https-real.integration.ts'
    $exitCode = $LASTEXITCODE
} finally {
    [Environment]::SetEnvironmentVariable('NEWFLOW_3D_LIVE_TEST_CONSENT', $previousConsent, 'Process')
    [Environment]::SetEnvironmentVariable('NEWFLOW_HTTP_ENABLED', $previousHttp, 'Process')
    [Environment]::SetEnvironmentVariable('NEWFLOW_HTTP_ALLOWED_HOSTS', $previousHosts, 'Process')
}
if ($exitCode -ne 0) { throw "Homologacao HTTPS real falhou (exit code $exitCode). Nao faca commit ainda." }
Write-Host 'HOMOLOGACAO HTTPS REAL 3D APROVADA (CLIENTE HTTPS). SEM ALTERACOES NO NEON.' -ForegroundColor Green
