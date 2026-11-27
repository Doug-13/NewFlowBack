import { isIP } from 'node:net'

export type HttpConfig = { url: string; method: 'GET' | 'POST' | 'PATCH'; secretEnv?: string; body?: Record<string, unknown> }
export function parseHttpAutomation(element: { element_kind?: string | null; config?: unknown } | null): HttpConfig | null {
  if (!element || !/^serviceTask$/i.test(element.element_kind ?? '')) return null
  const a = (element.config as any)?.automation
  if (a?.enabled !== true || a?.type !== 'http') return null
  const h = a.http
  if (!h || typeof h !== 'object' || Array.isArray(h)) return null
  if (typeof h.url !== 'string' || h.url.length > 2048 || !['GET','POST','PATCH'].includes(h.method)) return null
  if (h.secretEnv !== undefined && (typeof h.secretEnv !== 'string' || !/^NEWFLOW_HTTP_SECRET_[A-Z0-9_]{1,80}$/.test(h.secretEnv))) return null
  if (h.body !== undefined && (h.method === 'GET' || !h.body || typeof h.body !== 'object' || Array.isArray(h.body) || JSON.stringify(h.body).length > 8192)) return null
  try { validateHttpDestination(h.url, process.env.NEWFLOW_HTTP_ALLOWED_HOSTS ?? '') } catch { return null }
  return { url: h.url, method: h.method, ...(h.secretEnv ? { secretEnv: h.secretEnv } : {}), ...(h.body ? { body: h.body } : {}) }
}

export function validateHttpDestination(raw: string, allowlist: string): URL {
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('URL de integracao invalida.') }
  if (url.protocol !== 'https:' || url.port && url.port !== '443') throw new Error('Apenas HTTPS na porta 443.')
  if (url.username || url.password || url.hash) throw new Error('URL com credenciais ou fragmento proibida.')
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!/^[a-z0-9][a-z0-9.-]{0,252}[a-z0-9]$/.test(hostname) || !hostname.includes('.') || isIP(hostname)) throw new Error('Hostname DNS invalido.')
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) throw new Error('Rede interna proibida.')
  const hosts = allowlist.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (!hosts.includes(hostname)) throw new Error('Destino nao autorizado em NEWFLOW_HTTP_ALLOWED_HOSTS.')
  return url
}

/** Conservative IPv4-only egress policy, including reserved, multicast and documentation ranges. */
export function isPublicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false
  const [a,b,c] = ip.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 168 || b === 0 || b === 88 && c === 99)) return false
  if (a === 198 && ((b === 18 || b === 19) || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  return !(a === 192 && b === 0 && c === 2)
}
