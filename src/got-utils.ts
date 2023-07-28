import { CookieJar } from 'tough-cookie'
import type { JsonValue } from './json.js'
import { writeJSON } from './json.js'
import { writeText } from './text.js'
import got from 'got'
import type { Got, RequestError, Response } from 'got'

// class OurCookieJar extends CookieJar {
//   public  override setCookie(cookieOrString: unknown, currentUrl: string, options: Record<string, unknown>, cb: (error: Error | null, cookie: unknown) => void) => void) & ((rawCookie: string, url: string, callback: (error: Error | null, result: unknown) => void): void {
//     return super.setCookie(cookieOrString, currentUrl, options, cb)
//   }

// }

export function createSession(): Got {
  const session = got.extend({
    mutableDefaults: true,
    cookieJar: new CookieJar(),
    ignoreInvalidCookies: true,
    headers: {
      // MSED - get version from package.json
      'user-agent': 'futures/0.1.0 (futures)',
      accept: 'text/html',
    },
    retry: { limit: 0 },
  })
  useLoggingInterceptor(session)
  useReferer(session)
  return session
}

function useLoggingInterceptor(session: Got): void {
  let requestId = 0
  session.defaults.options.merge({
    hooks: {
      beforeRequest: [
        async (config): Promise<void> => {
          ++requestId
          await writeJSON(`request-${requestId}.json`, {
            method: config.method,
            url: config.url?.toString(),
            headers: config.headers,
            body: config.body?.toString(),
          })
        },
      ],
      afterResponse: [
        async (res): Promise<Response> => {
          const contentType = res.headers['content-type']
          const ext = contentType?.startsWith('application/json')
            ? 'json'
            : contentType?.startsWith('text/html')
            ? 'html'
            : 'txt'
          await writeText(`request-${requestId}-response.${ext}`, String(res.body))
          return res
        },
      ],
      beforeError: [
        async (error): Promise<RequestError> => {
          await writeJSON(`request-${requestId}-error.json`, error as unknown as JsonValue)
          return error
        },
      ],
    },
  })
}

function useReferer(session: Got): void {
  session.defaults.options.merge({
    hooks: {
      afterResponse: [
        (res): Response => {
          if (res.headers['content-type']?.startsWith('text/html')) {
            session.defaults.options.headers.referer = res.url
          }
          return res
        },
      ],
    },
  })
}
