import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import InputBar from './components/Chat/InputBar'
import MessageBubble from './components/Chat/MessageBubble'
import TokenCounter from './components/Tokens/TokenCounter'
import ModelPicker from './components/Sidebar/ModelPicker'
import { countTokens } from './lib/tokeniser'
import { RemoteModel, Message, Usage, inputRatePerM, outputRatePerM } from './types'

const DEFAULT_MODEL = 'openai/gpt-4.1-mini'

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUsage, setLastUsage] = useState<Usage | null>(null)
  const [selectedModel, setSelectedModel] = useState<RemoteModel | null>(null)
  const [modelId, setModelId] = useState(DEFAULT_MODEL)
  const bottomRef = useRef<HTMLDivElement>(null)
  const unlistenTokenRef = useRef<(() => void) | null>(null)
  const unlistenDoneRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const liveTokens = countTokens(input)

  const cost = lastUsage && selectedModel
    ? (lastUsage.prompt_tokens / 1_000_000) *  inputRatePerM(selectedModel) +
      (lastUsage.completion_tokens / 1_000_000) * outputRatePerM(selectedModel)
    : undefined

  function handleModelSelect(model: RemoteModel) {
    setSelectedModel(model)
    setModelId(model.id)
    setLastUsage(null)
  }

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

    try {
      unlistenTokenRef.current = await listen<string>('chat-token', (e) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + e.payload }
          return updated
        })
      })

      unlistenDoneRef.current = await listen<Usage | null>('chat-done', (e) => {
        if (e.payload) setLastUsage(e.payload)
        unlistenTokenRef.current?.()
        unlistenDoneRef.current?.()
        unlistenTokenRef.current = null
        unlistenDoneRef.current = null
        setIsStreaming(false)
      })

      await invoke('chat', {
        modelId,
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>API Key</span>
        <input
          type="password"
          placeholder="sk-or-..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={{
            width: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 10px',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 16px' }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
          {messages.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 60 }}>
              Start a conversation
            </p>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {error && <p style={{ color: '#e05c5c', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '12px 16px 20px', maxWidth: 'var(--max-width)', margin: '0 auto', width: '100%' }}>
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
          bottomLeft={
            <ModelPicker selectedId={modelId} onSelect={handleModelSelect} />
          } 
        />
      </div>

    </div>
  )
}