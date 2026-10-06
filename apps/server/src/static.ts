/**
 * 静态托管（11 §1）：app 同进程托管 apps/web/dist + SPA fallback。
 * 不用 hono/bun serveStatic（root 相对 cwd 的坑），直接 Bun.file + 安全 join。
 */
import { join, normalize, resolve, sep } from 'node:path'
import type { Context, Hono } from 'hono'
import type { AppEnv } from './lib/context.ts'
import { logger } from './lib/logger.ts'

export function mountStatic(app: Hono<AppEnv>, distDir: string): void {
  const distAbs = resolve(distDir)

  const safeFile = async (ctx: Context, urlPath: string): Promise<Response | null> => {
    const decoded = decodeURIComponent(urlPath)
    const target = normalize(join(distAbs, decoded))
    if (!target.startsWith(distAbs + sep) && target !== distAbs) return null
    try {
      const file = Bun.file(target)
      if (await file.exists()) {
        return ctx.newResponse(file)
      }
    } catch (error) {
      logger.warn({ error, target }, 'static read failed')
    }
    return null
  }

  app.get('*', async (ctx) => {
    const path = new URL(ctx.req.url).pathname
    if (path.startsWith('/api/')) {
      return ctx.json({ error: { code: 'LB_NOT_FOUND', message: 'not found' } }, 404)
    }
    const asset = await safeFile(ctx, path)
    if (asset) return asset
    const index = await safeFile(ctx, '/index.html')
    if (index) return index
    return ctx.text('Not Found', 404)
  })
}
