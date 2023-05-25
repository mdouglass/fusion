import { Axios, AxiosInstance } from 'axios'
import { writeFile } from 'fs/promises'

export function useLoggingInterceptor(session: AxiosInstance): void {
  let requestId = 0
  session.interceptors.request.use(
    async (config) => {
      ++requestId
      await writeFile(
        `request-${requestId}.json`,
        JSON.stringify({
          method: config.method,
          url: config.url,
          data: config.data,
        }),
        { encoding: 'utf8' },
      )
      return config
    },
    async (error) => {
      await writeFile(`request-${requestId}-error.json`, JSON.stringify(error), {
        encoding: 'utf8',
      })
      return error
    },
  )
  session.interceptors.response.use(
    async (response) => {
      const ext = response.headers['content-type'].startsWith('application/json')
        ? 'json'
        : response.headers['content-type'].startsWith('text/html')
        ? 'html'
        : 'txt'
      await writeFile(`request-${requestId}-response.${ext}`, response.data ?? '', {
        encoding: 'utf8',
      })
      return response
    },
    async (error) => {
      await writeFile(`request-${requestId}-response-error.json`, JSON.stringify(error), {
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
