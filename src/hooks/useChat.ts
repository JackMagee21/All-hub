import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Message, Usage, RemoteModel, inputRatePerM, outputRatePerM } from '../types'
import { trimHistory } from '../lib/trimHistory'
import { AppSettings } from './useSettings'

interface ChatOptions {
  apiKey: string
  modelId: string
  selectedModel: RemoteModel | null
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  totalCost: number
  totalTokens: number
  settings: AppSettings
  onCostsUpdate: (cost: number, tokens: number) => void
  onPersist: (msgs: Message[], cost: number, tokens: number) => Promise<void>
}

export function useChat({
  apiKey,
  modelId,
  selectedModel,
  messages,
  setMessages,
  totalCost,
  totalTokens,
  settings,
  onCostsUpdate,
  onPersist,
}: ChatOptions) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUsage, setLastUsage] = useState<Usage | null>(null)
  const [trimmedCount, setTrimmedCount] = useState(0)
  const [error, setError] = useState('')
  const unlistenTokenRef = useRef<(() => void) | null>(null)
  const unlistenDoneRef = useRef<(() => void) | null>(null)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => { messagesRef.current = messages }, [messages])

  async function send() {
    if (!input.trim() || isStreaming) return
    setError('')
    setIsStreaming(true)
    setLastUsage(null)
    setTrimmedCount(0)

    unlistenTokenRef.current?.()
    unlistenDoneRef.current?.()

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')

    const { messages: trimmed, trimmed: trimCount } = trimHistory(
      [...messages, userMsg],
      selectedModel?.contextLength,
      settings.trimBudget,
    )
    setTrimmedCount(trimCount)

    await onPersist([...messages, userMsg], totalCost, totalTokens)

    try {
      unlistenTokenRef.current = await listen<string>('chat-token', (e) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + e.payload }
          return updated
        })
      })

      unlistenDoneRef.current = await listen<Usage | null>('chat-done', async (e) => {
        unlistenTokenRef.current?.()
        unlistenDoneRef.current?.()
        unlistenTokenRef.current = null
        unlistenDoneRef.current = null
        setIsStreaming(false)

        if (e.payload) {
          setLastUsage(e.payload)
          const turnCost = selectedModel
            ? (e.payload.prompt_tokens / 1_000_000) * inputRatePerM(selectedModel) +
              (e.payload.completion_tokens / 1_000_000) * outputRatePerM(selectedModel)
            : 0
          const turnTokens = e.payload.prompt_tokens + e.payload.completion_tokens
          const newCost = totalCost + turnCost
          const newTokens = totalTokens + turnTokens
          onCostsUpdate(newCost, newTokens)
          await onPersist(messagesRef.current, newCost, newTokens)
        }
      })

      await invoke('chat', {
        modelId,
        messages: trimmed.map(m => ({ role: m.role, content: m.content })),
        apiKey,
        maxTokens: settings.maxTokens,
      })
    } catch (e) {
      setError(String(e))
      unlistenTokenRef.current?.()
      unlistenDoneRef.current?.()
      unlistenTokenRef.current = null
      unlistenDoneRef.current = null
      setIsStreaming(false)
    }
  }

  return { input, setInput, send, isStreaming, lastUsage, trimmedCount, error }
}