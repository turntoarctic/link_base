/**
 * Y.Doc 存储服务（08 §4）：
 * pull = 快照快路径 + 增量合并差分（空页 404 LB_PAGE_NOT_FOUND）；
 * push = 只落增量（写路径快），≥50 条触发快照合并；
 * 派生缓存（text/parent_id）在合并后与建子页时对齐（08 §5）。
 */
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import * as Y from 'yjs'
import {
  buildPageState,
  diffUpdate,
  extractPageMeta,
  loadYDoc,
  markdownToYDoc,
  mergeUpdates,
  stateVectorFromUpdate,
  yToMarkdown,
} from '@linkbase/ydoc'
import { Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import { base64ToBytes } from '@linkbase/ydoc'
import { pageSnapshots, pageUpdates, pages, workspaceMembers } from '../db/index.ts'
import { notifyMentionsInTx } from './notifications.service.ts'
import { errPageNotFound, errPayloadTooLarge } from '../lib/errors.ts'
import { logger } from '../lib/logger.ts'
import type { LinkbaseDb } from '../lib/deps.ts'

export const MAX_UPDATE_BYTES = 512 * 1024
/** 单页增量阈值：达到即合并（08 §4.3） */
export const MERGE_THRESHOLD_UPDATES = 50

/** 合并后的全量状态；无内容返回 null（空页） */
export async function getPageState(db: LinkbaseDb, pageId: string): Promise<Uint8Array | null> {
  const snaps = await db
    .select({ blob: pageSnapshots.blob })
    .from(pageSnapshots)
    .where(eq(pageSnapshots.pageId, pageId))
    .orderBy(desc(pageSnapshots.version))
    .limit(1)
  const updates = await db
    .select({ blob: pageUpdates.blob })
    .from(pageUpdates)
    .where(eq(pageUpdates.pageId, pageId))
    .orderBy(asc(pageUpdates.id))
  if (!snaps[0] && updates.length === 0) return null
  return buildPageState(
    snaps[0]?.blob ?? null,
    updates.map((u) => u.blob),
  )
}

/** GET /doc：clientSvB64 为客户端 state vector（base64），返回差异 update（08 §4.1） */
export async function pullDoc(
  db: LinkbaseDb,
  pageId: string,
  clientSvB64: string | null,
): Promise<Uint8Array> {
  const state = await getPageState(db, pageId)
  if (!state) throw errPageNotFound()
  const clientSv = clientSvB64 ? base64ToBytes(clientSvB64) : null
  return diffUpdate(state, clientSv)
}

/** POST /doc：不即时合并、不即时解析（08 §4.2） */
export async function pushDoc(
  db: LinkbaseDb,
  pageId: string,
  actorId: string,
  update: Uint8Array,
): Promise<void> {
  if (update.byteLength > MAX_UPDATE_BYTES) throw errPayloadTooLarge(MAX_UPDATE_BYTES)
  await db.transaction(async (tx) => {
    await tx.insert(pageUpdates).values({ pageId, blob: update, actor: actorId })
    await tx.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, pageId))
  })
  const counts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pageUpdates)
    .where(eq(pageUpdates.pageId, pageId))
  if ((counts[0]?.count ?? 0) >= MERGE_THRESHOLD_UPDATES) {
    // 写路径外异步合并，不阻塞响应
    queueMicrotask(() => {
      void mergePage(db, pageId, 'auto', actorId).catch((error) => logger.error({ error, pageId }, 'merge failed'))
    })
  }
}

