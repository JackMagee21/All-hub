import { useState, useRef, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  RemoteModel, Message, Usage, Conversation,
  inputRatePerM, outputRatePerM, generateTitle, modelBrand
} from './types'
import { trimHistory } from './lib/trimHistory'
import InputBar from './components/Chat/InputBar'
import MessageBubble from './components/Chat/MessageBubble'
import TokenCounter from './components/Tokens/TokenCounter'
import ModelPicker from './components/Sidebar/ModelPicker'
import Sidebar from './components/Sidebar/Sidebar'
import KeySetup from './components/KeySetup'
import KeyManager from './components/KeyManager'
import { countTokens } from './lib/tokeniser'
import {
  saveConversation,
  loadConversations,
  deleteConversation,
  toggleFavorite
} from './lib/db'

const DEFAULT_MODEL = 'openai/gpt-4.1-mini'

type KeyState = 'loading' | 'missing' | 'ready'

function newConversationId(): string {
  return crypto.randomUUID()
}

export default function App() {
  const [keyState, setKeyState] = useState<KeyState>('loading')
  const [apiKey, setApiKey] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string>(newConversationId())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUsage, setLastUsage] = useState<Usage | null>(null)
  const [totalCost, setTotalCost] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)
  const [selectedModel, setSelectedModel] = useState<RemoteModel | null>(null)
  const [modelId, setModelId] = useState(DEFAULT_MODEL)
  const bottomRef = useRef<HTMLDivElement>(null)
  const unlistenTokenRef = useRef<(() => void) | null>(null)
  const unlistenDoneRef = useRef<(() => void) | null>(null)
  const messagesRef = useRef<Message[]>([])

  // Keep ref in sync for use inside event callbacks
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Load API key from keychain
  useEffect(() => {
    invoke<string | null>('get_key')
      .then(key => {
        if (key) { setApiKey(key); setKeyState('ready') }
        else setKeyState('missing')
      })
      .catch(() => setKeyState('missing'))
  }, [])

  // Load conversations from IndexedDB
  useEffect(() => {
    loadConversations().then(setConversations)
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleKeySave(key: string) {
    await invoke('save_key', { key })
    setApiKey(key)
    setKeyState('ready')
  }

  function handleKeyCleared() {
    setApiKey('')
    setKeyState('missing')
  }

  function handleModelSelect(model: RemoteModel) {
    setSelectedModel(model)
    setModelId(model.id)
    setLastUsage(null)
  }

  function handleNewConversation() {
    setConversationId(newConversationId())
    setMessages([])
    setLastUsage(null)
    setTotalCost(0)
    setTotalTokens(0)
    setError('')
  }

  function handleSelectConversation(conv: Conversation) {
    setConversationId(conv.id)
    setMessages(conv.messages)
    setModelId(conv.modelId)
    setTotalCost(conv.totalCost)
    setTotalTokens(conv.totalTokens)
    setLastUsage(null)
    setError('')
  }

  async function handleDeleteConversation(id: string) {
    await deleteConversation(id)
    setConversations(await loadConversations())
    if (id === conversationId) handleNewConversation()
  }

  async function handleFavoriteConversation(id: string) {
    await toggleFavorite(id)
    setConversations(await loadConversations())
  }

  const persistConversation = useCallback(async (
    msgs: Message[],
    cost: number,
    tokens: number,
    currentModelId: string,
  ) => {
    const existing = conversations.find(c => c.id === conversationId)
    const conv: Conversation = {
      id: conversationId,
      title: generateTitle(msgs),
      modelId: currentModelId,
      modelName: selectedModel?.name ?? modelBrand(currentModelId),
      messages: msgs,
      totalCost: cost,
      totalTokens: tokens,
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    await saveConversation(conv)
    setConversations(await loadConversations())
  }, [conversationId, conversations, selectedModel])

  const liveTokens = countTokens(input)

  const cost = lastUsage && selectedModel
    ? (lastUsage.prompt_tokens / 1_000_000) * inputRatePerM(selectedModel) +
      (lastUsage.completion_tokens / 1_000_000) * outputRatePerM(selectedModel)
    : undefined

  async function send() {
    if (!input.trim() || isStreaming) return
    setError('')
    setIsStreaming(true)
    setLastUsage(null)

    unlistenTokenRef.current?.()
    unlistenDoneRef.current?.()

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')

    // Save after user message
    await persistConversation([...messages, userMsg], totalCost, totalTokens, modelId)

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
          const newTotalCost = totalCost + turnCost
          const newTotalTokens = totalTokens + turnTokens

          setTotalCost(newTotalCost)
          setTotalTokens(newTotalTokens)

          // Save after assistant response with updated costs
          await persistConversation(
            messagesRef.current,
            newTotalCost,
            newTotalTokens,
            modelId,
          )
        }
      })

      const { messages: trimmedMessages, trimmed } = trimHistory(messagesRef.current, selectedModel?.contextLength)

      if(trimmed > 0) {
        console.info('Trimmed message to fit context window')
      }

      await invoke('chat', {
        modelId,
        messages: trimmedMessages.map(m => ({ role: m.role, content: m.content })),
        apiKey,
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

  if (keyState === 'loading') return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
    }}>
      Loading…
    </div>
  )

  if (keyState === 'missing') return <KeySetup onSave={handleKeySave} />

  return (
    <div style={{ display: 'flex', height: '100vh' }}>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onFavorite={handleFavoriteConversation}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <ModelPicker selectedId={modelId} onSelect={handleModelSelect} />
          <div style={{ flex: 1 }} />
          <KeyManager onCleared={handleKeyCleared} onUpdated={setApiKey} />
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '24px 16px',
        }}>
          <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
            {messages.length === 0 && (
              <p style={{
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: 60,
              }}>
                Start a conversation
              </p>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {error && (
              <p style={{ color: '#e05c5c', fontSize: 13, marginTop: 8 }}>{error}</p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div style={{
          padding: '12px 16px 20px',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          width: '100%',
        }}>
          <TokenCounter
            liveTokens={liveTokens}
            promptTokens={lastUsage?.prompt_tokens}
            completionTokens={lastUsage?.completion_tokens}
            cost={cost}
          />
          <InputBar
            input={input}
            onInputChange={setInput}
            onSend={send}
            disabled={isStreaming}
          />
        </div>

      </div>
    </div>
  )
}