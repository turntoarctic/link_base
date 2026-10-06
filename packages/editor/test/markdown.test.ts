/** Markdown → PM JSON 映射单测（05 §9 兜底路线）：任务列表与块级图片的结构正确性 */
import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { markdownToPmJson, looksLikeMarkdown } from '../src/extensions/markdown.ts'
import { buildEditorKit } from '../src/index.ts'

describe('buildEditorKit', () => {
  test('装配包含 taskList/taskItem（starter-kit 不内置，slash 待办列表依赖）', () => {
    const names = buildEditorKit({ ydoc: new Y.Doc(), uploadImage: async () => ({ url: '' }) }).map((e) => e.name)
    expect(names).toContain('taskList')
    expect(names).toContain('taskItem')
  })

  test('装配包含附件节点（P1-6 / T2.6）', () => {
    const names = buildEditorKit({ ydoc: new Y.Doc(), uploadImage: async () => ({ url: '' }) }).map((e) => e.name)
    expect(names).toContain('attachment')
  })
})

describe('markdownToPmJson', () => {
  test('任务列表 → taskItem，块级内容平铺（嵌套列表不进段落）', () => {
    const blocks = markdownToPmJson('- [ ] 待办一\n- [x] 待办二\n  - 子项')
    expect(blocks.length).toBe(1)
    const list = blocks[0] as { type: string; content: Array<{ type: string; attrs?: { checked?: boolean }; content?: Array<{ type: string }> }> }
    expect(list.type).toBe('bulletList')
    const [first, second] = list.content
    expect(first.type).toBe('taskItem')
    expect(first.attrs?.checked).toBe(false)
    expect(first.content?.[0]?.type).toBe('paragraph')
    expect(second.attrs?.checked).toBe(true)
    // 嵌套列表是 taskItem 的块级兄弟，不是塞在段落里
    const nested = second.content?.find((b) => b.type === 'bulletList')
    expect(nested).toBeDefined()
  })

  test('空任务条目补空段落（taskItem content 非空）', () => {
    const blocks = markdownToPmJson('- [ ] ')
    const item = (blocks[0] as { content: Array<{ content: unknown[] }> }).content[0]
    expect(item.content.length).toBeGreaterThan(0)
    expect((item.content[0] as { type: string }).type).toBe('paragraph')
  })

  test('段内图片拆为块级兄弟节点（image 是 block atom）', () => {
    const blocks = markdownToPmJson('看这张图：\n\n![alt](https://example.com/a.png)\n\n后文')
    const images = blocks.filter((b) => b.type === 'image')
    expect(images.length).toBe(1)
    expect((images[0] as { attrs: { src: string } }).attrs.src).toBe('https://example.com/a.png')
    for (const b of blocks) {
      if (b.type !== 'paragraph') continue
      for (const child of (b as { content: Array<{ type: string }> }).content) {
        expect(child.type).not.toBe('image')
      }
    }
  })

  test('链接/粗体等行内标记照常映射', () => {
    const blocks = markdownToPmJson('这是 **加粗** 与 [链接](https://x.dev)')
    const p = blocks[0] as { type: string; content: Array<{ type: string; marks?: Array<{ type: string }> }> }
    expect(p.type).toBe('paragraph')
    const types = p.content.map((n) => n.type)
    expect(types).toContain('text')
    const bold = p.content.find((n) => n.marks?.some((m) => m.type === 'bold'))
    expect(bold).toBeDefined()
    const link = p.content.find((n) => n.marks?.some((m) => m.type === 'link'))
    expect(link).toBeDefined()
  })
})

describe('looksLikeMarkdown', () => {
  test('识别标题/列表/任务/表格标记（函数只看多行输入，粘贴场景如此）', () => {
    expect(looksLikeMarkdown('# 标题\n正文')).toBe(true)
    expect(looksLikeMarkdown('前言\n- [ ] 待办')).toBe(true)
    expect(looksLikeMarkdown('x\n| a | b |')).toBe(true)
  })
  test('普通多行文本不误判', () => {
    expect(looksLikeMarkdown('第一行\n第二行')).toBe(false)
    expect(looksLikeMarkdown('单行')).toBe(false)
  })
})
