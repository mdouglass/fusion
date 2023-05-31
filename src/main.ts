#!/usr/bin/env node

import { login } from './futures.js'

async function main(): Promise<void> {
  await login()
}

try {
  await main()
} catch (e) {
  // eslint-disable-next-line no-console
  console.error((e as Error).stack)
}
