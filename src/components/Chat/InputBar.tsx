import { useRef, useEffect } from 'react'
import styles from './InputBar.module.css'

interface Props {
  input: string
  onInputChange: (val: string) => void
  onSend: () => void
  disabled?: boolean
}

export default function InputBar({ input, onInputChange, onSend, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [input])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const canSend = input.trim().length > 0 && !disabled

  return (
    <div className={styles.container}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={input}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message AI Hub..."
        rows={1}
        disabled={disabled}
      />
      <button
        className={styles.sendBtn}
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 13V3M3 8l5-5 5 5" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}