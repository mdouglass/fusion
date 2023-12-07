/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { login } from './fusion'

const fetch: ExportedHandlerFetchHandler = async (req, env, ctx) => {
  const res = await login()
  return new Response(res, { headers: { 'content-type': 'text/calendar' } })
}

export default { fetch }
