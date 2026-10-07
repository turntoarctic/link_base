/**
 * 块级操作纯函数单测（Notion 化 T1）：顶层块索引数学与移动事务构造。
 * PM 位置语义：TopBlock.pos 是内容起点，节点跨度 [pos-1, pos-1+size)。
 */
import { describe, expect, test } from 'bun:test'
import { Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { blockIndexAt, insertPosAtIndex, moveTopLevelBlockTr, topLevelBlocks } from '../src/extensions/block-utils.ts'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: {},
  },
})

function makeDoc(...blocks: string[]): EditorState {
  const nodes = blocks.map((b) => schema.nodes.paragraph.create(null, b ? schema.text(b) : null))
  return EditorState.create({ doc: schema.nodes.doc.create(null, nodes) })
}

describe('topLevelBlocks', () => {
  test('枚举顶层块并列出内容起点/节点跨度', () => {
    const state = makeDoc('one', 'two', 'three')
    const blocks = topLevelBlocks(state.doc)
    expect(blocks).toHaveLength(3)
    // 首块节点起点 0（内容起点 1），size = 段落 2 + 文本 3 = 5
    expect(blocks[0]).toMatchObject({ index: 0, pos: 1, size: 5 })
    expect(blocks[1]).toMatchObject({ index: 1, pos: 6, size: 5 })
  })

  test('空文档（仅空段落）', () => {
    const state = makeDoc('')
    const blocks = topLevelBlocks(state.doc)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ index: 0, pos: 1, size: 2 })
  })
})

describe('blockIndexAt', () => {
  test('按位置命中块；末尾越界落最后一块', () => {
    const state = makeDoc('one', 'two')
    const blocks = topLevelBlocks(state.doc)
    expect(blockIndexAt(blocks, 2)).toBe(0)
    expect(blockIndexAt(blocks, 7)).toBe(1)
    expect(blockIndexAt(blocks, 12)).toBe(1)
  })
})

describe('insertPosAtIndex', () => {
  test('索引即节点起点；越界 = 文档末尾', () => {
    const state = makeDoc('one', 'two', 'three')
    expect(insertPosAtIndex(state.doc, 0)).toBe(0)
    expect(insertPosAtIndex(state.doc, 1)).toBe(5)
    expect(insertPosAtIndex(state.doc, 3)).toBe(state.doc.content.size)
    expect(insertPosAtIndex(state.doc, 99)).toBe(state.doc.content.size)
  })
})

describe('moveTopLevelBlockTr', () => {
  test('下移：delete+insert 一事务，文本顺序正确', () => {
    const state = makeDoc('a', 'b', 'c')
    const tr = moveTopLevelBlockTr(state, 0, 2)
    expect(tr).not.toBeNull()
    expect(tr!.doc.textBetween(0, tr!.doc.content.size, '|')).toBe('b|a|c')
  })

  test('上移：文本顺序正确', () => {
    const state = makeDoc('a', 'b', 'c')
    const tr = moveTopLevelBlockTr(state, 2, 1)
    expect(tr!.doc.textBetween(0, tr!.doc.content.size, '|')).toBe('a|c|b')
  })

  test('同位/相邻同向 = 无操作 null', () => {
    const state = makeDoc('a', 'b')
    expect(moveTopLevelBlockTr(state, 1, 1)).toBeNull()
    expect(moveTopLevelBlockTr(state, 0, 1)).toBeNull()
  })

  test('越界 fromIndex 返回 null', () => {
    const state = makeDoc('a')
    expect(moveTopLevelBlockTr(state, 5, 0)).toBeNull()
  })
})
