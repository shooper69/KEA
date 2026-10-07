import type { Handler } from '@netlify/functions'
import {
  postCreatorQuestEvent,
  readCreatorQuestRef,
} from '../../src/server/creatorquest.ts'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' }
  }
  const body = JSON.parse(event.body || '{}') as {
    email?: string
    userId?: string
  }
  const email = body.email?.trim().toLowerCase()
  const userId = body.userId?.trim()
  if (!userId) {
    return {
      statusCode: 200,
      body: JSON.stringify({ attributed: false, reason: 'user_not_found' }),
    }
  }
  const ref = readCreatorQuestRef(event.headers.cookie || event.headers.Cookie)
  if (!ref) {
    return {
      statusCode: 200,
      body: JSON.stringify({ attributed: false, reason: 'no_ref' }),
    }
  }
  const result = await postCreatorQuestEvent(
    {
      CREATORQUEST_EVENTS_URL: process.env.CREATORQUEST_EVENTS_URL,
      CREATORQUEST_APP_KEY: process.env.CREATORQUEST_APP_KEY,
    },
    {
      type: 'registration',
      external_user_id: userId,
      email,
      referral_code: ref,
    },
  )
  return { statusCode: 200, body: JSON.stringify(result) }
}
