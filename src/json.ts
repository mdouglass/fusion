import { writeFile } from 'fs/promises'
import stringify from 'json-stable-stringify'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | {
      [field: string]: JsonValue
    }
export type JsonArray = JsonValue[]
export type JsonObject = Record<string, JsonValue>

export async function writeJSON(file: string, value: any): Promise<void> {
  return writeFile(file, stringify(value, { space: 2 }), { encoding: 'utf8' })
}
