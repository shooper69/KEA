import { handleKeaWebsiteTrackerAdmin } from '../../src/server/handleKeaWebsiteTrackerAdmin'

export async function handler(event: {
  httpMethod: string
  path?: string
  rawUrl?: string
  headers?: Record<string, string | undefined>
  queryStringParameters?: Record<string, string | undefined>
}) {
  return handleKeaWebsiteTrackerAdmin(event)
}
