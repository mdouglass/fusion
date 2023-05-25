#!/usr/bin/env node

import { login } from './futures.js'

async function main(): Promise<void> {
  await login()
}

try {
  await main()
} catch (e) {
  console.log((e as Error).stack)
}
