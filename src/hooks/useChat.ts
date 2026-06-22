import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  Message,
  Usage,
  RemoteModel,
  ToolCall,
  PendingToolCall,
  inputRatePerM,
  outputRatePerM,
} from '../types'
import { trimHistory } from '../lib/trimHistory'
import { AppSettings } from './useSettings'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ApiMessage {
  role: string
  content: string | null
  tool_calls?: object[]
  tool_call_id?: string
}

// ─── System prompt injected when file tools are enabled ───────────────────────

const TOOLS_SYSTEM_MESSAGE: ApiMessage = {
  role: 'system',
  content: `You have access to file tools. Follow these rules strictly:

- When a user asks you to create, write, save, or produce any file — ALWAYS use the create_file tool. Never generate fake download links.
- Supported file types: .md, .txt, .py, .ts, .js, .tsx, .jsx, .rs, .go, .html, .css, .json, .toml, .yaml, .sh, .sql, and any plain text format.
- PDF is NOT supported. If a user asks for a PDF, create a .md file instead and explain why.
- Never say "here is a download link" or "click here to download" — only use the tool.
- Always use create_file even for short content. Never just show file contents in chat when a file was requested.
- Use descriptive filenames with the correct extension.`,
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

  // ── State ──────────────────────────────────────────────────────────────────

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUsage, setLastUsage] = useState<Usage | null>(null)
  const [trimmedCount, setTrimmedCount] = useState(0)
  const [error, setError] = useState('')
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>([])

  // ── Refs ───────────────────────────────────────────────────────────────────

  const unlistenTokenRef    = useRef<(() => void) | null>(null)
  const unlistenDoneRef     = useRef<(() => void) | null>(null)
  const unlistenToolsRef    = useRef<(() => void) | null>(null)
  const messagesRef         = useRef<Message[]>([])
  const apiMessagesRef      = useRef<ApiMessage[]>([])
  const hasPendingToolsRef  = useRef(false)
  const totalCostRef        = useRef(totalCost)
  const totalTokensRef      = useRef(totalTokens)

  // Keep refs current so event callbacks always read the latest values
  useEffect(() => { messagesRef.current    = messages    }, [messages])
  useEffect(() => { totalCostRef.current   = totalCost   }, [totalCost])
  useEffect(() => { totalTokensRef.current = totalTokens }, [totalTokens])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function cleanup() {
    unlistenTokenRef.current?.()
    unlistenDoneRef.current?.()
    unlistenToolsRef.current?.()
    unlistenTokenRef.current = null
    unlistenDoneRef.current  = null
    unlistenToolsRef.current = null
  }

  function parseToolArgs(args: string): Record<string, string> {
    try {
      return JSON.parse(args)
    } catch {
      return {}
    }
  }

  function calcTurnCost(usage: Usage): number {
    if (!selectedModel) return 0
    return (
      (usage.prompt_tokens     / 1_000_000) * inputRatePerM(selectedModel) +
      (usage.completion_tokens / 1_000_000) * outputRatePerM(selectedModel)
    )
  }

  function stripToFilename(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop() ?? path
  }

  function buildApiMessages(trimmedMessages: Message[]): ApiMessage[] {
    const base: ApiMessage[] = trimmedMessages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    return settings.toolsEnabled
      ? [TOOLS_SYSTEM_MESSAGE, ...base]
      : base
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async function send() {
    if (!input.trim() || isStreaming) return

    setError('')
    setIsStreaming(true)
    setLastUsage(null)
    setTrimmedCount(0)
    hasPendingToolsRef.current = false
    cleanup()

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')

    const { messages: trimmed, trimmed: trimCount } = trimHistory(
      [...messages, userMsg],
      selectedModel?.contextLength,
      settings.trimBudget,
    )
    setTrimmedCount(trimCount)

    const apiMessages = buildApiMessages(trimmed)
    apiMessagesRef.current = apiMessages

    await onPersist(
      [...messages, userMsg],
      totalCostRef.current,
      totalTokensRef.current,
    )

    await runChat(apiMessages, assistantMsg.id)
  }

  // ── Core streaming loop ────────────────────────────────────────────────────

  async function runChat(apiMessages: ApiMessage[], assistantMsgId: string) {
    try {

      // Stream tokens into the assistant message bubble
      unlistenTokenRef.current = await listen<string>('chat-token', (e) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: m.content + e.payload }
            : m
        ))
      })

      // Receive tool calls when the model wants to use a tool
      unlistenToolsRef.current = await listen<ToolCall[]>('chat-tool-calls', (e) => {
        console.log('[chat-tool-calls] received:', e.payload)
        hasPendingToolsRef.current = true

        const parsed: PendingToolCall[] = e.payload.map(tc => ({
          ...tc,
          parsedArgs: parseToolArgs(tc.arguments),
        }))
        setPendingToolCalls(parsed)

        // Append the assistant tool_calls turn to the API message history
        apiMessagesRef.current = [
          ...apiMessages,
          {
            role: 'assistant',
            content: null,
            tool_calls: e.payload.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          },
        ]
      })

      // Stream complete — finalise unless we are waiting on tool approval
      unlistenDoneRef.current = await listen<Usage | null>('chat-done', async (e) => {
        cleanup()

        if (hasPendingToolsRef.current) return

        setIsStreaming(false)

        if (e.payload) {
          setLastUsage(e.payload)
          const turnCost    = calcTurnCost(e.payload)
          const turnTokens  = e.payload.prompt_tokens + e.payload.completion_tokens
          const newCost     = totalCostRef.current + turnCost
          const newTokens   = totalTokensRef.current + turnTokens
          onCostsUpdate(newCost, newTokens)
          await onPersist(messagesRef.current, newCost, newTokens)
        }
      })

      await invoke('chat', {
        modelId,
        messages: apiMessages,
        apiKey,
        maxTokens: settings.maxTokens,
        toolsEnabled: settings.toolsEnabled,
      })

    } catch (err) {
      setError(String(err))
      cleanup()
      setIsStreaming(false)
    }
  }

  // ── Tool approval ──────────────────────────────────────────────────────────

  async function handleToolApproval(
    approved: PendingToolCall[],
    rejected: PendingToolCall[],
  ) {
    setPendingToolCalls([])
    hasPendingToolsRef.current = false

    const toolResultMessages: ApiMessage[] = []
    const resultSummaryMessages: Message[] = []

    for (const tc of approved) {
      let result    = ''
      let finalPath = tc.parsedArgs.path ?? 'file'

      try {
        if (tc.name === 'create_file') {
          const { save } = await import('@tauri-apps/plugin-dialog')

          const chosenPath = await save({
            title: `Save ${stripToFilename(finalPath)}`,
            defaultPath: stripToFilename(finalPath),
          })

          if (!chosenPath) {
            result = 'Save cancelled by user.'
          } else {
            finalPath = chosenPath
            result = await invoke<string>('write_file', {
              path: chosenPath,
              content: tc.parsedArgs.content ?? '',
            })
          }

        } else if (tc.name === 'read_file') {
          const { open } = await import('@tauri-apps/plugin-dialog')

          const chosenPath = await open({
            title: 'Select file to read',
            defaultPath: finalPath,
            multiple: false,
            directory: false,
          }) as string | null

          if (!chosenPath) {
            result = 'File selection cancelled by user.'
          } else {
            finalPath = chosenPath
            result = await invoke<string>('read_file', { path: chosenPath })
          }
        }

      } catch (err) {
        result = `Error: ${String(err)}`
        console.error('[tool error]', tc.name, err)
      }

      const succeeded = !result.startsWith('Error') && !result.includes('cancelled')

      toolResultMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      })

      resultSummaryMessages.push({
        id: `tool-${tc.id}-${Date.now()}`,
        role: 'assistant',
        content: tc.name === 'create_file'
          ? succeeded ? `✓ Saved \`${finalPath}\`` : `✗ ${result}`
          : succeeded ? `✓ Read \`${finalPath}\``  : `✗ ${result}`,
      })
    }

    // Send rejection notices for any skipped tool calls
    for (const tc of rejected) {
      toolResultMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: 'User rejected this action.',
      })
    }

    // Placeholder bubble for the model's follow-up response
    const assistantFollowup: Message = {
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: '',
    }

    setMessages(prev => [...prev, ...resultSummaryMessages, assistantFollowup])

    const nextApiMessages = [...apiMessagesRef.current, ...toolResultMessages]
    apiMessagesRef.current = nextApiMessages
    await runChat(nextApiMessages, assistantFollowup.id)
  }

  function handleToolRejectAll() {
    setPendingToolCalls([])
    hasPendingToolsRef.current = false
    setIsStreaming(false)
    // Remove any empty assistant bubble left from the cancelled turn
    setMessages(prev => prev.filter(m => m.content !== ''))
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    input,
    setInput,
    send,
    isStreaming,
    lastUsage,
    trimmedCount,
    error,
    pendingToolCalls,
    handleToolApproval,
    handleToolRejectAll,
  }
}