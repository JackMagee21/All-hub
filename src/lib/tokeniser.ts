import { encode } from 'gpt-tokenizer'

export function countTokens(text: string): number {
  try {
    return encode(text).length
  } catch {
    return 0
  }
}