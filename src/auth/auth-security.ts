/** Validation shared by authentication bootstrap and unit tests. */
export function requireJwtSecret(value: string | undefined): string {
  const secret = (value ?? '').trim()
  const prohibited = /^(dev-secret|secret|changeme|troque-esta-chave-em-producao)$/i
  if (secret.length < 32 || prohibited.test(secret) || /^(.)\1+$/.test(secret)) {
    throw new Error('JWT_SECRET deve ter ao menos 32 caracteres aleatorios. Configure o .env antes de iniciar a API.')
  }
  return secret
}

/** Strictly accepts a compact JWT in an Authorization: Bearer header. */
export function readBearerJwt(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization)
  return match?.[1] ?? null
}

/** No origin wildcard is allowed when credentials are enabled. */
export function resolveCorsOrigins(raw: string | undefined, production: boolean): string[] {
  if (!raw?.trim()) {
    if (production) throw new Error('CORS_ORIGIN obrigatoria em producao.')
    return ['http://localhost:5173']
  }
  const origins = raw.split(',').map((v) => v.trim()).filter(Boolean)
  if (origins.length === 0 || origins.includes('*')) {
    throw new Error('CORS_ORIGIN deve listar origens especificas; * nao e permitido.')
  }
  for (const origin of origins) {
    let parsed: URL
    try { parsed = new URL(origin) } catch { throw new Error(`CORS_ORIGIN invalida: ${origin}`) }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`CORS_ORIGIN deve conter apenas esquema, host e porta: ${origin}`)
    }
  }
  return [...new Set(origins)]
}
