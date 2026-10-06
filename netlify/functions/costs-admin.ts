import { handleKeaCostsAdmin } from '../../src/server/handleKeaCostsAdmin'

export async function handler(event: {
  httpMethod: string
  path?: string
  rawUrl?: string
  body?: string | null
  headers?: Record<string, string | undefined>
  queryStringParameters?: Record<string, string | undefined>
}) {
  return handleKeaCostsAdmin(event)
}
