import type { JsonValue } from './json.js'

export function decodeApex(json: JsonValue): JsonValue {
  const dict: Record<string, any> = {}

  function collapse(value: JsonValue): JsonValue {
    if (typeof value === 'object' && value) {
      if ('s' in value && typeof value.s === 'number' && 'v' in value) {
        dict[value.s] = value.v
        return collapse(value.v)
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = collapse(value[i])
        }
      } else {
        for (const k in value) {
          value[k] = collapse(value[k])
        }
      }
    }
    return value
  }

  function expand(value: JsonValue): JsonValue {
    if (typeof value === 'object' && value) {
      if ('r' in value && typeof value.r === 'number') {
        return dict[value.r]
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = expand(value[i])
        }
      } else {
        for (const k in value) {
          value[k] = expand(value[k])
        }
      }
    }
    return value
  }

  return expand(collapse(json))
}
