/** JWT 鉴权（07 §5）：验证 → c.set('user')；token 15min，exp 由签发时写入 */
import { sign, verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../lib/context.ts'
import { errUnauthorized } from '../lib/errors.ts'
import { env } from '../env.ts'

export const ACCESS_TOKEN_TTL_SEC = 15 * 60

export function signAccessToken(userId: string, wid?: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign(
    { sub: userId, ...(wid ? { wid } : {}), iat: now, exp: now + ACCESS_TOKEN_TTL_SEC },
    env.JWT_SECRET,
  )
}

interface AccessPayload {
  sub: string
  wid?: string
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw errUnauthorized()
  let payload: AccessPayload
  try {
    // hono 4.13 的 verify 必须显式传 alg（缺失抛 JwtAlgorithmRequired，与 token 无关）
    payload = (await verify(token, env.JWT_SECRET, 'HS256')) as unknown as AccessPayload
  } catch {
    throw errUnauthorized('token expired or invalid')
  }
  if (!payload.sub) throw errUnauthorized()
  c.set('user', { id: payload.sub, wid: payload.wid })
  await next()
})
