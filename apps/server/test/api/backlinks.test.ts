/**
 * 反向链接集成测试（Phase 3，DB 门控）：
 * 推送含站内链接的文档 → 合并 → 反链命中；移除链接再合并 → 反链消失；跨空间链接被过滤。
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { createDb } from '@linkbase/database'
import { markdownToYDoc } from '@linkbase/ydoc'
import { createApp } from '../../src/app.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'
import { mergePage } from '../../src/services/docs.service.ts'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!HAS_DB)('反向链接（Phase 3）', () => {
  let app: ReturnType<typeof createApp>
  let db: ReturnType<typeof createDb>
  let ownerH: Record<string, string>
  let ws = ''
  let pageB = ''
  let pageA = ''

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL!)
    const kv = createKV('')
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })

    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `bl-${unique()}@test.dev`, password: 'password123', name: 'BL' }),
    })
    const auth = (await reg.json()) as { accessToken: string; workspace: { id: string } }
    ownerH = { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' }
    ws = auth.workspace.id

    const mk = async (): Promise<string> => {
      const res = await app.request(`/api/workspaces/${ws}/pages`, { method: 'POST', headers: ownerH, body: '{}' })
      return ((await res.json()) as { id: string }).id
    }
    pageB = await mk()
    pageA = await mk()
  })

  const backlinksOf = async (pageId: string): Promise<Array<{ id: string; title: string }>> => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/backlinks`, { headers: ownerH })
    expect(res.status).toBe(200)
    return (await res.json()) as Array<{ id: string; title: string }>
  }

  /** 拉取-替换全部内容-推送（模拟客户端整页重写；CRDT 合并语义下删除需显式删块） */
  const pushMarkdown = async (pageId: string, markdown: string, actor: 'owner' | 'other'): Promise<void> => {
    const ydoc = new Y.Doc()
    const pulled = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      headers: ownerH,
    })
    if (pulled.status === 200) Y.applyUpdate(ydoc, new Uint8Array(await pulled.arrayBuffer()))
    const frag = ydoc.getXmlFragment('default')
    if (frag.length > 0) frag.delete(0, frag.length)
    // 新内容以 update 形式合入（已挂载类型不能跨 doc 直接 insert）
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(markdownToYDoc(markdown)))
    await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      method: 'POST',
      headers: { ...ownerH, 'content-type': 'application/octet-stream' },
      body: Y.encodeStateAsUpdate(ydoc),
    })
    // actor 'other' 模拟其他成员触发合并（反链在 derive 同步）
    if (actor === 'owner') await mergePage(db, pageId, 'auto', '00000000-0000-0000-0000-000000000000')
  }

  test('链接 → 反链命中；移除 → 反链消失', async () => {
    await pushMarkdown(pageA, `参见 [目标页](/page/${pageB}) 的说明`, 'owner')
    let links = await backlinksOf(pageB)
    expect(links.some((l) => l.id === pageA)).toBe(true)

    // 移除链接（同页替换为无链接内容）
    await pushMarkdown(pageA, '参见其他页面的说明', 'owner')
    links = await backlinksOf(pageB)
    expect(links.some((l) => l.id === pageA)).toBe(false)
  })

  test('跨空间/不存在目标的链接被过滤', async () => {
    const fakeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    await pushMarkdown(pageA, `[幽灵](/page/${fakeId})`, 'owner')
    const links = await backlinksOf(fakeId)
    expect(links.length).toBe(0)

    // A 的反链不应因幽灵链接出现
    expect((await backlinksOf(pageB)).some((l) => l.id === pageA && l.title.includes('幽灵'))).toBe(false)
  })
})
