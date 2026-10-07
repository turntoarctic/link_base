/** 块类型注册表单测（Notion 化 T2）：完整性与结构（headless Editor 在 bun 不可建，激活态判定留浏览器会话） */
import { describe, expect, test } from 'bun:test'
import { BLOCK_TYPES } from '../src/extensions/block-types.ts'
import { buildEditorKit } from '../src/index.ts'
import * as Y from 'yjs'

describe('BLOCK_TYPES', () => {
  test('注册表 id 唯一且覆盖全部可转类型', () => {
    const ids = BLOCK_TYPES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    const required = ['paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'callout', 'details']
    for (const id of required) expect(ids).toContain(id)
  })

  test('每项都有 icon/isActive/convert，且 id 可用作 slash.item 文案键', () => {
    for (const entry of BLOCK_TYPES) {
      expect(entry.icon).toBeTruthy()
      expect(typeof entry.isActive).toBe('function')
      expect(typeof entry.convert).toBe('function')
    }
  })

  test('kit 装配含块菜单依赖的节点（callout/details）', () => {
    const names = buildEditorKit({ ydoc: new Y.Doc(), uploadImage: async () => ({ url: '' }) }).map((e) => e.name)
    expect(names).toContain('callout')
    expect(names).toContain('details')
    expect(names).toContain('detailsSummary')
  })
})
