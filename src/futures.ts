import axios, { AxiosResponse } from 'axios'
import { writeFile } from 'fs/promises'

const baseUrl = 'https://futures.force.com'

class CookieStore {
  private cookies: Record<string, string> = {}

  append(cookies: string[] | undefined): string {
    if (cookies !== undefined) {
      for (const cookie of cookies) {
        const [name, value] = cookie.split(';')[0].split('=')
        this.cookies[name] = value
      }
    }
    return Object.entries(this.cookies)
      .map(([n, v]) => `${n}=${v}`)
      .join('; ')
  }
}

export async function login(): Promise<void> {
  const cookieStore = new CookieStore()

  const session = axios.create({
    baseURL: baseUrl,
    headers: {
      // MSED - get version from package.json
      'user-agent': 'futures/0.1.0 (futures)',
      accept: 'text/html',
    },
    responseType: 'text',
  })

  // request the login page
  const pageLogin = await session.get('/PortalLogin')
  await writeFile('step-0-login.html', pageLogin.data, { encoding: 'utf8' })
  session.defaults.headers.cookie = cookieStore.append(pageLogin.headers['set-cookie'])
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
  const resLogin = await session.post(`/apexremote`, reqLogin, {
    headers: { referer: 'https://futures.force.com/PortalLogin' },
  })
  await writeFile('step-1-login.json', resLogin.data, { encoding: 'utf8' })
  session.defaults.headers.cookie = cookieStore.append(resLogin.headers['set-cookie'])
  const homeData = JSON.parse(resLogin.data)
  const url = homeData[0].result.data.string_result

  // request the page login redirects you to
  const pageHome1 = await session.get(url)
  await writeFile('step-2-home1.html', pageHome1.data, { encoding: 'utf8' })
  session.defaults.headers.cookie = cookieStore.append(pageHome1.headers['set-cookie'])

  // the login page sends you to a page that has a JavaScript-based redirect, follow it manually to /PortalHome
  const pageHome2 = await session.get('/PortalHome')
  await writeFile('step-3-home2.html', pageHome2.data, { encoding: 'utf8' })
  session.defaults.headers.cookie = cookieStore.append(pageHome2.headers['set-cookie'])
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
  const resSchedule = await session.post(`/apexremote`, reqSchedule, {
    headers: { referer: 'https://futures.force.com/PortalHome' },
  })
  await writeFile('step-4-schedule.json', resSchedule.data, { encoding: 'utf8' })

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
  const resTests = await session.post(`/apexremote`, reqTests, {
    headers: { referer: 'https://futures.force.com/PortalHome' },
  })
  await writeFile('step-5-tests.json', resTests.data, { encoding: 'utf8' })

  function collapse(value: any, dict: Record<string, any>): any {
    if (typeof value === 'object' && value) {
      if ('s' in value && 'v' in value) {
        dict[value.s] = value.v
        return collapse(value.v, dict)
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = collapse(value[i], dict)
        }
      } else {
        for (const k in value) {
          value[k] = collapse(value[k], dict)
        }
      }
    }
    return value
  }

  function expand(value: any, dict: Record<string, any>): any {
    if (typeof value === 'object' && value) {
      if ('r' in value) {
        return dict[value.r]
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = expand(value[i], dict)
        }
      } else {
        for (const k in value) {
          value[k] = expand(value[k], dict)
        }
      }
    }
    return value
  }

  function toSession(s: any): any {
    return {
      course: s.Class__r.Course__r.Name,
      start: new Date(s.Starting__c).toLocaleString(),
      end: new Date(s.Ending__c).toLocaleString(),
    }
  }

  const dict: Record<string, any> = {}
  const sessions = expand(
    collapse(JSON.parse(resSchedule.data)[0].result.data.query_results, dict),
    dict,
  ).map(toSession)
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
