import { login } from './fusion'

const fetch: ExportedHandlerFetchHandler = async (req, env, ctx) => {
  const res = await login()
  return new Response(res, { headers: { 'content-type': 'text/calendar' } })
}

export default { fetch }
