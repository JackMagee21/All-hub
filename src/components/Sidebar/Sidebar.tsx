import { Conversation } from '../../types'
import ConversationList from './ConversationList'
import styles from './Sidebar.module.css'

interface Props {
  conversations: Conversation[]
  activeId: string
  onSelect: (conv: Conversation) => void
  onNew: () => void
  onDelete: (id: string) => void
  onFavorite: (id: string) => void
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onFavorite }: Props) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.logo}>AI Hub</span>
        <button className={styles.newBtn} onClick={onNew} aria-label="New conversation">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelect}
        onDelete={onDelete}
        onFavorite={onFavorite}
      />
    </div>
  )
}