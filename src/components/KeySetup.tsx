import { useState } from 'react'
import styles from './KeySetup.module.css'

interface Props {
  onSave: (key: string) => void
}

export default function KeySetup({ onSave }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed.startsWith('sk-or-')) {
      setError('Key should start with sk-or-')
      return
    }
    onSave(trimmed)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.icon}>🔑</div>
        <h2 className={styles.title}>Add your OpenRouter key</h2>
        <p className={styles.description}>
          Your key is stored in the Windows Credential Manager — never written to disk or sent anywhere except OpenRouter.
        </p>
        <input
          className={styles.input}
          type="password"
          placeholder="sk-or-..."
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} onClick={handleSave}>
          Save key
        </button>
        <a
          className={styles.link}
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
        >
          Get a key at openrouter.ai →
        </a>
      </div>
    </div>
  )
}