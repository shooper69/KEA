import { handleKeaWebsiteTrackerIngest } from '../../src/server/handleKeaWebsiteTrackerIngest'

export async function handler(event: {
  httpMethod: string
  headers?: Record<string, string | undefined>
  body?: string | null
  isBase64Encoded?: boolean
}) {
  return handleKeaWebsiteTrackerIngest(event)
}
