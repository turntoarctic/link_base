/**
 * 把手块菜单（Notion 化 T2）：点击 ⠿ 弹出——转为（二级面板）/复制/删除/上移/下移。
 * 打开前先 selectBlockByIndex 把选区对齐目标块，命令全部作用于该块；动作后关闭。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronRight, Copy, Trash } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { openPopover, type PopoverHandle } from './popover.ts'
import { openTurnIntoMenu, TurnIntoMenuContent } from './turn-into-menu.tsx'

type View = 'main' | 'turnInto'

function BlockMenuContent({
  editor,
  blockIndex,
  handle,
}: {
  editor: Editor
  blockIndex: number
  handle: PopoverHandle
}) {
  const { t } = useTranslation('editor')
  const [view, setView] = useState<View>('main')

  if (view === 'turnInto') {
    return <TurnIntoMenuContent editor={editor} onPick={() => handle.close()} />
  }

  const run = (fn: () => unknown) => {
    fn()
    handle.close()
  }

  const items = [
    {
      id: 'turnInto',
      icon: <ChevronRight size={16} />,
      label: t('blockMenu.turnInto'),
      submenu: true,
      run: () => setView('turnInto'),
    },
    { id: 'duplicate', icon: <Copy size={16} />, label: t('blockMenu.duplicate'), run: () => run(() => editor.commands.duplicateBlock()) },
    { id: 'delete', icon: <Trash size={16} />, label: t('blockMenu.delete'), danger: true, run: () => run(() => editor.commands.deleteBlock()) },
    { id: 'moveUp', icon: <ArrowUp size={16} />, label: t('blockMenu.moveUp'), run: () => run(() => editor.commands.moveBlockUp()) },
    { id: 'moveDown', icon: <ArrowDown size={16} />, label: t('blockMenu.moveDown'), run: () => run(() => editor.commands.moveBlockDown()) },
  ]

  return (
    <div className="linkbase-menu" role="menu" aria-label={t('blockMenu.title')}>
      <div className="linkbase-menu-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`linkbase-menu-item${item.danger ? ' linkbase-menu-item-danger' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              item.run()
            }}
          >
            <span className="linkbase-menu-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 在把手处打开块菜单。先按 selectBlockByIndex 对齐选区（失败 = 块已不存在，不弹）。
 * anchor 传把手元素；reopenTurnInto 供二级面板返回主面板时保持锚点（暂不实现返回，先直开）。
 */
export function openBlockMenu(editor: Editor, anchor: HTMLElement, blockIndex: number): PopoverHandle | null {
  if (!editor.commands.selectBlockByIndex(blockIndex)) return null
  return openPopover({
    anchor,
    placement: 'bottom-start',
    onKeyDown: (event, handle) => {
      if (event.key === 'Escape') {
        handle.close()
        return true
      }
      return false
    },
    render: (handle) => <BlockMenuContent editor={editor} blockIndex={blockIndex} handle={handle} />,
  })
}

// openTurnIntoMenu 供气泡工具条导入（此处再导出保持单一来源）
export { openTurnIntoMenu }
