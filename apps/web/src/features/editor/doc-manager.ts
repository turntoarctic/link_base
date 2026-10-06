/**
 * 页面 Y.Doc 管理器（05 §3）：打开（y-indexeddb 秒开 → REST pull 差分）、
 * 保存（本地 update 去抖 500ms push，断网补推）、跨标签页 BroadcastChannel provider。
 * Provider 层挂在工作空间壳上（06 §2），切页仅切换 Y.Doc。
 */
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { NODE_SUBPAGE, SUBPAGE_ATTR, Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import { api } from '@/lib/fetch'

const PAGE_KEY = (pageId: string) => `page:${pageId}`
const CHANNEL_NAME = 'linkbase-doc'
const PUSH_DEBOUNCE_MS = 500
const MAX_OPEN_DOCS = 12

/** 远程回放标记：update 回调里据此区分本地/远程（05 §3.2 只推本地产生的 update） */
export const remoteOrigin = { source: 'linkbase-remote' } as const

interface Entry {
  wsId: string
  ydoc: Y.Doc
  idb: IndexeddbPersistence
  channel: BroadcastChannel
  pending: Uint8Array[]
  timer: ReturnType<typeof setTimeout> | null
  pushFailed: boolean
}

const entries = new Map<string, Entry>()

function hasContent(ydoc: Y.Doc): boolean {
  return ydoc.getXmlFragment(Y_FRAGMENT_NAME).length > 0
}

/** 新页面：本地为空且服务端无内容 → 初始化空段落（05 §3.1） */
function initEmptyDoc(ydoc: Y.Doc): void {
  const fragment = ydoc.getXmlFragment(Y_FRAGMENT_NAME)
  const paragraph = new Y.XmlElement('paragraph')
  fragment.insert(0, [paragraph])
}

export interface OpenDocResult {
  ydoc: Y.Doc
  /** 服务端是否已有内容（新页为 false） */
  fromServer: boolean
}

export async function openPageDoc(wsId: string, pageId: string): Promise<OpenDocResult> {
  const existing = entries.get(pageId)
  if (existing) return { ydoc: existing.ydoc, fromServer: true }

  const ydoc = new Y.Doc()
  const idb = new IndexeddbPersistence(PAGE_KEY(pageId), ydoc)
  // 本地缓存先行（秒开）；超时兜底避免 indexeddb 异常卡死首屏
  await Promise.race([idb.whenSynced, new Promise((r) => setTimeout(r, 800))])

  const entry: Entry = {
    wsId,
    ydoc,
    idb,
    channel: new BroadcastChannel(CHANNEL_NAME),
    pending: [],
    timer: null,
    pushFailed: false,
  }

  // 跨标签页（05 §3.3）：请求一份全量，随后互转增量
  entry.channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type: string; pageId: string; update?: Uint8Array }
    if (msg.pageId !== pageId || !msg.update) return
    if (msg.type === 'sync-request') {
      entry.channel.postMessage({ type: 'sync-response', pageId, update: Y.encodeStateAsUpdate(ydoc) })
    } else if (msg.type === 'sync-response' || msg.type === 'update') {
      Y.applyUpdate(ydoc, msg.update, remoteOrigin)
    }
  }
  entry.channel.postMessage({ type: 'sync-request', pageId })

  // 服务端差异（08 §4.1：404 = 服务端无内容 → 本地为准）
  const sv = Y.encodeStateVector(ydoc)
  const stateB64 = bytesToBase64(sv)
  const remote = await api.bytes(
    `/workspaces/${wsId}/pages/${pageId}/doc?state=${encodeURIComponent(stateB64)}`,
  )
  let fromServer = false
  if (remote) {
    Y.applyUpdate(ydoc, remote, remoteOrigin)
    fromServer = true
  } else if (!hasContent(ydoc)) {
    initEmptyDoc(ydoc)
  }

  // 本地更新 → 广播 + 去抖推送
  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === remoteOrigin) return
    try {
      entry.channel.postMessage({ type: 'update', pageId, update })
    } catch {
      // structured clone 失败（罕见）不影响本地编辑
    }
    entry.pending.push(update)
    scheduleFlush(wsId, pageId, entry)
  })

  entries.set(pageId, entry)
  evictIfNeeded(wsId)
  return { ydoc, fromServer }
}

function scheduleFlush(wsId: string, pageId: string, entry: Entry): void {
  if (entry.timer) return
  entry.timer = setTimeout(() => {
    entry.timer = null
    void flushEntry(wsId, pageId, entry)
  }, PUSH_DEBOUNCE_MS)
}

async function flushEntry(wsId: string, pageId: string, entry: Entry): Promise<void> {
  if (entry.pending.length === 0) return
  const merged = entry.pending.length === 1 ? entry.pending[0]! : Y.mergeUpdates(entry.pending)
  entry.pending = []
  try {
    await api.pushBytes(`/workspaces/${wsId}/pages/${pageId}/doc`, merged)
    entry.pushFailed = false
  } catch (error) {
    // 401/429 由 fetch 层处理；断网时重新排队，恢复后补推（05 §3.2）
    entry.pending.push(merged)
    entry.pushFailed = true
    console.warn('[doc-sync] push failed, queued for retry', error)
  }
}

/** 页面切换/关闭时不再主动销毁（LRU 驱逐 + flush），跨页秒开 */
function evictIfNeeded(wsId: string): void {
  if (entries.size <= MAX_OPEN_DOCS) return
  const oldest = entries.keys().next().value
  if (oldest) void closePageDoc(wsId, oldest)
}

