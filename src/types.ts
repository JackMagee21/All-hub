export interface ModelPricing {
  prompt: string
  completion: string
}

export interface RemoteModel {
  id: string
  name: string
  description?: string
  contextLength?: number
  pricing?: ModelPricing
  architecture?: {
    modality?: string
  }
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
}

export interface Conversation {
  id: string
  title: string
  modelId: string
  modelName: string
  messages: Message[]
  totalCost: number
  totalTokens: number
  favorite: boolean
  createdAt: number
  updatedAt: number
}

export function modelBrand(modelId: string): string {
  if (modelId.startsWith('openai/')) return 'OpenAI'
  if (modelId.startsWith('anthropic/')) return 'Anthropic'
  if (modelId.startsWith('google/')) return 'Google'
  if (modelId.startsWith('deepseek/')) return 'DeepSeek'
  if (modelId.startsWith('meta-llama/')) return 'Meta'
  if (modelId.startsWith('mistralai/')) return 'Mistral'
  if (modelId.startsWith('nex-agi/')) return 'Nex AGI'
  const slash = modelId.indexOf('/')
  return slash !== -1 ? modelId.slice(0, slash) : modelId
}

export function modelBrandColor(modelId: string): string {
  if (modelId.startsWith('openai/')) return '#74aa9c'
  if (modelId.startsWith('anthropic/')) return '#cc785c'
  if (modelId.startsWith('google/')) return '#4285f4'
  if (modelId.startsWith('deepseek/')) return '#4d6bfe'
  if (modelId.startsWith('meta-llama/')) return '#0866ff'
  if (modelId.startsWith('mistralai/')) return '#ff7000'
  return '#8e8ea0'
}

export function inputRatePerM(model: RemoteModel): number {
  return parseFloat(model.pricing?.prompt ?? '0') * 1_000_000
}

export function outputRatePerM(model: RemoteModel): number {
  return parseFloat(model.pricing?.completion ?? '0') * 1_000_000
}

export function isFree(model: RemoteModel): boolean {
  return inputRatePerM(model) === 0 && outputRatePerM(model) === 0
}

export function isTextModel(model: RemoteModel): boolean {
  const modality = model.architecture?.modality ?? ''
  return modality.includes('->text') || modality === ''
}

export function generateTitle(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')
  if (!first) return 'New conversation'
  return first.content.slice(0, 40) + (first.content.length > 40 ? '…' : '')
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface PendingToolCall {
  id: string
  name: string
  arguments: string
  parsedArgs: Record<string, string>
}

export interface ToolResult {
  toolCallId: string
  result: string
  approved: boolean
}