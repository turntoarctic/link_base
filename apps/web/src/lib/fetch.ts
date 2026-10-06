/**
 * fetch 薄封装（06 §4）：统一 baseURL /api、注入 Bearer、401 时 refresh 换新并重放一次
 * （并发去重）；刷新失败清会话跳 /login。错误统一按 code 本地化（13 §4）。
 */
import { AuthError, type ApiErrorBody } from './api-error.ts'

const BASE = '/api'
const REFRESH_PATH = '/auth/refresh'
const LOGIN_PATH = '/auth/login'
const REGISTER_PATH = '/auth/register'

export function getAccessToken(): string | null {
  return localStorage.getItem('linkbase.accessToken')
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('linkbase.refreshToken')
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('linkbase.accessToken', accessToken)
  localStorage.setItem('linkbase.refreshToken', refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem('linkbase.accessToken')
  localStorage.removeItem('linkbase.refreshToken')
}

let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${BASE}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { accessToken: string; refreshToken: string }
    setTokens(body.accessToken, body.refreshToken)
    return true
  } catch {
    return false
  }
}

export function logoutToLogin(): void {
  clearTokens()
  if (!location.pathname.startsWith('/login')) {
    location.assign('/login')
  }
}

async function refreshOnce(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(`[${status}] ${code}`)
    this.name = 'HttpError'
  }
}

interface RequestOptions {
  method?: string
  json?: unknown
  raw?: BodyInit
  rawContentType?: string
  signal?: AbortSignal
  /** 401 不触发刷新（auth 端点本身） */
  skipRefresh?: boolean
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = getAccessToken()
  if (token) headers.authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(options.json)
  } else if (options.raw !== undefined) {
    if (options.rawContentType) headers['content-type'] = options.rawContentType
    body = options.raw
  }

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: options.signal,
  })

  if (res.status === 401 && !options.skipRefresh) {
    const ok = await refreshOnce()
    if (ok) return request(path, { ...options, skipRefresh: true })
    logoutToLogin()
    throw new HttpError(401, 'LB_UNAUTHORIZED')
  }
  return res
}

async function parseError(res: Response): Promise<never> {
  let code = 'LB_INTERNAL'
  let details: unknown
  try {
    const body = (await res.json()) as ApiErrorBody
    code = body.error?.code ?? code
    details = body.error?.details
  } catch {
    // 非 JSON 响应
  }
  throw new HttpError(res.status, code, details)
}

export const api = {
  async json<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await request(path, options)
    if (!res.ok) await parseError(res)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  },

  /** 文本响应（Markdown 导出等） */
  async text(path: string): Promise<string> {
    const res = await request(path)
    if (!res.ok) await parseError(res)
    return res.text()
  },

  /** 二进制响应；404 时返回 null（doc 空页语义，05 §3.1） */
  async bytes(path: string): Promise<Uint8Array | null> {
    const res = await request(path)
    if (res.status === 404) return null
    if (!res.ok) await parseError(res)
    return new Uint8Array(await res.arrayBuffer())
  },

  async pushBytes(path: string, bytes: Uint8Array): Promise<void> {
    const res = await request(path, {
      method: 'POST',
      raw: bytes as unknown as BodyInit,
      rawContentType: 'application/octet-stream',
    })
    if (!res.ok && res.status !== 204) await parseError(res)
  },

  /** multipart 上传（10 §5.3） */
  async upload<T>(path: string, file: File): Promise<T> {
    const form = new FormData()
    form.append('file', file)
    const res = await request(path, { method: 'POST', raw: form })
    if (!res.ok) await parseError(res)
    return (await res.json()) as T
  },

  /** 裸 fetch（登录/注册前的首次请求，带 skipRefresh） */
  async rawJson<T>(path: string, init: RequestInit & { skipRefresh?: boolean } = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    })
    if (res.status === 401 && !init.skipRefresh) {
      const ok = await refreshOnce()
      if (ok) return api.rawJson<T>(path, { ...init, skipRefresh: true })
      logoutToLogin()
      throw new AuthError()
    }
    if (!res.ok) await parseError(res)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  },

  paths: { REFRESH_PATH, LOGIN_PATH, REGISTER_PATH },
}
