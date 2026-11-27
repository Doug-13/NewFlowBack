import { Injectable } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { isPublicIPv4, validateHttpDestination, type HttpConfig } from './workflow-http-policy'

/**
 * Node may call a custom DNS lookup with `all: true` (autoSelectFamily).
 * In that mode the callback MUST receive an array of address/family records.
 * The IP passed here was already checked against the SSRF protection policy.
 */
export function createPinnedLookup(ip: string) {
  return (_hostname: string, options: { all?: boolean }, callback: (...args: any[]) => void) => {
    if (options.all) {
      callback(null, [{ address: ip, family: 4 }])
    } else {
      callback(null, ip, 4)
    }
  }
}

@Injectable()
export class WorkflowHttpClient {
  async send(config: HttpConfig, idempotencyKey: string, documentId: string): Promise<number> {
    if (process.env.NEWFLOW_HTTP_ENABLED !== 'true') throw new Error('Integracoes HTTP desativadas.')
    const url = validateHttpDestination(config.url, process.env.NEWFLOW_HTTP_ALLOWED_HOSTS ?? '')
    // Resolve immediately before connecting; pin the validated address in the socket lookup.
    const addresses = await lookup(url.hostname, { all: true, family: 4, verbatim: true })
    if (!addresses.length || addresses.some(a => !isPublicIPv4(a.address))) throw new Error('DNS retornou endereco inseguro ou inexistente.')
    const ip = addresses[0].address
    const secret = config.secretEnv ? process.env[config.secretEnv] : undefined
    if (config.secretEnv && !secret) throw new Error('Credencial de integracao nao configurada.')
    const payload = config.method === 'GET' ? undefined : JSON.stringify({ ...(config.body ?? {}), documentId })
    if (payload && Buffer.byteLength(payload, 'utf8') > 10000) throw new Error('Payload excede limite.')
    return new Promise<number>((resolve, reject) => {
      const req = httpsRequest(url, {
        method: config.method, timeout: 10000, agent: false,
        lookup: createPinnedLookup(ip),
        headers: { 'accept': 'application/json', 'content-type': 'application/json',
          'x-idempotency-key': idempotencyKey,
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
          ...(payload ? { 'content-length': Buffer.byteLength(payload, 'utf8') } : {}),
        },
      }, res => {
        let size = 0
        res.on('data', chunk => { size += Buffer.byteLength(chunk); if (size > 65536) req.destroy(new Error('Resposta muito grande.')) })
        res.on('end', () => {
          const code = res.statusCode ?? 0
          if (code >= 200 && code < 300) resolve(code)
          else reject(new Error(`API externa retornou HTTP ${code}.`))
        })
        res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new Error('Timeout HTTPS (10s).')))
      req.on('error', reject)
      if (payload) req.write(payload)
      req.end()
    })
  }
}
