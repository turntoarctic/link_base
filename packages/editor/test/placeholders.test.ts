/** 分类型占位符单测（Notion 化 T5）：纯函数判定（文案经 i18next，测试环境可能未初始化——只断言非空/空） */
import { describe, expect, test } from 'bun:test'
import { Schema } from '@tiptap/pm/model'
import { isEmptyDoc, placeholderForNode } from '../src/extensions/placeholders.ts'
import i18next from 'i18next'

// 测试环境最小 i18n 初始化（占位符文案经 editor 命名空间）
await i18next.init({
  lng: 'zh',
  fallbackLng: 'zh',
  resources: {
    zh: {
      editor: {
        placeholder: {
          docEmpty: '输入 / 唤起命令菜单',
          heading1: '标题 1',
          heading2: '标题 2',
          heading3: '标题 3',
          task: '待办事项',
          quote: '空引用',
          callout: '输入正文',
          toggle: '折叠标题',
        },
      },
    },
  },
})

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] },
    heading: {
      group: 'block',
      content: 'text*',
      attrs: { level: { default: 1 } },
      toDOM: () => ['h1', 0],
    },
    detailsSummary: { group: 'block', content: 'text*', toDOM: () => ['summary', 0] },
    codeBlock: { group: 'block', content: 'text*', code: true, toDOM: () => ['pre', 0] },
    text: {},
  },
})

const p = (text = '') => schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
const h = (text = '', level = 1) => schema.nodes.heading.create({ level }, text ? schema.text(text) : null)

describe('isEmptyDoc', () => {
  test('仅一个空段落 = 空文档', () => {
    expect(isEmptyDoc(schema.nodes.doc.create(null, [p()]))).toBe(true)
    expect(isEmptyDoc(schema.nodes.doc.create(null, [p('x')]))).toBe(false)
    expect(isEmptyDoc(schema.nodes.doc.create(null, [p(), p()]))).toBe(false)
  })
})

describe('placeholderForNode', () => {
  test('标题按级别取词（i18n 未初始化时回退键名，非空即可）', () => {
    const doc = schema.nodes.doc.create(null, [h('', 2)])
    const hint = placeholderForNode({ node: h('', 2), pos: 0, doc })
    expect(hint.length).toBeGreaterThan(0)
    expect(hint).toContain('2')
  })

  test('detailsSummary 有提示；codeBlock 无提示', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.detailsSummary.create(), schema.nodes.codeBlock.create()])
    expect(placeholderForNode({ node: schema.nodes.detailsSummary.create(), pos: 0, doc }).length).toBeGreaterThan(0)
    expect(placeholderForNode({ node: schema.nodes.codeBlock.create(), pos: 6, doc })).toBe('')
  })

  test('空文档首段有提示', () => {
    const doc = schema.nodes.doc.create(null, [p()])
    expect(placeholderForNode({ node: p(), pos: 0, doc }).length).toBeGreaterThan(0)
  })

  test('非空文档的普通空段落无提示', () => {
    const doc = schema.nodes.doc.create(null, [p('x'), p()])
    expect(placeholderForNode({ node: p(), pos: 4, doc })).toBe('')
  })
})
