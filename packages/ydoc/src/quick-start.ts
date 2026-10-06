/**
 * 种子内容构建器：快速开始页（02 §3，注册自动创建）。
 * 直接用 yjs 类型构造（XmlElement 属性保持原始类型），与 y-prosemirror 的
 * XmlFragment 映射约定一致（节点名 = PM 节点名，元素属性 = PM attrs），
 * 编辑器打开时经 Collaboration 扩展正常回放。种子内容不使用行内标记（marks），
 * 避免触碰 y-prosemirror 的 mark 属性约定。
 */
import * as Y from 'yjs'
import { CALLOUT_ATTR, NODE_CALLOUT, Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import { encodeDocState } from './updates.ts'

export type Locale = 'zh-CN' | 'en'

type Child = Y.XmlElement | Y.XmlText

const el = (name: string, attrs?: Record<string, unknown>, children: Child[] = []): Y.XmlElement => {
  const node = new Y.XmlElement(name)
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      // yjs 运行时接受任意属性值（level/checked 为 number/boolean），类型按 string 声明
      node.setAttribute(key, value as string)
    }
  }
  // 显式下标写入：未挂载到文档的 Y 类型禁止任何读取（含 .length），否则 yjs 会告警
  for (let i = 0; i < children.length; i++) node.insert(i, [children[i]!])
  return node
}

const text = (value: string): Y.XmlText => {
  const node = new Y.XmlText()
  node.insert(0, value)
  return node
}

const para = (value: string): Y.XmlElement => el('paragraph', undefined, [text(value)])
const heading = (level: number, value: string): Y.XmlElement =>
  el('heading', { level }, [text(value)])
const bulletItem = (value: string): Y.XmlElement =>
  el('listItem', undefined, [para(value)])
const taskItem = (checked: boolean, value: string): Y.XmlElement =>
  el('taskItem', { checked }, [para(value)])

const QUICK_START: Record<Locale, () => Y.XmlElement[]> = {
  'zh-CN': () => [
    para('这是一篇可以随便改的引导页：试试点击任意位置开始输入，或者按 / 唤起命令菜单。'),
    heading(2, '你可以做什么'),
    el('bulletList', undefined, [
      bulletItem('写作：段落、标题、列表、待办、引用、代码块（支持语言高亮）'),
      bulletItem('组织：页面内插入子页面，形成页面树；侧边栏可拖拽排序'),
      bulletItem('协作：内容自动多端同步，断网也能继续写，恢复后自动补推'),
    ]),
    heading(2, '试试这些'),
    el('taskList', undefined, [
      taskItem(true, '在这个页面上输入 / 看看命令菜单'),
      taskItem(false, '选中一段文字，用浮动工具条加粗或高亮'),
      taskItem(false, '在侧边栏新建一个子页面'),
    ]),
    el('blockquote', undefined, [para('提示：所有内容实时保存在本地，随后台同步到服务端，不用担心丢失。')]),
    heading(2, '一小段代码'),
    el('codeBlock', { language: 'ts' }, [
      text('export function hello(name: string): string {\n  return `Hello, ${name}!`\n}'),
    ]),
    el(NODE_CALLOUT, { [CALLOUT_ATTR.icon]: '💡', [CALLOUT_ATTR.color]: 'gray' }, [
      para('点击左侧图标可以换一个 emoji。用 Callout 放注意事项再合适不过。'),
    ]),
    el('horizontalRule'),
    para('删除本页任意内容，或从侧边栏新建页面开始你自己的文档。'),
  ],
  en: () => [
    para('This is a scratch guide page: click anywhere to start typing, or press / to open the command menu.'),
    heading(2, 'What you can do'),
    el('bulletList', undefined, [
      bulletItem('Write: paragraphs, headings, lists, todos, quotes and highlighted code blocks'),
      bulletItem('Organize: insert subpages to grow a page tree; drag to reorder in the sidebar'),
      bulletItem('Collaborate: content syncs across devices; keep writing offline, auto-push on recovery'),
    ]),
    heading(2, 'Try this'),
    el('taskList', undefined, [
      taskItem(true, 'Type / on this page to open the command menu'),
      taskItem(false, 'Select some text and bold or highlight it with the floating toolbar'),
      taskItem(false, 'Create a subpage from the sidebar'),
    ]),
    el('blockquote', undefined, [para('Tip: everything is saved locally in real time and synced in the background — nothing gets lost.')]),
    heading(2, 'A tiny snippet'),
    el('codeBlock', { language: 'ts' }, [
      text('export function hello(name: string): string {\n  return `Hello, ${name}!`\n}'),
    ]),
    el(NODE_CALLOUT, { [CALLOUT_ATTR.icon]: '💡', [CALLOUT_ATTR.color]: 'gray' }, [
      para('Click the icon on the left to swap the emoji. Callouts are great for caveats.'),
    ]),
    el('horizontalRule'),
    para('Edit anything here, or create a new page from the sidebar to start your own.'),
  ],
}

/** 快速开始页初始内容（state update 形态，直接入库为首个快照，08 §4.4 同款） */
export function buildQuickStartState(locale: Locale = 'zh-CN'): Uint8Array {
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment(Y_FRAGMENT_NAME)
  const children = QUICK_START[locale]()
  fragment.insert(0, children)
  return encodeDocState(doc)
}
