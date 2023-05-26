import { writeFile } from 'fs/promises'

export async function writeText(file: string, text: string): Promise<void> {
  return writeFile(file, text, { encoding: 'utf8' })
}
