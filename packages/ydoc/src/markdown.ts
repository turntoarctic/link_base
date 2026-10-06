/**
 * Markdown 双向转换（05 §7 / §9，T2.5，服务端安全：零 DOM）。
 * 导入：md → marked 词法 → Y.XmlElement 树（纯 yjs，与 quick-start 构建同构，无需 PM schema）。
 * 导出：yDocToProseMirrorJSON 的 doc JSON → Markdown（GFM：表格/任务列表/代码块/删除线）。
 * 往返边界：callout/subpage 不参与（MD 无对应结构；callout 导出降级为 blockquote）。
 */
import * as Y from 'yjs'
import { marked, type Token, type Tokens } from 'marked'
import { Y_FRAGMENT_NAME } from '@linkbase/editor/server'

type El = Y.XmlElement<any>
type MarkAttrs = Record<string, Record<string, unknown>>

/** 宽松类型的元素构造（Y 默认泛型把 attr 值限成 string，这里统一 any 化） */
function el(name: string, attrs?: Record<string, unknown>): El {
  const e = new Y.XmlElement(name) as unknown as El
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v as never)
  }
  return e
}

function txt(str?: string): Y.XmlText {
  const t = new Y.XmlText()
  if (str) t.insert(0, str)
  return t
}

/** 补充 7 教训：未挂载 Y 类型禁止一切读取——文本段先累积，再按运行偏移插入 */
type Seg = { str: string; attrs?: MarkAttrs }

function emitInline(tokens: Token[] | undefined, segs: Seg[], blocks: El[], base: MarkAttrs): void {
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'text': {
        const t = token as Tokens.Text
        if (t.tokens?.length) emitInline(t.tokens, segs, blocks, base)
        else {
          const str = (t as { text: string }).text ?? ''
          // Yjs 陷阱：无属性文本插入到格式化段末尾会被继承合并，必须显式传 {}
          if (str) segs.push({ str, attrs: base })
        }
        break
      }
      case 'escape': {
        const str = (token as Tokens.Escape).text
        if (str) segs.push({ str, attrs: base })
        break
      }
      case 'strong':
        emitInline((token as Tokens.Strong).tokens, segs, blocks, { ...base, bold: {} })
        break
      case 'em':
        emitInline((token as Tokens.Em).tokens, segs, blocks, { ...base, italic: {} })
        break
      case 'del':
        emitInline((token as Tokens.Del).tokens, segs, blocks, { ...base, strike: {} })
        break
      case 'codespan': {
        const str = (token as Tokens.Codespan).text
        if (str) segs.push({ str, attrs: { ...base, code: {} } })
        break
      }
      case 'link': {
        const link = token as Tokens.Link
        emitInline(link.tokens, segs, blocks, {
          ...base,
          link: { href: link.href, target: '_blank', rel: 'noopener noreferrer nofollow' },
        })
        break
      }
      case 'br':
        blocks.push(el('hardBreak'))
        break
      case 'image':
        blocks.push(el('image', { src: (token as Tokens.Image).href, alt: (token as Tokens.Image).text ?? null }))
        break
      case 'html':
      case 'space':
      default:
        break
    }
  }
}

/** inline tokens → 段落（图片等块级节点拆为兄弟块）；XmlText 一次性构建后插入 */
function inlineBlock(tokens: Token[]): El[] {
  const segs: Seg[] = []
  const blocks: El[] = []
  emitInline(tokens, segs, blocks, {})
  const text = new Y.XmlText()
  let off = 0
  for (const seg of segs) {
    // 属性必须显式传（空对象 = 无 mark），否则 Yjs 会继承前一格式化段
    text.insert(off, seg.str, seg.attrs ?? {})
    off += seg.str.length
  }
  const p = el('paragraph')
  const children: (El | Y.XmlText)[] = [text, ...blocks]
  p.insert(0, children)
  return [p]
}

