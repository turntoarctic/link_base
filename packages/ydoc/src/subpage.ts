/**
 * 服务端子页面附加（02 §1.2 / 08 §5）：在父页内容末尾追加 subpage 节点，
 * 返回父页新 update 与提取结果。建子页（POST /pages 带 parentId）时使用，
 * 保证 parent_id 派生缓存与内容真相一致。
 */
import * as Y from 'yjs'
import { NODE_SUBPAGE, SUBPAGE_ATTR, Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import { encodeDocState } from './updates.ts'
import { extractPageMeta, type PageMeta } from './extract.ts'

export function appendSubpageNode(
  parentState: Uint8Array | null,
  pageId: string,
  title: string,
): { update: Uint8Array; meta: PageMeta } {
  const doc = new Y.Doc()
  if (parentState) Y.applyUpdate(doc, parentState)
  const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
  const node = new Y.XmlElement(NODE_SUBPAGE)
  node.setAttribute(SUBPAGE_ATTR.pageId, pageId)
  node.setAttribute(SUBPAGE_ATTR.title, title)
  fragment.insert(fragment.length, [node])
  const update = encodeDocState(doc)
  return { update, meta: extractPageMeta(doc) }
}
