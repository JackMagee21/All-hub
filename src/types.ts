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
  messages: Message[]
  totalCost: number
  totalTokens: number
  createdAt: number
  updatedAt: number
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