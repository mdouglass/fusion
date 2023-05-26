import { writeJSON } from './json.js'
import { writeText } from './text.js'
import type { Got, RequestError, Response } from 'got'

export function useLoggingInterceptor(session: Got): void {
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
          await writeJSON(`request-${requestId}-error.json`, error as any)
          return error
        },
      ],
    },
  })
}

export function useReferer(session: Got): void {
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
