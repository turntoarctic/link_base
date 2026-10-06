/**
 * packages/ydoc 单测（T0.4/T0.5）：merge/diff/SV 桥接、提取器、quick-start 构建器。
 * 纯 yjs，无 DB 依赖。客户端真值交叉验证（Tiptap headless）随 Phase 1 编辑器基建补。
 */
import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { NODE_SUBPAGE, SUBPAGE_ATTR, Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import {
  appendSubpageNode,
  base64ToBytes,
  buildPageState,
  buildQuickStartState,
  bytesToBase64,
  diffUpdate,
  encodeDocState,
  extractPageMeta,
  mergeUpdates,
  stateVectorFromUpdate,
} from '../src/index.ts'

function docWithParagraph(content: string): Y.Doc {
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
  const p = new Y.XmlElement('paragraph')
  const t = new Y.XmlText()
  t.insert(0, content)
  p.insert(0, [t])
  fragment.insert(0, [p])
  return doc
}

describe('updates', () => {
  test('mergeUpdates 合并后内容完整', () => {
    const doc = docWithParagraph('hello')
    const u1 = encodeDocState(doc)
    // 第二个客户端追加段落
    const doc2 = new Y.Doc()
    Y.applyUpdate(doc2, u1)
    const p2 = new Y.XmlElement('paragraph')
    const t2 = new Y.XmlText()
    t2.insert(0, 'world')
    p2.insert(0, [t2])
    doc2.getXmlFragment(Y_FRAGMENT_NAME).insert(1, [p2])
    const u2 = encodeDocState(doc2)

    const merged = mergeUpdates([u1, u2])
    const doc3 = loadMerged(merged)
    const texts: string[] = []
    doc3.getXmlFragment(Y_FRAGMENT_NAME).forEach((child) => {
      child.forEach((c) => {
        if (c instanceof Y.XmlText) texts.push(c.toString())
      })
    })
    expect(texts.join(' ')).toContain('hello')
    expect(texts.join(' ')).toContain('world')
  })

  test('stateVectorFromUpdate + diffUpdate 桥接（update ≠ SV 编码）', () => {
    const doc = docWithParagraph('hello')
    const state1 = encodeDocState(doc)
    const sv1 = stateVectorFromUpdate(state1)

    const p2 = new Y.XmlElement('paragraph')
    const t2 = new Y.XmlText()
    t2.insert(0, 'world')
    p2.insert(0, [t2])
    doc.getXmlFragment(Y_FRAGMENT_NAME).insert(1, [p2])
    const state2 = encodeDocState(doc)

    const missing = diffUpdate(state2, sv1)
    // 客户端（sv1）拉到的差异应包含新内容
    const client = new Y.Doc()
    Y.applyUpdate(client, state1)
    Y.applyUpdate(client, missing)
    const texts: string[] = []
    client.getXmlFragment(Y_FRAGMENT_NAME).forEach((child) => {
      child.forEach((c) => {
        if (c instanceof Y.XmlText) texts.push(c.toString())
      })
    })
    expect(texts.join(' ')).toContain('world')
  })

  test('buildPageState：快照+增量等价全量', () => {
    const doc = docWithParagraph('one')
    const snapshot = encodeDocState(doc)
    const p = new Y.XmlElement('paragraph')
    const t = new Y.XmlText()
    t.insert(0, 'two')
    p.insert(0, [t])
    doc.getXmlFragment(Y_FRAGMENT_NAME).insert(1, [p])
    const delta = Y.encodeStateAsUpdate(doc, stateVectorFromUpdate(snapshot))

    const state = buildPageState(snapshot, [delta])
    const meta = extractPageMeta(state)
    expect(meta.text).toContain('one')
    expect(meta.text).toContain('two')
  })

  test('base64 编解码往返', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })
})

function loadMerged(update: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  return doc
}

describe('extractPageMeta', () => {
  test('提取文本与 subpageIds（文档序）', () => {
    const doc = docWithParagraph('第一段')
    const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
    const sub = new Y.XmlElement(NODE_SUBPAGE)
    sub.setAttribute(SUBPAGE_ATTR.pageId, '01800000-0000-7000-8000-000000000001')
    sub.setAttribute(SUBPAGE_ATTR.title, '子页')
    fragment.insert(1, [sub])
    const meta = extractPageMeta(doc)
    expect(meta.text).toContain('第一段')
    expect(meta.subpageIds).toEqual(['01800000-0000-7000-8000-000000000001'])
  })

  test('重复子页引用只取第一个', () => {
    const doc = docWithParagraph('x')
    const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
    for (let i = 0; i < 2; i++) {
      const sub = new Y.XmlElement(NODE_SUBPAGE)
      sub.setAttribute(SUBPAGE_ATTR.pageId, 'dup-id')
      fragment.insert(fragment.length, [sub])
    }
    expect(extractPageMeta(doc).subpageIds).toEqual(['dup-id'])
  })
})

describe('quick-start / subpage 构建器', () => {
  test('快速开始页可提取出非空文本（zh-CN 与 en）', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      const meta = extractPageMeta(buildQuickStartState(locale))
      expect(meta.text.length).toBeGreaterThan(50)
      expect(meta.subpageIds).toEqual([])
    }
  })

  test('appendSubpageNode：从已有状态追加并可再提取', () => {
    const base = buildQuickStartState('zh-CN')
    const { update, meta } = appendSubpageNode(base, '01800000-0000-7000-8000-000000000009', '新子页')
    expect(meta.subpageIds).toEqual(['01800000-0000-7000-8000-000000000009'])
    expect(meta.text.length).toBeGreaterThan(50)

    // 在 update 基础上再追加（幂等链式）
    const again = appendSubpageNode(update, '01800000-0000-7000-8000-00000000000a', '第二子页')
    expect(again.meta.subpageIds).toEqual([
      '01800000-0000-7000-8000-000000000009',
      '01800000-0000-7000-8000-00000000000a',
    ])
  })
})
