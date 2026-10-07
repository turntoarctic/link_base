/**
 * 块级操作共享工具（Notion 化 T1）：顶层块索引的纯函数。
 * 注意 PM 位置语义：TopBlock.pos 是块**内容**起点，节点跨度是 [pos-1, pos-1+size)——
 * nodeDOM/delete/装饰插入各自期望的基准不同，统一在这里换算（历史上两套基准混用必错位）。
 */
import type { EditorState } from '@tiptap/pm/state'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

export interface TopBlock {
  index: number
  pos: number // 内容起点（节点起点 = pos - 1）
  size: number
}

export function topLevelBlocks(doc: ProsemirrorNode): TopBlock[] {
  const blocks: TopBlock[] = []
  let pos = 1
  doc.forEach((node, _offset, index) => {
    blocks.push({ index, pos, size: node.nodeSize })
    pos += node.nodeSize
  })
  return blocks
}

export function blockIndexAt(blocks: TopBlock[], pos: number): number | null {
  for (const b of blocks) {
    if (pos >= b.pos - 1 && pos < b.pos - 1 + b.size) return b.index
  }
  return blocks.length > 0 ? blocks.length - 1 : null
}

/** 目标 doc 中第 index 个顶层块的节点起始位置；index 越界 = 文档末尾 */
export function insertPosAtIndex(doc: ProsemirrorNode, index: number): number {
  const count = doc.childCount
  if (index >= count) return doc.content.size
  let pos = 0
  for (let i = 0; i < index && i < count; i++) {
    pos += doc.child(i).nodeSize
  }
  return pos
}

/** 当前选区命中的顶层块（顶层无嵌套场景，含选区起点所在块） */
export function topLevelBlockAtSelection(state: EditorState): TopBlock | null {
  const blocks = topLevelBlocks(state.doc)
  if (blocks.length === 0) return null
  const index = blockIndexAt(blocks, state.selection.from)
  return index == null ? null : blocks[index]!
}

/** 顶层块移动的单事务构造（拖拽与快捷键移动共用）；同位/相邻同向 = 无操作返回 null。
 * delete+insert 一事务完成，撤销栈只记一步。 */
export function moveTopLevelBlockTr(
  state: EditorState,
  fromIndex: number,
  dropIndex: number,
): Transaction | null {
  const block = topLevelBlocks(state.doc)[fromIndex]
  if (!block) return null
  if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return null
  const moved = state.doc.child(fromIndex)
  const tr = state.tr
  const nodeStart = block.pos - 1 // TopBlock.pos 为内容起点，节点跨度是 [pos-1, pos-1+size)
  tr.delete(nodeStart, nodeStart + block.size)
  const toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex
  tr.insert(insertPosAtIndex(tr.doc, toIndex), moved)
  return tr
}
