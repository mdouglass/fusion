import { login } from './fusion'

const fetchHandler = async (): Promise<Response> => {
  const res = await login()
  return new Response(res, { headers: { 'content-type': 'text/calendar' } })
}

export default { fetch: fetchHandler }