export async function closePageDoc(wsId: string, pageId: string): Promise<void> {
  const entry = entries.get(pageId)
  if (!entry) return
  entries.delete(pageId)
  if (entry.timer) clearTimeout(entry.timer)
  await flushEntry(wsId, pageId, entry)
  entry.channel.close()
  entry.idb.destroy()
  entry.ydoc.destroy()
}

/**
 * 服务端结构操作（建子页等）后重拉差分：打开中的 Y.Doc 对齐服务端权威写入
 * （POST {parentId} 由服务端 appendSubpageNode 写入，08 §4.4/§5）。
 * 未打开的页下次 openPageDoc 自然拉到，无需处理。
 */
export async function refreshPageDoc(wsId: string, pageId: string): Promise<void> {
  const entry = entries.get(pageId)
  if (!entry) return
  const sv = Y.encodeStateVector(entry.ydoc)
  const remote = await api.bytes(
    `/workspaces/${wsId}/pages/${pageId}/doc?state=${encodeURIComponent(bytesToBase64(sv))}`,
  )
  if (remote) Y.applyUpdate(entry.ydoc, remote, remoteOrigin)
}

/** beforeunload 兜底 flush（fetch keepalive） */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const entry of entries.values()) {
      if (entry.pending.length === 0) continue
      const merged = Y.mergeUpdates(entry.pending)
      entry.pending = []
      const token = localStorage.getItem('linkbase.accessToken')
      void fetch(`/api/workspaces/${entry.wsId}/pages/${entryId(entry)}/doc`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: merged as unknown as BodyInit,
        keepalive: true,
      }).catch(() => {})
    }
  })
}

function entryId(entry: Entry): string {
  for (const [pageId, value] of entries) {
    if (value === entry) return pageId
  }
  return ''
}

/* ------------------------------- 子页节点操作（页面树，02 §1.2） ------------------------------- */

interface SubpageNodeRef {
  node: Y.XmlElement
  pageId: string
  index: number
}

function findSubpageNodes(ydoc: Y.Doc): SubpageNodeRef[] {
  const fragment = ydoc.getXmlFragment(Y_FRAGMENT_NAME)
  const out: SubpageNodeRef[] = []
  fragment.forEach((child, index) => {
    if (child instanceof Y.XmlElement && child.nodeName === NODE_SUBPAGE) {
      out.push({
        node: child,
        pageId: String(child.getAttribute(SUBPAGE_ATTR.pageId) ?? ''),
        index,
      })
    }
  })
  return out
}

/** 在父页内容插入子页节点（beforePageId=null 追加到末尾） */
export async function insertSubpageNode(
  wsId: string,
  parentId: string,
  pageId: string,
  title: string,
  beforePageId?: string | null,
): Promise<void> {
  const { ydoc } = await openPageDoc(wsId, parentId)
  const fragment = ydoc.getXmlFragment(Y_FRAGMENT_NAME)
  const node = new Y.XmlElement(NODE_SUBPAGE)
  node.setAttribute(SUBPAGE_ATTR.pageId, pageId)
  node.setAttribute(SUBPAGE_ATTR.title, title)
  const siblings = findSubpageNodes(ydoc)
  const anchor = beforePageId ? siblings.find((s) => s.pageId === beforePageId) : undefined
  fragment.insert(anchor ? anchor.index : fragment.length, [node])
}

/** 从父页内容移除子页节点（存在才删） */
export async function removeSubpageNode(
  wsId: string,
  parentId: string,
  pageId: string,
): Promise<void> {
  const { ydoc } = await openPageDoc(wsId, parentId)
  const fragment = ydoc.getXmlFragment(Y_FRAGMENT_NAME)
  const found = findSubpageNodes(ydoc).find((s) => s.pageId === pageId)
  if (found) fragment.delete(found.index, 1)
}

/**
 * 树内拖拽换序/换父（P0-4）：subpage 节点在父页文档间搬移；
 * parent_id 由服务端从内容派生（08 §5），此处只操作 Y.Doc，推送自动完成。
 */
export async function moveSubpageNode(opts: {
  wsId: string
  pageId: string
  title: string
  currentParentId: string | null
  newParentId: string | null
  beforePageId: string | null
}): Promise<void> {
  const { wsId, pageId, title, currentParentId, newParentId, beforePageId } = opts

  if (currentParentId === newParentId) {
    if (!currentParentId) return // 顶级之间 MVP 不排序（默认按创建序）
    const { ydoc } = await openPageDoc(wsId, currentParentId)
    const found = findSubpageNodes(ydoc).find((s) => s.pageId === pageId)
    if (!found) return
    const siblings = findSubpageNodes(ydoc)
    const anchor = beforePageId ? siblings.find((s) => s.pageId === beforePageId) : undefined
    let target = anchor
      ? anchor.index
      : ((siblings.at(-1)?.index ?? 0) + 1)
    if (target > found.index) target -= 1 // 先删后插的索引补偿
    if (target === found.index) return
    const fragment = ydoc.getXmlFragment(Y_FRAGMENT_NAME)
    const node = found.node
    fragment.delete(found.index, 1)
    fragment.insert(target, [node])
    return
  }

  if (currentParentId) await removeSubpageNode(wsId, currentParentId, pageId)
  if (newParentId) await insertSubpageNode(wsId, newParentId, pageId, title, beforePageId)
}

/* ------------------------------- 工具 ------------------------------- */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
