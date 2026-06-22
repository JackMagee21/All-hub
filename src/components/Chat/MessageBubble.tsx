import styles from './MessageBubble.module.css'
import MarkdownContent from './MarkdownContent'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      <span className={styles.dot} />
      <span className={`${styles.dot} ${styles.dot2}`} />
      <span className={`${styles.dot} ${styles.dot3}`} />
    </span>
  )
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      {!isUser && <div className={styles.avatar}>A</div>}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        {isUser
          ? message.content
          : message.content
            ? <MarkdownContent content={message.content} />
            : <TypingDots />
        }
      </div>
    </div>
  )
}