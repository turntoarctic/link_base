/** WS 票据（09 §2）：Bearer JWT 换一次性短票，避免长寿命 token 进 URL 日志 */
import { Hono } from 'hono'
import { randomToken } from '../lib/ids.ts'
import type { ServerDeps } from '../lib/deps.ts'
import type { AppEnv } from '../lib/context.ts'
import { requireAuth } from '../middleware/auth.ts'

export function wsRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .use('*', requireAuth)
    .post('/ticket', async (c) => {
      const userId = c.get('user').id
      const ticket = randomToken()
      await deps.sessions.putWsTicket(ticket, userId)
      return c.json({ ticket, expiresIn: 30 }, 201)
    })
}
