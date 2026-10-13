import { registerDecorator, type ValidationOptions } from 'class-validator'

/** Limita o tamanho (em bytes, serializado) de campos JSON livres como `metadata` e `definition`. */
export function MaxJsonSize(maxBytes: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be at most ${maxBytes} bytes`, ...options },
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true
          try {
            return Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes
          } catch {
            return false
          }
        },
      },
    })
  }
}
