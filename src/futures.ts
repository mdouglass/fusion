import axios, { AxiosResponse } from 'axios'
import { useCookies, useLoggingInterceptor, useReferer } from './axios-utils.js'
import { writeFile } from 'fs/promises'
import { decodeApex } from './salesforce.js'

const baseUrl = 'https://futures.force.com'

export async function login(): Promise<void> {
  const session = axios.create({
    baseURL: baseUrl,
    headers: {
      // MSED - get version from package.json
      'user-agent': 'futures/0.1.0 (futures)',
      accept: 'text/html',
    },
    responseType: 'text',
  })
  useLoggingInterceptor(session)
  useCookies(session)
  useReferer(session)

  // request the login page
  const pageLogin = await session.get('/PortalLogin')
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
  const resLogin = await session.post(`/apexremote`, reqLogin)
  const homeData = JSON.parse(resLogin.data)
  const url = homeData[0].result.data.string_result
  if (!url) {
    // seen this when my account is locked out b/c of too many login failures
    throw new Error('Authentication failed successfully')
  }

  // request the page login redirects you to (this allows cookies to be set)
  const pageHome1 = await session.get(url)

  // pageHome1 is a page with a JavaScript-based redirect, follow it manually to /PortalHome
  const pageHome2 = await session.get('/PortalHome')
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
  const resSchedule = await session.post(`/apexremote`, reqSchedule)

  const reqTests = {
    action: 'PortalController',
    method: 'query',
    data: [
      {
        parameters: {
          query:
            "SELECT Id, Assessment__c, Attendance_Status__c, External_ID__c, Campus__c, Test_Date_Time__c, Term__c, Proctor_Instructor__c, Student__c, Proctor_Instructor__r.Name, Proctor_Instructor__r.FirstName, Proctor_Instructor__r.LastName, Student__r.Name, Student__r.FirstName, Student__r.LastName FROM Assessment__c WHERE Date__c >= 2023-05-25 AND Date__c < 2023-05-26 AND Student__c IN ('0035Y00005WVGQdQAP') ORDER BY Test_Date_Time__c ASC",
        },
        variables: { execution_index: '1' },
      },
    ],
    type: 'rpc',
    tid: 9,
    ctx: ctxQuery,
  }
  const resTests = await session.post(`/apexremote`, reqTests)

  function toSession(s: any): any {
    return {
      course: s.Class__r.Course__r.Name,
      start: new Date(s.Starting__c).toLocaleString(),
      end: new Date(s.Ending__c).toLocaleString(),
    }
  }

  const sessions = (
    decodeApex(JSON.parse(resSchedule.data)) as any
  )[0].result.data.query_results.map(toSession)
  await writeFile('sessions.json', JSON.stringify(sessions), { encoding: 'utf8' })

  // const tests = JSON.parse(resTests.data)[0].result.data.query_results as ITest[]
}

function extractCtx(page: AxiosResponse<any, any>, name: string): unknown {
  const ctxRaw = new RegExp(`{"name":"${name}"[^}]*}`).exec(page.data)?.[0]
  if (ctxRaw === undefined) {
    throw new Error(`Could not find ${name} ctx`)
  }
  const ctx = JSON.parse(ctxRaw)

  const vid = /"vid":"([^"]*)"/.exec(page.data)?.[1]
  if (vid === undefined) {
    throw new Error('vid not found')
  }

  return { vid, csrf: ctx.csrf, ns: ctx.ns, ver: ctx.ver, authorization: ctx.authorization }
}
