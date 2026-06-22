export interface ModelPricing {
  prompt: string       // $ per token as a string e.g. "0.000002"
  completion: string
}

export interface RemoteModel {
  id: string
  name: string
  description?: string
  contextLength?: number
  pricing?: ModelPricing
  architecture?: {
    modality?: string  // e.g. "text->text", "text+image->text"
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

// Helpers
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