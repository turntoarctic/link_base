/**
 * Markdown 粘贴扩展（05 §2.1/§6）：剪贴板 text/markdown → 解析为 ProseMirror JSON 插入。
 * 采用 05 §1 的兜底路线：marked 词法分析 + 自研 token → PM JSON 映射（受限子集：
 * 标题/列表/任务/引用/代码块/表格/分割线/行内标记/图片）；
 * Markdown 输入规则由 starter-kit 提供；导出与导入走服务端链路（05 §7，P1）。
 */
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { marked, type Token, type Tokens } from 'marked'

type PMJson = Record<string, unknown>

const textNode = (text: string, marks?: PMJson[]): PMJson => {
  const node: PMJson = { type: 'text', text }
  if (marks?.length) node.marks = marks
  return node
}

/** 行内 token → PM inline JSON */
function inlineTokens(tokens: Token[] | undefined): PMJson[] {
  if (!tokens) return []
  const out: PMJson[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const t = token as Tokens.Text
        if (t.tokens?.length) {
          // text 嵌套（md 内罕见，如带标记的折行）
          out.push(...inlineTokens(t.tokens))
        } else {
          out.push(textNode((t as { text: string }).text ?? ''))
        }
        break
      }
      case 'escape':
        out.push(textNode((token as Tokens.Escape).text))
        break
      case 'strong':
        out.push(...inlineTokens((token as Tokens.Strong).tokens).map((n) => wrapMark(n, { type: 'bold' })))
        break
      case 'em':
        out.push(...inlineTokens((token as Tokens.Em).tokens).map((n) => wrapMark(n, { type: 'italic' })))
        break
      case 'del':
        out.push(...inlineTokens((token as Tokens.Del).tokens).map((n) => wrapMark(n, { type: 'strike' })))
        break
      case 'codespan':
        out.push(textNode((token as Tokens.Codespan).text, [{ type: 'code' }]))
        break
      case 'link': {
        const link = token as Tokens.Link
        out.push(
          ...inlineTokens(link.tokens).map((n) =>
            wrapMark(n, { type: 'link', attrs: { href: link.href, target: '_blank' } }),
          ),
        )
        break
      }
      case 'image': {
        const image = token as Tokens.Image
        out.push({ type: 'image', attrs: { src: image.href, alt: image.text ?? null } })
        break
      }
      case 'br':
        out.push({ type: 'hardBreak' })
        break
      default:
        break
    }
  }
  return out.length ? out : [textNode('')]
}

function wrapMark(node: PMJson, mark: PMJson): PMJson {
  return { ...node, marks: [...((node.marks as PMJson[] | undefined) ?? []), mark] }
}

/** 块级 token → PM block JSON 数组 */
function blockTokens(tokens: Token[]): PMJson[] {
  const out: PMJson[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const h = token as Tokens.Heading
        out.push({
          type: 'heading',
          attrs: { level: Math.min(h.depth, 6) },
          content: inlineTokens(h.tokens),
        })
        break
      }
      case 'paragraph':
        out.push({ type: 'paragraph', content: inlineTokens((token as Tokens.Paragraph).tokens) })
        break
      case 'code': {
        const code = token as Tokens.Code
        out.push({
          type: 'codeBlock',
          attrs: { language: code.lang || 'plaintext' },
          content: [textNode(code.text)],
        })
        break
      }
      case 'blockquote':
        out.push({ type: 'blockquote', content: blockTokens((token as Tokens.Blockquote).tokens) })
        break
      case 'hr':
        out.push({ type: 'horizontalRule' })
        break
      case 'list': {
        const list = token as Tokens.List
        const items: PMJson[] = list.items.map((item) => {
          if (item.task) {
            return {
              type: 'taskItem',
              attrs: { checked: item.checked ?? false },
              content: blockTokens(item.tokens).map((b) =>
                b.type === 'paragraph' ? b : { type: 'paragraph', content: [b] },
              ),
            }
          }
          return { type: 'listItem', content: blockTokens(item.tokens) }
        })
        out.push({
          type: list.ordered ? 'orderedList' : 'bulletList',
          ...(list.ordered ? { attrs: { start: list.start ?? 1 } } : {}),
          content: items,
        })
        break
      }
      case 'table': {
        const table = token as Tokens.Table
        const rows: PMJson[] = []
        const mapRow = (cells: Token[], header: boolean): PMJson => ({
          type: 'tableRow',
          content: cells.map((cell) => ({
            type: header ? 'tableHeader' : 'tableCell',
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [{ type: 'paragraph', content: cellInline(cell) }],
          })),
        })
        // marked：header 是一行单元格数组，rows 是二维（每行 = 单元格数组）
        const tableLike = table as unknown as { header: Token[]; rows: Token[][] }
        if (tableLike.header) rows.push(mapRow(tableLike.header, true))
        for (const row of tableLike.rows ?? []) rows.push(mapRow(row, false))
        out.push({ type: 'table', content: rows })
        break
      }
      case 'html':
      case 'space':
      default:
        break
    }
  }
  return out
}

/** marked 的表格单元格是带 inline tokens 的 text 形 token */
function cellInline(cell: Token): PMJson[] {
  const t = cell as Tokens.Text
  if (t.tokens?.length) return inlineTokens(t.tokens)
  return [textNode(String((cell as { text?: string }).text ?? ''))]
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text.includes('\n')) return false
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|.*\|)|\[[ xX]?\]/.test(text)
}

/** Markdown 文本 → ProseMirror 块级 JSON（受限子集） */
export function markdownToPmJson(text: string): PMJson[] {
  const tokens = marked.lexer(text)
  return blockTokens(tokens)
}

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const clipboard = event.clipboardData
            if (!clipboard) return false
            if (clipboard.types.includes('text/html')) return false // 富文本粘贴走默认路径
            const text = clipboard.getData('text/plain')
            if (!text || !looksLikeMarkdown(text)) return false
            const content = markdownToPmJson(text)
            if (content.length === 0) return false
            event.preventDefault()
            this.editor
              .chain()
              .focus()
              .insertContentAt(view.state.selection.from, content)
              .run()
            return true
          },
        },
      }),
    ]
  },
})