/** 块级 tokens → Y.XmlElement 数组 */
function blocksToElements(tokens: Token[]): El[] {
  const out: El[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const h = token as Tokens.Heading
        const segs: Seg[] = []
        emitInline(h.tokens, segs, [], {})
        const heading = el('heading', { level: Math.min(h.depth, 6) })
        heading.insert(0, [txt(segs.map((s2) => s2.str).join(''))])
        out.push(heading)
        break
      }
      case 'paragraph':
        out.push(...inlineBlock((token as Tokens.Paragraph).tokens))
        break
      case 'text':
        // 列表项/表格单元格正文是裸 text token
        out.push(...inlineBlock([token]))
        break
      case 'code': {
        const code = token as Tokens.Code
        const codeEl = el('codeBlock', { language: code.lang || 'plaintext' })
        codeEl.insert(0, [txt(code.text)])
        out.push(codeEl)
        break
      }
      case 'blockquote': {
        const quote = el('blockquote')
        quote.insert(0, blocksToElements((token as Tokens.Blockquote).tokens))
        out.push(quote)
        break
      }
      case 'hr':
        out.push(el('horizontalRule'))
        break
      case 'list': {
        const list = token as Tokens.List
        const isTask = list.items.some((i) => i.task)
        const listEl = el(
          isTask ? 'taskList' : list.ordered ? 'orderedList' : 'bulletList',
          list.ordered ? { start: list.start ?? 1 } : undefined,
        )
        for (const item of list.items) {
          const itemEl = el(isTask ? 'taskItem' : 'listItem', isTask ? { checked: item.checked ?? false } : undefined)
          itemEl.insert(0, blocksToElements(item.tokens))
          listEl.insert(listEl.length, [itemEl])
        }
        out.push(listEl)
        break
      }
      case 'table': {
        const table = token as Tokens.Table
        const like = table as unknown as { header: Token[]; rows: Token[][] }
        const tableEl = el('table')
        const mapRow = (cells: Token[], header: boolean): El => {
          const row = el('tableRow')
          const rowChildren: El[] = []
          for (const cell of cells) {
            const cellEl = el(header ? 'tableHeader' : 'tableCell')
            // marked 的表格单元格 token 无 type 字段，显式包成 text token
            const cellToken = {
              type: 'text',
              text: String((cell as { text?: string }).text ?? ''),
              tokens: ((cell as { tokens?: Token[] }).tokens ?? []) as Token[],
            } as unknown as Token
            cellEl.insert(0, inlineBlock([cellToken]))
            rowChildren.push(cellEl)
          }
          row.insert(0, rowChildren)
          return row
        }
        const tableChildren: El[] = []
        if (like.header) tableChildren.push(mapRow(like.header, true))
        for (const row of like.rows ?? []) tableChildren.push(mapRow(row, false))
        tableEl.insert(0, tableChildren)
        out.push(tableEl)
        break
      }
      case 'space':
      case 'html':
      default:
        break
    }
  }
  return out
}

/** md → Y.Doc（fragment 'default'；导入建页与基准数据同构） */
export function markdownToYDoc(markdown: string): Y.Doc {
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
  fragment.insert(0, blocksToElements(marked.lexer(markdown)))
  return doc
}

/* ------------------------------- 导出：Y 类型树 → md ------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
type YNode = any

/** inline delta → md（marks 包裹，code 内不嵌套） */
function deltaToMarkdown(delta: Array<{ insert: unknown; attributes?: MarkAttrs }>): string {
  let out = ''
  for (const seg of delta) {
    if (typeof seg.insert !== 'string') {
      // 段内块级（极少）：忽略或作为空格
      out += ' '
      continue
    }
    let text = seg.insert
    const marks = seg.attributes ?? {}
    if (marks.link) {
      const href = String((marks.link as { href?: unknown }).href ?? '')
      out += `[${text}](${href})`
      continue
    }
    if (marks.code) text = `\`${text}\``
    if (marks.bold) text = `**${text}**`
    if (marks.italic) text = `*${text}*`
    if (marks.strike) text = `~~${text}~~`
    out += text
  }
  return out
}

function isText(node: YNode): boolean {
  return node instanceof Y.XmlText
}