/** 快照合并（08 §4.3）：合并 → 写新快照 → 删已并入增量 → 派生缓存刷新；幂等 */
export async function mergePage(
  db: LinkbaseDb,
  pageId: string,
  reason = 'auto',
  actorId?: string,
): Promise<boolean> {
  const wsIdRows = await db
    .select({ workspaceId: pages.workspaceId })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1)
  const wsId = wsIdRows[0]?.workspaceId
  if (!wsId) return false

  return db.transaction(async (tx) => {
    const snaps = await tx
      .select({ version: pageSnapshots.version, blob: pageSnapshots.blob })
      .from(pageSnapshots)
      .where(eq(pageSnapshots.pageId, pageId))
      .orderBy(desc(pageSnapshots.version))
      .limit(1)
    const updates = await tx
      .select({ blob: pageUpdates.blob })
      .from(pageUpdates)
      .where(eq(pageUpdates.pageId, pageId))
      .orderBy(asc(pageUpdates.id))
    if (updates.length === 0) return false // 无增量不合并

    const state = buildPageState(
      snaps[0]?.blob ?? null,
      updates.map((u) => u.blob),
    )
    await tx.insert(pageSnapshots).values({
      pageId,
      version: (snaps[0]?.version ?? 0) + 1,
      blob: state,
      reason,
    })
    await tx.delete(pageUpdates).where(eq(pageUpdates.pageId, pageId))
    await deriveMetaInTx(tx, wsId, pageId, state, actorId)
    return true
  })
}

/** 快照版本号：当前最大 +1（每页自增不回收） */
async function nextVersion(tx: TxLike, pageId: string): Promise<number> {
  const rows = await tx
    .select({ version: pageSnapshots.version })
    .from(pageSnapshots)
    .where(eq(pageSnapshots.pageId, pageId))
    .orderBy(desc(pageSnapshots.version))
    .limit(1)
  return (rows[0]?.version ?? 0) + 1
}

/** 手动保存版本（08 §4.5 reason=manual）；无内容 404 */
export async function saveVersion(db: LinkbaseDb, pageId: string): Promise<number> {
  const state = await getPageState(db, pageId)
  if (!state) throw errPageNotFound()
  return db.transaction(async (tx) => {
    const version = await nextVersion(tx, pageId)
    await tx.insert(pageSnapshots).values({ pageId, version, blob: state, reason: 'manual' })
    return version
  })
}

/** 版本时间线（08 §4.5：快照即版本，新→旧；excerpt 供列表预览） */
export async function listVersions(
  db: LinkbaseDb,
  pageId: string,
): Promise<Array<{ version: number; reason: string; createdAt: string; excerpt: string }>> {
  const rows = await db
    .select()
    .from(pageSnapshots)
    .where(eq(pageSnapshots.pageId, pageId))
    .orderBy(desc(pageSnapshots.version))
    .limit(50)
  return rows.map((r) => ({
    version: r.version,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    excerpt: extractPageMeta(r.blob).text.slice(0, 120),
  }))
}

/** 单个版本正文（面板预览用） */
export async function getVersionText(db: LinkbaseDb, pageId: string, version: number): Promise<string> {
  const rows = await db
    .select({ blob: pageSnapshots.blob })
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.pageId, pageId), eq(pageSnapshots.version, version)))
    .limit(1)
  if (!rows[0]) throw errPageNotFound()
  return extractPageMeta(rows[0].blob).text
}

/** 恢复（08 §4.5）：目标快照作为新 update 合入（CRDT 合并，不丢并发编辑）+
 * 广播 WS 在线客户端 + reason=restore 快照 */
export async function restoreVersion(
  db: LinkbaseDb,
  wsId: string,
  pageId: string,
  version: number,
  actorId: string,
  broadcast?: (update: Uint8Array) => void,
): Promise<void> {
  const rows = await db
    .select({ blob: pageSnapshots.blob })
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.pageId, pageId), eq(pageSnapshots.version, version)))
    .limit(1)
  if (!rows[0]) throw errPageNotFound()
  const blob = rows[0].blob
  await db.insert(pageUpdates).values({ pageId, blob, actor: actorId })
  broadcast?.(blob)
  await mergePage(db, pageId, 'restore')
}

/** 派生缓存管道（08 §5）：text + 子页 parent_id（一个子页只认文档序第一个父页） */
export async function derivePageMeta(db: LinkbaseDb, pageId: string): Promise<void> {
  const rows = await db
    .select({ workspaceId: pages.workspaceId })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1)
  const wsId = rows[0]?.workspaceId
  if (!wsId) return
  const state = await getPageState(db, pageId)
  if (!state) return
  await db.transaction(async (tx) => deriveMetaInTx(tx, wsId, pageId, state))
}

type TxLike = Parameters<Parameters<LinkbaseDb['transaction']>[0]>[0]

