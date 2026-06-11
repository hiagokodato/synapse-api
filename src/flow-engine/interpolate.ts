import type { FlowVariables } from './flow-engine.types'

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

/**
 * Replaces `{{variable}}` placeholders in a text with the stored variable
 * values. Unknown placeholders are replaced with an empty string so the bot
 * never leaks raw template syntax to the end user.
 */
export function interpolate(text: string, variables: FlowVariables = {}): string {
  if (!text || text.indexOf('{{') === -1) {
    return text
  }

  return text.replace(PLACEHOLDER, (_match, name: string) => {
    const value = variables[name]
    return value !== undefined && value !== null ? String(value) : ''
  })
}
