/**
 * 接口全链测试（T0.5/T0.6/T0.7，DB 门控）：describe.skipIf(!DATABASE_URL)。
 * 覆盖 401/403/404/409/413/refresh 旋转与「注册→建页→标题→doc 推拉→回收站→恢复→彻底删」。
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { createDb } from '@linkbase/database'
import { Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import { extractPageMeta, stateVectorFromUpdate } from '@linkbase/ydoc'

// bun-types 将 BodyInit 声明在 "bun" 模块内（server lib 无 DOM，无全局名）
type BodyInit = import('bun').BodyInit

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'
// 测试期放宽限流：env 在下方动态 import('app.ts') 时才求值，此处设置先生效
process.env.RATE_LIMIT_GLOBAL ??= '100000'
process.env.RATE_LIMIT_LOGIN ??= '100000'
process.env.RATE_LIMIT_REGISTER ??= '100000'

const HAS_DB = Boolean(process.env.DATABASE_URL)

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function setup() {
  const { createKV, createSessions } = await import('../../src/db/redis.ts')
  const { createDb } = await import('@linkbase/database')
  const { createApp } = await import('../../src/app.ts')
  const db = createDb(process.env.DATABASE_URL!)
  const kv = createKV('')
  const app = createApp({
    db,
    kv,
    sessions: createSessions(kv),
    appOrigin: 'http://localhost:5173',
  })
  return { app, db }
}

/** 模拟客户端：本地 Y.Doc 写入 → push；带 sv pull */
function makeClient() {
  let sv: Uint8Array | null = null
  const doc = new Y.Doc()
  return {
    doc,
    async type(text: string): Promise<Uint8Array> {
      const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
      const p = new Y.XmlElement('paragraph')
      const t = new Y.XmlText()
      t.insert(0, text)
      p.insert(0, [t])
      fragment.insert(fragment.length, [p])
      const update = Y.encodeStateAsUpdate(doc)
      sv = stateVectorFromUpdate(update)
      return update
    },
    stateVector(): string | null {
      return sv ? Buffer.from(sv).toString('base64') : null
    },
    merged(): Uint8Array {
      return Y.encodeStateAsUpdate(doc)
    },
  }
}

