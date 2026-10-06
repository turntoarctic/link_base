/** 通知端点（P1-9 / T2.9）：列表 / 已读 / 全部已读；未读数由列表计算（客户端轮询） */
import { Hono } from 'hono'
import type { AppEnv } from '../lib/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { listMine, markAllRead, markRead } from '../services/notifications.service.ts'

export function notificationsRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .use('*', requireAuth)
    .get('/', async (c) => {
      const items = await listMine(deps.db, c.get('user').id)
      return c.json(items, 200)
    })
    .post('/:notificationId/read', async (c) => {
      await markRead(deps.db, c.get('user').id, c.req.param('notificationId'))
      return c.body(null, 204)
    })
    .post('/read-all', async (c) => {
      await markAllRead(deps.db, c.get('user').id)
      return c.body(null, 204)
    })
}
