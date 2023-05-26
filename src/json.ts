import stringify from 'json-stable-stringify'
import { writeText } from './text.js'

export type JsonValue =
  | JsonValue[]
  | boolean
  | number
  | string
  | {
      [field: string]: JsonValue
    }
  | null
  | undefined
export type JsonArray = JsonValue[]
export type JsonObject = Record<string, JsonValue>

export async function writeJSON(file: string, value: JsonValue): Promise<void> {
  return writeText(file, stringify(value, { space: 2 }))
}