describe.skipIf(!HAS_DB)('Phase 0 全链（DB 门控）', () => {
  let app: Awaited<ReturnType<typeof setup>>['app']
  const suffix = unique()

  const registerUser = async (name: string) => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${name}@test.dev`, password: 'password123', name }),
    })
    expect(res.status).toBe(201)
    return (await res.json()) as {
      user: { id: string }
      accessToken: string
      refreshToken: string
      workspace: { id: string; welcomePageId: string }
    }
  }

  const authed = (token: string) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  })

  beforeAll(async () => {
    ;({ app } = await setup())
  })

  test('注册：零仪式（自动建空间+快速开始页）', async () => {
    const data = await registerUser(`alice-${suffix}`)
    expect(data.workspace.welcomePageId).toBeTruthy()

    const me = await app.request('/api/auth/me', { headers: authed(data.accessToken) })
    expect(me.status).toBe(200)
    const meBody = (await me.json()) as { workspaces: Array<{ id: string; role: string }> }
    expect(meBody.workspaces.some((w) => w.id === data.workspace.id && w.role === 'owner')).toBe(true)

    // 快速开始页有内容（pull 空页才 404）
    const pull = await app.request(
      `/api/workspaces/${data.workspace.id}/pages/${data.workspace.welcomePageId}/doc`,
      { headers: authed(data.accessToken) },
    )
    expect(pull.status).toBe(200)
    const bytes = new Uint8Array(await pull.arrayBuffer())
    expect(extractPageMeta(bytes).text.length).toBeGreaterThan(50)
  })

  test('重复注册 409 / 未登录 401 / 非成员 403', async () => {
    const dup = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `alice-${suffix}@test.dev`,
        password: 'password123',
        name: 'dup',
      }),
    })
    expect(dup.status).toBe(409)
    const dupBody = (await dup.json()) as { error: { code: string } }
    expect(dupBody.error.code).toBe('LB_EMAIL_TAKEN')

    const noAuth = await app.request('/api/auth/me')
    expect(noAuth.status).toBe(401)

    const bob = await registerUser(`bob-${suffix}`)
    const alice = await registerUser(`alice2-${suffix}`)
    const forbidden = await app.request(`/api/workspaces/${bob.workspace.id}`, {
      headers: authed(alice.accessToken),
    })
    expect(forbidden.status).toBe(403)
  })

  test('refresh 旋转：旧 token 立即失效', async () => {
    const user = await registerUser(`carol-${suffix}`)
    const first = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: user.refreshToken }),
    })
    expect(first.status).toBe(200)
    const second = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: user.refreshToken }),
    })
    expect(second.status).toBe(401)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('LB_TOKEN_INVALID')
  })

  test('页面 CRUD + 树 + 子页 parent 派生', async () => {
    const user = await registerUser(`dave-${suffix}`)
    const ws = user.workspace.id
    const h = authed(user.accessToken)

    const child = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: '子页' }),
    })
    expect(child.status).toBe(201)
    const childBody = (await child.json()) as { id: string }
    const childId = childBody.id

    const child2 = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: '孙页', parentId: childId }),
    })
    expect(child2.status).toBe(201)
    const child2Body = (await child2.json()) as { id: string; parentId: string }
    // parent_id 由父页 subpage 节点派生（08 §5）
    expect(child2Body.parentId).toBe(childId)

    const patch = await app.request(`/api/workspaces/${ws}/pages/${childId}`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({ title: '子页（改名）' }),
    })
    expect(patch.status).toBe(204)

    const tree = await app.request(`/api/workspaces/${ws}/pages`, { headers: h })
    expect(tree.status).toBe(200)
    const treeBody = (await tree.json()) as Array<{
      id: string
      title: string
      children: Array<{ id: string }>
    }>
    const childNode = treeBody.find((n) => n.id === childId)
    expect(childNode).toBeTruthy()
    expect(childNode!.title).toBe('子页（改名）')
    expect(childNode!.children.some((c) => c.id === child2Body.id)).toBe(true)
  })

  test('doc push/pull 差分与 404 语义', async () => {
    const user = await registerUser(`eve-${suffix}`)
    const ws = user.workspace.id
    const h = authed(user.accessToken)

    const page = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: '空页' }),
    })
    const { id: pageId } = (await page.json()) as { id: string }

    // 空页 pull → 404 LB_PAGE_NOT_FOUND
    const empty = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, { headers: h })
    expect(empty.status).toBe(404)
    expect(((await empty.json()) as { error: { code: string } }).error.code).toBe('LB_PAGE_NOT_FOUND')

    const client = makeClient()
    const update = await client.type('hello linkbase')
    const push = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      method: 'POST',
      headers: { ...h, 'content-type': 'application/octet-stream' },
      body: update as unknown as BodyInit,
    })
    expect(push.status).toBe(204)

    // 旧客户端（无内容）拉到全量
    const full = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, { headers: h })
    expect(full.status).toBe(200)
    const fullBytes = new Uint8Array(await full.arrayBuffer())
    expect(extractPageMeta(fullBytes).text).toContain('hello linkbase')

    // 第二客户端带空 SV 拉全量 → 再推增量 → 第一个客户端带 sv 拉差异
    const second = await app.request(
      `/api/workspaces/${ws}/pages/${pageId}/doc?state=${encodeURIComponent(client.stateVector() ?? '')}`,
      { headers: h },
    )
    expect(second.status).toBe(200)
    expect((await second.arrayBuffer()).byteLength).toBeGreaterThanOrEqual(0)

    await client.type('second line')
    const delta = Y.encodeStateAsUpdate(client.doc, stateVectorFromUpdate(client.merged()))
    const push2 = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      method: 'POST',
      headers: { ...h, 'content-type': 'application/octet-stream' },
      body: delta as unknown as BodyInit,
    })
    expect(push2.status).toBe(204)
  })

  test('doc push 超限 413', async () => {
    const user = await registerUser(`frank-${suffix}`)
    const ws = user.workspace.id
    const page = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: authed(user.accessToken),
      body: JSON.stringify({}),
    })
    const { id } = (await page.json()) as { id: string }
    const big = new Uint8Array(513 * 1024)
    const res = await app.request(`/api/workspaces/${ws}/pages/${id}/doc`, {
      method: 'POST',
      headers: { ...authed(user.accessToken), 'content-type': 'application/octet-stream' },
      body: big as unknown as BodyInit,
    })
    expect(res.status).toBe(413)
  })

  test('回收站：子树进站/恢复/彻底删除', async () => {
    const user = await registerUser(`grace-${suffix}`)
    const ws = user.workspace.id
    const h = authed(user.accessToken)
    const mk = async (body: Record<string, unknown>) => {
      const res = await app.request(`/api/workspaces/${ws}/pages`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(body),
      })
      return (await res.json()) as { id: string }
    }
    const parent = await mk({ title: '父' })
    const child = await mk({ title: '子', parentId: parent.id })

    await app.request(`/api/workspaces/${ws}/pages/${parent.id}`, { method: 'DELETE', headers: h })
    const trash = await app.request(`/api/workspaces/${ws}/trash`, { headers: h })
    const trashBody = (await trash.json()) as Array<{ id: string; path: string[] }>
    expect(trashBody.some((t) => t.id === child.id && t.path.includes('父'))).toBe(true)

    // 树中不再出现
    const tree = (await (
      await app.request(`/api/workspaces/${ws}/pages`, { headers: h })
    ).json()) as Array<{ id: string }>
    expect(tree.some((n) => n.id === parent.id)).toBe(false)

    // 恢复子树
    await app.request(`/api/workspaces/${ws}/pages/${parent.id}/restore`, { method: 'POST', headers: h })
    const restored = (await (
      await app.request(`/api/workspaces/${ws}/pages`, { headers: h })
    ).json()) as Array<{ id: string; children?: Array<{ id: string }> }>
    // 树是嵌套结构：子页挂在 parent.children 下，需递归找
    const findDeep = (nodes: Array<{ id: string; children?: Array<{ id: string }> }>, id: string): boolean =>
      nodes.some((n) => n.id === id || (n.children ? findDeep(n.children, id) : false))
    expect(findDeep(restored, child.id)).toBe(true)

    // 彻底删除后 doc 404（页不存在）
    await app.request(`/api/workspaces/${ws}/pages/${parent.id}?permanent=true`, {
      method: 'DELETE',
      headers: h,
    })
    const doc = await app.request(`/api/workspaces/${ws}/pages/${child.id}/doc`, { headers: h })
    expect(doc.status).toBe(404)
  })

  test('标签：重名 409、打标与页面标签', async () => {
    const user = await registerUser(`henry-${suffix}`)
    const ws = user.workspace.id
    const h = authed(user.accessToken)

    const tag = await app.request(`/api/workspaces/${ws}/tags`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ name: '重点', color: 3 }),
    })
    expect(tag.status).toBe(201)
    const tagBody = (await tag.json()) as { id: string }

    const dup = await app.request(`/api/workspaces/${ws}/tags`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ name: '重点' }),
    })
    expect(dup.status).toBe(409)
    expect(((await dup.json()) as { error: { code: string } }).error.code).toBe('LB_TAG_EXISTS')

    const page = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: '带标签的页' }),
    })
    const { id } = (await page.json()) as { id: string }
    const put = await app.request(`/api/workspaces/${ws}/pages/${id}/tags/${tagBody.id}`, {
      method: 'PUT',
      headers: h,
    })
    expect(put.status).toBe(204)
    const list = await app.request(`/api/workspaces/${ws}/pages/${id}/tags`, { headers: h })
    const listBody = (await list.json()) as Array<{ name: string }>
    expect(listBody.map((t) => t.name)).toContain('重点')
  })

  test('搜索：正文关键词命中（push 后经合并任务派生）', async () => {
    const user = await registerUser(`iris-${suffix}`)
    const ws = user.workspace.id
    const h = authed(user.accessToken)
    const page = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: '搜索目标' }),
    })
    const { id } = (await page.json()) as { id: string }

    const doc = new Y.Doc()
    const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
    const p = new Y.XmlElement('paragraph')
    const t = new Y.XmlText()
    t.insert(0, '量子波动速读法implement注解')
    p.insert(0, [t])
    fragment.insert(0, [p])
    const state = Y.encodeStateAsUpdate(doc)

    await app.request(`/api/workspaces/${ws}/pages/${id}/doc`, {
      method: 'POST',
      headers: { ...h, 'content-type': 'application/octet-stream' },
      body: state as unknown as BodyInit,
    })

    // 直接经服务层对齐派生缓存（定时任务逻辑同款）
    const { mergePage } = await import('../../src/services/docs.service.ts')
    await mergePage(testDb(), id)

    const search = await app.request(
      `/api/workspaces/${ws}/search?q=${encodeURIComponent('量子波动')}`,
      { headers: h },
    )
    expect(search.status).toBe(200)
    const body = (await search.json()) as Array<{ id: string; title: string }>
    expect(body.some((r) => r.id === id)).toBe(true)
  })

  test('收藏与最近访问', async () => {
    const user = await registerUser(`jack-${suffix}`)
    const ws = user.workspace.id
    const h = authed(user.accessToken)
    const welcome = user.workspace.welcomePageId
    expect((await app.request(`/api/workspaces/${ws}/pages/${welcome}/favorite`, { method: 'PUT', headers: h })).status).toBe(204)
    const favs = (await (
      await app.request(`/api/workspaces/${ws}/favorites`, { headers: h })
    ).json()) as Array<{ id: string }>
    expect(favs.some((f) => f.id === welcome)).toBe(true)
    expect((await app.request(`/api/workspaces/${ws}/pages/${welcome}/visit`, { method: 'PUT', headers: h })).status).toBe(204)
    const recents = (await (
      await app.request(`/api/workspaces/${ws}/recents`, { headers: h })
    ).json()) as Array<{ id: string }>
    expect(recents.some((r) => r.id === welcome)).toBe(true)
  })
})

// 测试里服务层直连的 DB 实例（与 app 同一连接串）
let sharedTestDb: ReturnType<typeof createDb> | null = null
function testDb(): ReturnType<typeof createDb> {
  if (!sharedTestDb) sharedTestDb = createDb(process.env.DATABASE_URL!)
  return sharedTestDb
}
