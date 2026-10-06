/**
 * Markdown 导入导出集成测试（05 §7 / T2.5，DB 门控）：
 * 结构化内容导出（标题/粗体/列表/任务/代码/表格）→ 导入建页 → 往返导出一致。
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { createDb } from '@linkbase/database'
import { createApp } from '../../src/app.ts'
import { closeTrackedDbs, trackDb } from '../helpers/test-db.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!HAS_DB)('Markdown 导入导出（T2.5）', () => {
  let app: ReturnType<typeof createApp>
  let h: Record<string, string>
  let jsonH: Record<string, string>
  let ws = ''
  let pageId = ''

  afterAll(async () => {
    await closeTrackedDbs()
  })

  beforeAll(async () => {
    const kv = createKV('')
    const db = trackDb(createDb(process.env.DATABASE_URL!))
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `md-${unique()}@test.dev`, password: 'password123', name: 'MD' }),
    })
    const auth = (await reg.json()) as { accessToken: string; workspace: { id: string } }
    h = { authorization: `Bearer ${auth.accessToken}` }
    jsonH = { ...h, 'content-type': 'application/json' }
    ws = auth.workspace.id
    const page = await app.request(`/api/workspaces/${ws}/pages`, { method: 'POST', headers: jsonH, body: '{}' })
    pageId = ((await page.json()) as { id: string }).id
  })

  test('结构化导出：标题/粗体/列表/任务/代码/表格', async () => {
    // 走导入链造内容（与导出同构），验证导出器
    const md = [
      '# 项目说明',
      '',
      '这是 **加粗** 与 *斜体* 与 `行内代码` 混排。',
      '',
      '- 第一项',
      '- 第二项',
      '',
      '列表之后的段落。',
      '',
      '- [x] 已完成事项',
      '- [ ] 待办事项',
      '',
      '> 引用一行',
      '',
      '```ts',
      'const answer = 42',
      '```',
      '',
      '| 列甲 | 列乙 |',
      '| --- | --- |',
      '| 甲一 | 乙一 |',
    ].join('\n')
    const imp = await app.request(`/api/workspaces/${ws}/pages/import`, {
      method: 'POST',
      headers: jsonH,
      body: JSON.stringify({ markdown: md }),
    })
    expect(imp.status).toBe(201)
    const { id } = (await imp.json()) as { id: string }

    // 导入时标题取首行 heading
    const meta = await app.request(`/api/workspaces/${ws}/pages/${id}`, { headers: h })
    expect(((await meta.json()) as { title: string }).title).toBe('项目说明')

    const exported = await app.request(`/api/workspaces/${ws}/pages/${id}/export`, { headers: h })
    expect(exported.status).toBe(200)
    expect(exported.headers.get('content-type')).toContain('text/markdown')
    const out = await exported.text()
    expect(out).toContain('# 项目说明')
    expect(out).toContain('**加粗**')
    expect(out).toContain('*斜体*')
    expect(out).toContain('`行内代码`')
    expect(out).toContain('- 第一项')
    expect(out).toContain('- [x] 已完成事项')
    expect(out).toContain('- [ ] 待办事项')
    expect(out).toContain('> 引用一行')
    expect(out).toContain('```ts')
    expect(out).toContain('| 列甲 | 列乙 |')
  })

  test('导出往返一致：导入内容 → 导出 → 再导入 → 再导出相同', async () => {
    const md0 = '# 往返标题\n\n第一段 **强调** 文本。\n\n- 甲\n- 乙\n'
    const first = await app.request(`/api/workspaces/${ws}/pages/import`, {
      method: 'POST',
      headers: jsonH,
      body: JSON.stringify({ markdown: md0 }),
    })
    expect(first.status).toBe(201)
    const { id } = (await first.json()) as { id: string }

    const exp1 = await app.request(`/api/workspaces/${ws}/pages/${id}/export`, { headers: h })
    const md1 = await exp1.text()
    expect(md1).toContain('往返标题')

    const second = await app.request(`/api/workspaces/${ws}/pages/import`, {
      method: 'POST',
      headers: jsonH,
      body: JSON.stringify({ markdown: md1 }),
    })
    expect(second.status).toBe(201)
    const { id: id2 } = (await second.json()) as { id: string }
    const exp2 = await app.request(`/api/workspaces/${ws}/pages/${id2}/export`, { headers: h })
    expect(await exp2.text()).toBe(md1)
  })

  test('导入校验：空 markdown 400', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/import`, {
      method: 'POST',
      headers: jsonH,
      body: JSON.stringify({ markdown: '' }),
    })
    expect(res.status).toBe(400)
  })
})
