import { AxiosInstance } from 'axios'
import { writeFile } from 'fs/promises'
import stringify from 'json-stable-stringify'

export function useLoggingInterceptor(session: AxiosInstance): void {
  let requestId = 0
  session.interceptors.request.use(
    async (config) => {
      ++requestId
      await writeFile(
        `request-${requestId}.json`,
        stringify(
          {
            method: config.method,
            url: config.url,
            headers: config.headers,
            data: config.data,
          },
          { space: 2 },
        ),
        { encoding: 'utf8' },
      )
      return config
    },
    async (error) => {
      await writeFile(`request-${requestId}-error.json`, stringify(error, { space: 2 }), {
        encoding: 'utf8',
      })
      return error
    },
  )
  session.interceptors.response.use(
    async (res) => {
      const ext = res.headers['content-type'].startsWith('application/json')
        ? 'json'
        : res.headers['content-type'].startsWith('text/html')
        ? 'html'
        : 'txt'
      await writeFile(`request-${requestId}-response.${ext}`, res.data ?? '', {
        encoding: 'utf8',
      })
      return res
    },
    async (error) => {
      await writeFile(`request-${requestId}-response-error.json`, stringify(error, { space: 2 }), {
        encoding: 'utf8',
      })
      return error
    },
  )
}

export function useCookies(session: AxiosInstance): void {
  const store = new Map<string, string>()

  function append(cookies: string[] | undefined): string {
    if (cookies !== undefined) {
      for (const cookie of cookies) {
        const [name, value] = cookie.split(';')[0].split('=')
        store.set(name, value)
      }
    }
    return Array.from(store.entries())
      .map(([n, v]) => `${n}=${v}`)
      .join('; ')
  }

  session.interceptors.response.use((res) => {
    session.defaults.headers.cookie = append(res.headers['set-cookie'])
    return res
  })
}

export function useReferer(session: AxiosInstance): void {
  session.interceptors.response.use((res) => {
    if (res.headers['content-type'].startsWith('text/html')) {
      session.defaults.headers.referer = res.request.res.responseUrl
    }
    return res
  })
}