/** 单个块节点 → md 行（indent 用于列表嵌套/引用） */
function blockToMarkdown(node: YNode, indent: string): string[] {
  const name: string = node.nodeName

  const inlineOf = (node: any): string => {
    if (isText(node)) return deltaToMarkdown(node.toDelta() as never)
    return (node.toArray() as any[])
      .map((c) => (isText(c) ? deltaToMarkdown(c.toDelta() as never) : blockToMarkdown(c, indent).join(' ')))
      .join('')
  }
  switch (name) {
    case 'heading':
      return [`${indent}${'#'.repeat(Number(node.getAttribute('level') ?? 1))} ${inlineOf(node)}`]
    case 'paragraph':
      return [indent + inlineOf(node)]
    case 'codeBlock': {
      const text = node.toArray().map((c: any) => (isText(c) ? c.toString() : '')).join('')
      return [`${indent}\`\`\`${String(node.getAttribute('language') ?? 'plaintext')}\n${text}${text.endsWith('\n') ? '' : '\n'}${indent}\`\`\``]
    }
    case 'blockquote': {
      const inner = node.toArray().flatMap((c: any) => blockToMarkdown(c, `${indent}> `))
      return inner.map((l: string) => (l.startsWith(`${indent}> `) ? l : `${indent}> ${l}`.trimEnd()))
    }
    case 'bulletList':
    case 'taskList':
    case 'orderedList': {
      const ordered = name === 'orderedList'
      const task = name === 'taskList'
      const out: string[] = []
      let no = Number(node.getAttribute('start') ?? 1)
      node.toArray().forEach((item: any) => {
        const itemEl = item as El
        const innerLines = itemEl
          .toArray()
          .flatMap((c: any) => blockToMarkdown(c, `${indent}  `))
        const first = (innerLines[0] ?? '').trimStart()
        const marker = task
          ? `- [${itemEl.getAttribute('checked') ? 'x' : ' '}] `
          : ordered
            ? `${no++}. `
            : '- '
        out.push(`${indent}${marker}${first}`)
        out.push(...innerLines.slice(1))
      })
      return out
    }
    case 'horizontalRule':
      return [`${indent}---`]
    case 'table': {
      const rows = node.toArray()
      const lines: string[] = []
      rows.forEach((row: any, ri: number) => {
        const cells = row.toArray().map((cell: any) =>
          cell
            .toArray()
            .map((c: any) => (isText(c) ? deltaToMarkdown(c.toDelta() as never) : blockToMarkdown(c, '').join(' ')))
            .join(''),
        )
        lines.push(`${indent}| ${cells.join(' | ')} |`)
        if (ri === 0) lines.push(`${indent}|${cells.map(() => ' --- ').join('|')}|`)
      })
      return lines
    }
    case 'image':
      return [`${indent}![${String(node.getAttribute('alt') ?? '')}](${String(node.getAttribute('src') ?? '')})`]
    case 'attachment':
      return [
        `${indent}[📎 ${String(node.getAttribute('name') ?? 'attachment')}](/blobs/${String(node.getAttribute('blobId') ?? '')})`,
      ]
    case 'subpage': {
      const title = String(node.getAttribute('title') ?? '')
      return [`${indent}- [${title || '子页面'}](/page/${String(node.getAttribute('pageId') ?? '')})`]
    }
    case 'callout':
      return node.toArray().flatMap((c: any) =>
        blockToMarkdown(c, `${indent}> `).map((l: string) => (l.startsWith(`${indent}> `) ? l : `${indent}> ${l}`.trimEnd())),
      )
    default:
      return [indent + inlineOf(node)]
  }
}

/** Y fragment/element → Markdown（GFM） */
export function yToMarkdown(node: any): string {
  const lines: string[] = []
  if (isText(node)) {
    lines.push(deltaToMarkdown(node.toDelta() as never))
  } else {
    for (const child of node.toArray()) {
      lines.push(...blockToMarkdown(child, ''))
    }
  }
  return lines.join('\n\n')
}
