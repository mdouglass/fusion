#!/usr/bin/env node

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import * as fusion from './fusion.js'
import { writeText } from './text.js'

async function main(): Promise<void> {
  if (!process.env.USER || !process.env.PASSWORD) {
    throw new Error('USER and PASSWORD environment variables must be set')
  }
  if (!process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY) {
    throw new Error('B2_KEY_ID and B2_APPLICATION_KEY environment variables must be set')
  }

  const value = await fusion.login(process.env.USER, process.env.PASSWORD)

  await writeText('sessions.ics', value)

  const REGION = 'us-west-001'
  const b2 = new S3Client({
    endpoint: `https://s3.${REGION}.backblazeb2.com`,
    region: REGION,
    credentials: {
      // Must have both read and write permissions on BUCKET_NAME
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
  })

  console.log('updating to douglass-public')
  await b2.send(
    new PutObjectCommand({
      Bucket: 'douglass-public',
      Key: 'ics/sessions.ics',
      Body: value,
      ContentType: 'text/calendar',
    }),
  )
}

try {
  await main()
} catch (e) {
  // eslint-disable-next-line no-console
  console.error((e as Error).stack)
}