async function deriveMetaInTx(
  tx: TxLike,
  wsId: string,
  pageId: string,
  state: Uint8Array,
  actorId?: string,
): Promise<void> {
  const meta = extractPageMeta(state)
  await tx.update(pages).set({ text: meta.text }).where(eq(pages.id, pageId))
  // 提及通知（P1-9）：派生时顺带触发；调度路径无 actor 则跳过
  if (actorId && meta.mentionIds.length > 0) {
    await notifyMentionsInTx(tx, {
      wsId,
      pageId,
      actorId,
      userIds: meta.mentionIds,
      excerpt: meta.text.slice(0, 200),
    }).catch((error) => logger.error({ error, pageId }, 'mention notify failed'))
  }
  if (meta.subpageIds.length > 0) {
    await tx
      .update(pages)
      .set({ parentId: pageId })
      .where(and(eq(pages.workspaceId, wsId), inArray(pages.id, meta.subpageIds)))
  }
}

/** 快照合并定时扫描（08 §4.3）：updated_at 距上次合并 > 1h 且仍有增量的页 */
export async function mergeStalePages(db: LinkbaseDb): Promise<number> {
  const stale = await db
    .select({ id: pages.id })
    .from(pages)
    .where(
      and(
        lt(pages.updatedAt, new Date(Date.now() - 3600 * 1000)),
        sql`exists (select 1 from page_updates u where u.page_id = ${pages.id})`,
      ),
    )
    .limit(200)
  let merged = 0
  for (const row of stale) {
    try {
      if (await mergePage(db, row.id)) merged += 1
    } catch (error) {
      logger.error({ error, pageId: row.id }, 'stale merge failed')
    }
  }
  return merged
}

/** 复制页面/模板建页（08 §4.4）：取模板当前状态写入新页快照 */
export async function copyPageState(
  db: LinkbaseDb,
  sourcePageId: string,
  newPageId: string,
): Promise<Uint8Array | null> {
  const state = await getPageState(db, sourcePageId)
  if (!state) return null
  await db.transaction(async (tx) => {
    await tx.insert(pageSnapshots).values({ pageId: newPageId, version: 1, blob: state, reason: 'copy' })
    await tx.update(pages).set({ text: extractPageMeta(state).text }).where(eq(pages.id, newPageId))
  })
  return state
}

/** 增量合并为单条 update（供测试/管理用途） */
export { mergeUpdates }

/* ------------------------------- Markdown 导入导出（05 §7 / §9，T2.5） ------------------------------- */

/** 导出：合并态 → PM JSON → Markdown（GFM） */
export async function exportPageMarkdown(db: LinkbaseDb, pageId: string): Promise<{ title: string; markdown: string }> {
  const rows = await db.select({ title: pages.title }).from(pages).where(eq(pages.id, pageId)).limit(1)
  if (!rows[0]) throw errPageNotFound()
  const state = await getPageState(db, pageId)
  if (!state) return { title: rows[0].title, markdown: '' }
  return { title: rows[0].title, markdown: yToMarkdown(loadYDoc(state).getXmlFragment(Y_FRAGMENT_NAME)) }
}

/** 导入建页：md → Y.Doc → 快照（reason=copy，08 §3.4 的 reason 集合内）+ 派生缓存 */
export async function importPageMarkdown(
  db: LinkbaseDb,
  wsId: string,
  actorId: string,
  input: { title?: string; markdown: string },
): Promise<{ id: string; title: string }> {
  const ydoc = markdownToYDoc(input.markdown)
  const meta = extractPageMeta(ydoc)
  const state = Y.encodeStateAsUpdate(ydoc)
  const pageId = crypto.randomUUID()
  const title = (input.title ?? '').trim() || firstHeadingTitle(input.markdown) || '导入的页面'
  await db.transaction(async (tx) => {
    await tx.insert(pages).values({ id: pageId, workspaceId: wsId, title, createdBy: actorId })
    await tx.insert(pageSnapshots).values({ pageId, version: 1, blob: state, reason: 'copy' })
    await tx.update(pages).set({ text: meta.text }).where(eq(pages.id, pageId))
  })
  return { id: pageId, title }
}

function firstHeadingTitle(markdown: string): string {
  const m = /^#{1,6}\s+(.+)$/m.exec(markdown)
  return m?.[1]?.trim().slice(0, 200) ?? ''
}
