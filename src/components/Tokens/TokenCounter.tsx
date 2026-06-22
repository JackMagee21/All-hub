import styles from './TokenCounter.module.css'

interface Props {
  liveTokens: number
  promptTokens?: number
  completionTokens?: number
  cost?: number
}

export default function TokenCounter({ liveTokens, promptTokens, completionTokens, cost }: Props) {
  const hasUsage = promptTokens !== undefined && completionTokens !== undefined

  return (
    <div className={styles.bar}>
      <span className={styles.live}>
        {liveTokens > 0 ? `~${liveTokens} tokens` : ''}
      </span>
      {hasUsage && (
        <span className={styles.usage}>
          ↑ {promptTokens} · ↓ {completionTokens}
          {cost !== undefined && (
            <span className={styles.cost}> · ${cost.toFixed(5)}</span>
          )}
        </span>
      )}
    </div>
  )
}