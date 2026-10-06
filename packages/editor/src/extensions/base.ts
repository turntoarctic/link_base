/**
 * Base 数据库块（P1-8 / T2.8，02 §2.1）：行 + 类型化列 + 表格/看板视图。
 * 存储：数据全部在所在页 Y.Doc 的顶层 `base:{baseId}` Y.Map（无新表）——
 *   columns: Y.Array<Y.Map<{ id, name, type, options? }>>（首列固定 title）
 *   rows:    Y.Map<rowId, Y.Map<{ title, pageId?, cells }>>（cells = 列id → 值 的普通对象）
 * baseBlock 为页面内容中的 atom 节点，attrs.baseId 指向该 Map。
 * 行转子页面：宿主桥 createSubpage（父页 = 所在页），row.pageId 关联，点击打开。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import * as Y from 'yjs'
import { BaseView } from '../components/base-view.tsx'

export const NODE_BASE = 'baseBlock'

export interface BaseColumn {
  id: string
  name: string
  type: 'text' | 'select' | 'date' | 'number' | 'checkbox'
  options?: Array<{ id: string; name: string }>
  /** 列宽（P2 拖拽调整，随 Y 同步） */
  width?: number
}

export interface BaseSource {
  /** 行转子页面：在当前页下建子页（标题默认取行标题） */
  createSubpage: (title: string) => Promise<{ pageId: string } | null>
  onOpen: (pageId: string) => void
}

export interface BaseBridge {
  ydoc: Y.Doc
  source: BaseSource
}

let baseBridge: BaseBridge | null = null

export function configureBaseBridge(bridge: BaseBridge | null): void {
  baseBridge = bridge
}

export function getBaseBridge(): BaseBridge | null {
  return baseBridge
}

export function baseMapName(baseId: string): string {
  return `base:${baseId}`
}

/** 确保结构的 Y.Map 存在并带默认列；幂等 */
export function ensureBaseMap(ydoc: Y.Doc, baseId: string): Y.Map<any> {
  const name = baseMapName(baseId)
  let map = ydoc.getMap(name) as any
  if (!map.has('columns')) {
    map.set('columns', Y.Array.from([el('title', '标题', 'text')]))
  }
  if (!map.has('rows')) {
    map.set('rows', new Y.Map())
  }
  const rows = map.get('rows') as any
  if (rows.size === 0) {
    const row = new Y.Map() as any
    row.set('title', '')
    row.set('cells', {})
    rows.set(crypto.randomUUID(), row)
  }
  return map
}

function el(id: string, name: string, type: BaseColumn['type']): any {
  const m = new Y.Map() as any
  m.set('id', id)
  m.set('name', name)
  m.set('type', type)
  return m
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    baseBlock: {
      /** 插入数据库块（baseId 缺省自动生成并初始化结构） */
      insertBaseBlock: (attrs?: { baseId?: string }) => ReturnType
    }
  }
}

export const BaseBlock = Node.create({
  name: NODE_BASE,
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      baseId: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: `div[data-type="${NODE_BASE}"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': NODE_BASE })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BaseView)
  },

  addCommands() {
    return {
      insertBaseBlock:
        (attrs?: { baseId?: string }) =>
        ({ editor, commands }) => {
          const baseId = attrs?.baseId ?? crypto.randomUUID()
          const bridge = (editor.extensionManager.extensions.find((e) => e.name === NODE_BASE)?.options ?? {}) as {
            ydoc?: Y.Doc
          }
          if (bridge.ydoc) ensureBaseMap(bridge.ydoc, baseId)
          return commands.insertContent({ type: NODE_BASE, attrs: { baseId } })
        },
    }
  },
})
