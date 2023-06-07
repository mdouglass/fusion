import { useLoggingInterceptor, useReferer } from './got-utils.js'
import { decodeApex } from './salesforce.js'
import * as ics from 'ics'
import { writeJSON } from './json.js'
import { writeText } from './text.js'
import got from 'got'
import { CookieJar } from 'tough-cookie'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export async function login(): Promise<void> {
  if (!process.env.USER || !process.env.PASSWORD) {
    throw new Error('USER and PASSWORD environment variables must be set')
  }
  if (!process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY) {
    throw new Error('B2_KEY_ID and B2_APPLICATION_KEY environment variables must be set')
  }

  const session = got.extend({
    mutableDefaults: true,
    cookieJar: new CookieJar(),
    headers: {
      // MSED - get version from package.json
      'user-agent': 'futures/0.1.0 (futures)',
      accept: 'text/html',
    },
    retry: { limit: 0 },
  })
  useLoggingInterceptor(session)
  useReferer(session)

  // request the login page
  const pageLogin = await session.get('https://futures.force.com/PortalLogin').text()
  const ctxLogin = extractCtx(pageLogin, 'process')

  // perform the login
  const reqLogin = {
    action: 'PortalLoginController',
    method: 'process',
    data: [
      {
        parameters: {
          type: 'sign_in',
          username: process.env.USER,
          password: process.env.PASSWORD,
        },
        variables: { execution_index: '0' },
      },
    ],
    type: 'rpc',
    tid: 2,
    ctx: ctxLogin,
  }
  const homeData = await session
    .post('https://futures.force.com/apexremote', { json: reqLogin })
    .json<any>()
  const url = homeData[0].result.data.string_result
  if (!url) {
    // seen this when my account is locked out b/c of too many login failures
    throw new Error('Authentication failed successfully')
  }

  // request the page login redirects you to (this allows cookies to be set)
  const pageHome1 = await session.get(url)

  // pageHome1 is a page with a JavaScript-based redirect, follow it manually to /PortalHome
  const pageHome2 = await session.get('https://futures.force.com/PortalHome').text()
  const ctxQuery = extractCtx(pageHome2, 'query')

  // session schedule
  const reqSchedule = {
    action: 'PortalController',
    method: 'query',
    data: [
      {
        parameters: {
          query:
            "SELECT Id, Session_Number__c, Starting__c, Ending__c, Closeout_Session__c, Modality__c, Class__c, Instructor__c,Instructor__r.Name, Instructor__r.FirstName, Instructor__r.LastName, Class__r.Id, Class__r.Campus__c, Class__r.Difficulty_Level__c, Class__r.Last_Scheduled_Session_DateTime__c, Class__r.Course__c, Class__r.Course__r.Name, Class__r.Semester_ID__r.Enrollment_ID__r.Contact__c, Class__r.Semester_ID__r.Enrollment_ID__r.Contact__r.Id, Class__r.Semester_ID__r.Enrollment_ID__r.Contact__r.FirstName, Class__r.Semester_ID__r.Enrollment_ID__r.Contact__r.LastName FROM Session_Schedule__c WHERE Date__c >= 2023-05-15 AND Date__c < 2023-08-31 AND Closeout_Session__c = false AND Class__r.Semester_ID__r.Enrollment_ID__r.Contact__c IN ('0035Y00005WVGQdQAP') ORDER BY Starting__c ASC",
        },
        variables: { execution_index: '0' },
      },
    ],
    type: 'rpc',
    tid: 8,
    ctx: ctxQuery,
  }
  const resSchedule = await session
    .post('https://futures.force.com/apexremote', {
      json: reqSchedule,
    })
    .json<any>()

  const reqTests = {
    action: 'PortalController',
    method: 'query',
    data: [
      {
        parameters: {
          query:
            "SELECT Id, Assessment__c, Attendance_Status__c, External_ID__c, Campus__c, Test_Date_Time__c, Term__c, Proctor_Instructor__c, Student__c, Proctor_Instructor__r.Name, Proctor_Instructor__r.FirstName, Proctor_Instructor__r.LastName, Student__r.Name, Student__r.FirstName, Student__r.LastName FROM Assessment__c WHERE Date__c >= 2023-05-25 AND Date__c < 2023-08-31 AND Student__c IN ('0035Y00005WVGQdQAP') ORDER BY Test_Date_Time__c ASC",
        },
        variables: { execution_index: '1' },
      },
    ],
    type: 'rpc',
    tid: 9,
    ctx: ctxQuery,
  }
  const resTests = await session
    .post('https://futures.force.com/apexremote', { json: reqTests })
    .json()

  function toSession(s: any): ics.EventAttributes {
    const toDateArray = (ms: number): [number, number, number, number, number] => {
      const d = new Date(ms)
      return [
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
      ] as [number, number, number, number, number]
    }

    const toSessionNumberTrailer = () => {
      const sessionNumberRaw = s.Session_Number__c
      if (typeof sessionNumberRaw !== 'string') {
        return ''
      }
      const sessionNumber = Number.parseInt(sessionNumberRaw, 10)
      if (Number.isNaN(sessionNumber)) {
        return ` ${sessionNumberRaw}`
      } else {
        return ` #${sessionNumber}`
      }
    }

    return {
      title: s.Class__r.Course__r.Name + toSessionNumberTrailer(),
      start: toDateArray(s.Starting__c),
      startInputType: 'utc',
      end: toDateArray(s.Ending__c),
      endInputType: 'utc',
    }
  }

  const sessions = (decodeApex(resSchedule) as any)[0].result.data.query_results.map(toSession)
  await writeJSON('sessions.json', sessions)

  const { error, value } = ics.createEvents(sessions)
  if (error) {
    throw error
  }
  await writeText('sessions.ics', value ?? '')

  const REGION = 'us-west-001'
  const b2 = new S3Client({
    endpoint: `https://s3.${REGION}.backblazeb2.com`,
    region: REGION,
    credentials: {
      // Must have both read and write permissions on BUCKET_NAME
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
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
  console.log('done')
}

function extractCtx(html: string, name: string): unknown {
  const ctxRaw = new RegExp(`{"name":"${name}"[^}]*}`).exec(html)?.[0]
  if (ctxRaw === undefined) {
    throw new Error(`Could not find ${name} ctx`)
  }
  const ctx = JSON.parse(ctxRaw)

  const vid = /"vid":"([^"]*)"/.exec(html)?.[1]
  if (vid === undefined) {
    throw new Error('vid not found')
  }

  return { vid, csrf: ctx.csrf, ns: ctx.ns, ver: ctx.ver, authorization: ctx.authorization }
}
