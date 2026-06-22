import styles from './MessageList.module.css'

interface Props {
  output: string
  error: string
}

export default function MessageList({ output, error }: Props) {
  return (
    <div className={styles.container}>
      {error && <pre className={styles.error}>{error}</pre>}
      <pre className={styles.output}>{output}</pre>
    </div>
  )
}