import { countTokens } from './tokeniser'

interface TrimmableMessage {
  role: string
  content: string
}

const OVERHEAD_PER_MESSAGE = 4  // tokens added per message by the API format
const BUDGET_FRACTION = 0.5     // use 50% of context window for history

export interface TrimResult<T> {
  messages: T[]
  trimmed: number  // how many messages were removed
}

export function trimHistory<T extends TrimmableMessage>(
  messages: T[],
  contextWindow: number | undefined,
): TrimResult<T> {
  // If context window is unknown, don't trim
  if (!contextWindow) {
    return { messages, trimmed: 0 }
  }

  const maxTokens = Math.floor(contextWindow * BUDGET_FRACTION)

  // Pre-calculate token counts
  const tokenCounts = messages.map(m =>
    countTokens(m.content) + OVERHEAD_PER_MESSAGE
  )

  const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0)

  // Already within budget
  if (totalTokens <= maxTokens) {
    return { messages, trimmed: 0 }
  }

  // Work backwards from most recent, keeping messages that fit
  let tokenCount = 0
  const kept: T[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = tokenCounts[i]

    // Always keep at least the last message
    if (tokenCount + tokens > maxTokens && kept.length > 0) break

    kept.unshift(messages[i])
    tokenCount += tokens
  }

  return {
    messages: kept,
    trimmed: messages.length - kept.length,
  }
}