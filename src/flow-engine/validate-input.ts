import type { FlowInputType } from './flow-engine.types'

export type InputValidationResult = {
  valid: boolean
  /** Normalized value to be stored when valid. */
  value: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function isValidCpf(raw: string): boolean {
  const digits = onlyDigits(raw)
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false
  }

  const calcCheck = (length: number): number => {
    let sum = 0
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i)
    }
    const result = (sum * 10) % 11
    return result === 10 ? 0 : result
  }

  return calcCheck(9) === Number(digits[9]) && calcCheck(10) === Number(digits[10])
}

export function validateInput(
  content: string,
  inputType: FlowInputType = 'text',
): InputValidationResult {
  const trimmed = (content ?? '').trim()

  if (!trimmed) {
    return { valid: false, value: '' }
  }

  switch (inputType) {
    case 'email':
      return { valid: EMAIL_REGEX.test(trimmed), value: trimmed.toLowerCase() }

    case 'phone': {
      const digits = onlyDigits(trimmed)
      return { valid: digits.length >= 8 && digits.length <= 15, value: digits }
    }

    case 'number': {
      const normalized = trimmed.replace(',', '.')
      const valid = normalized !== '' && Number.isFinite(Number(normalized))
      return { valid, value: valid ? String(Number(normalized)) : trimmed }
    }

    case 'cpf': {
      const valid = isValidCpf(trimmed)
      return { valid, value: valid ? onlyDigits(trimmed) : trimmed }
    }

    case 'text':
    default:
      return { valid: true, value: trimmed }
  }
}
