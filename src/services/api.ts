import { inboundSeed, inventorySeed, outboundSeed, tenants, type InventoryItem, type MovementOrder, type Tenant } from '../data/seed'

export type LoginRequest = {
  email: string
  password: string
  locale: string
}

export type AuthSession = {
  schemaVersion: string
  source: 'iam-production' | 'iam-demo'
  token: string
  user: {
    name: string
    email: string
    role: string
    groups: string[]
    permissions: string[]
  }
  tenants: Tenant[]
  issuedAt: string
}

export type RuntimeContext = {
  tenantId: string
  warehouseId: string
  locale: string
}

export type ApiMode = 'production' | 'demo'

const env = import.meta.env as Record<string, string | undefined>

const readSetting = (key: string, fallback?: string) => {
  if (typeof window === 'undefined') return fallback
  return window.localStorage.getItem(key) || fallback
}

export const getRuntimeConfig = () => ({
  iamBaseUrl: readSetting('wms_iam_base_url', env.VITE_IAM_BASE_URL),
  wmsBaseUrl: readSetting('wms_api_base_url', env.VITE_WMS_API_BASE_URL),
})

export const getApiMode = (): ApiMode => {
  const config = getRuntimeConfig()
  return config.iamBaseUrl && config.wmsBaseUrl ? 'production' : 'demo'
}

export const IAM_SESSION_SCHEMA_VERSION = '2026-05-19.item-design-v2'

const wait = (ms = 240) => new Promise((resolve) => window.setTimeout(resolve, ms))

const jsonHeaders = (session?: AuthSession, context?: RuntimeContext) => ({
  'Content-Type': 'application/json',
  ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
  ...(context ? { 'X-Tenant-Id': context.tenantId, 'X-Warehouse-Id': context.warehouseId, 'X-Locale': context.locale } : {}),
})

async function productionRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  session?: AuthSession,
  context?: RuntimeContext,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      ...jsonHeaders(session, context),
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function loginWithIam(request: LoginRequest): Promise<AuthSession> {
  const { iamBaseUrl } = getRuntimeConfig()

  if (iamBaseUrl) {
    const session = await productionRequest<AuthSession>(iamBaseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return {
      ...session,
      schemaVersion: session.schemaVersion || IAM_SESSION_SCHEMA_VERSION,
      source: session.source || 'iam-production',
      user: {
        ...session.user,
        permissions: session.user.permissions || ['tenant:read', 'warehouse:read'],
      },
    }
  }

  await wait()

  return {
    schemaVersion: IAM_SESSION_SCHEMA_VERSION,
    source: 'iam-demo',
    token: `demo-token-${Date.now()}`,
    user: {
      name: request.email.split('@')[0] || 'WMS Operator',
      email: request.email || 'operator@item.com',
      role: 'IAM Tenant Warehouse Admin',
      groups: ['経営管理部', '入荷チーム', '出荷チーム', 'IAM管理者'],
      permissions: [
        'tenant:read',
        'warehouse:read',
        'inventory:*',
        'inbound:*',
        'outbound:*',
        'integration:sync',
      ],
    },
    tenants,
    issuedAt: new Date().toISOString(),
  }
}

export async function listInventory(session: AuthSession, context: RuntimeContext): Promise<InventoryItem[]> {
  const { wmsBaseUrl } = getRuntimeConfig()

  if (wmsBaseUrl) {
    return productionRequest<InventoryItem[]>(wmsBaseUrl, '/inventory', { method: 'GET' }, session, context)
  }

  await wait(120)
  return inventorySeed.filter((item) => item.warehouseId === context.warehouseId)
}

export async function listInbound(session: AuthSession, context: RuntimeContext): Promise<MovementOrder[]> {
  const { wmsBaseUrl } = getRuntimeConfig()

  if (wmsBaseUrl) {
    return productionRequest<MovementOrder[]>(wmsBaseUrl, '/inbound-orders', { method: 'GET' }, session, context)
  }

  await wait(120)
  return inboundSeed
}

export async function listOutbound(session: AuthSession, context: RuntimeContext): Promise<MovementOrder[]> {
  const { wmsBaseUrl } = getRuntimeConfig()

  if (wmsBaseUrl) {
    return productionRequest<MovementOrder[]>(wmsBaseUrl, '/outbound-orders', { method: 'GET' }, session, context)
  }

  await wait(120)
  return outboundSeed
}

export async function syncRecord<T>(path: string, payload: T, session: AuthSession, context: RuntimeContext) {
  const { wmsBaseUrl } = getRuntimeConfig()

  if (wmsBaseUrl) {
    return productionRequest<T>(
      wmsBaseUrl,
      path,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      session,
      context,
    )
  }

  await wait(180)
  return payload
}

export function exportCsv(filename: string, rows: Record<string, string | number | boolean | undefined>[]) {
  const headers = Object.keys(rows[0] || { empty: '' })
  const body = rows.map((row) =>
    headers
      .map((header) => {
        const value = row[header] ?? ''
        return `"${String(value).replace(/"/g, '""')}"`
      })
      .join(','),
  )
  const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
