import { Conversation } from '../../types'
import styles from './ConversationList.module.css'

interface Props {
  conversations: Conversation[]
  activeId: string
  onSelect: (conv: Conversation) => void
  onDelete: (id: string) => void
}

function groupByDate(conversations: Conversation[]): [string, Conversation[]][] {
  const today = new Date().setHours(0, 0, 0, 0)
  const yesterday = today - 86_400_000
  const lastWeek = today - 7 * 86_400_000

  const groups: Record<string, Conversation[]> = {
    'Today': [],
    'Yesterday': [],
    'Last 7 days': [],
    'Older': [],
  }

  for (const conv of conversations) {
    if (conv.updatedAt >= today) groups['Today'].push(conv)
    else if (conv.updatedAt >= yesterday) groups['Yesterday'].push(conv)
    else if (conv.updatedAt >= lastWeek) groups['Last 7 days'].push(conv)
    else groups['Older'].push(conv)
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

export default function ConversationList({ conversations, activeId, onSelect, onDelete }: Props) {
  const groups = groupByDate(conversations)

  if (conversations.length === 0) {
    return <p className={styles.empty}>No conversations yet</p>
  }

  return (
    <div className={styles.list}>
      {groups.map(([label, items]) => (
        <div key={label} className={styles.group}>
          <div className={styles.groupLabel}>{label}</div>
          {items.map(conv => (
            <div
              key={conv.id}
              className={`${styles.item} ${conv.id === activeId ? styles.active : ''}`}
              onClick={() => onSelect(conv)}
            >
              <span className={styles.title}>{conv.title}</span>
              <button
                className={styles.deleteBtn}
                onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
                aria-label="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}