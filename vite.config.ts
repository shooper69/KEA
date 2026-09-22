import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleKeaBilling } from './src/server/handleKeaBilling.ts'
import { handleKeaChat } from './src/server/handleKeaChat.ts'
import { handleKeaTranscribe } from './src/server/handleKeaTranscribe.ts'
import { handleKeaTts } from './src/server/handleKeaTts.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    publicDir: 'assets/images',
    plugins: [
      react(),
      {
        name: 'kea-chat-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/billing')) {
              void handleKeaBilling(req, res, {
                STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
              })
              return
            }
            if (req.url?.startsWith('/api/transcribe')) {
              void handleKeaTranscribe(req, res, env.OPENAI_API_KEY)
              return
            }
            if (req.url?.startsWith('/api/tts')) {
              void handleKeaTts(req, res, env.OPENAI_API_KEY)
              return
            }
            if (!req.url?.startsWith('/api/chat')) {
              next()
              return
            }
            void handleKeaChat(req, res, env.OPENAI_API_KEY)
          })
        },
      },
    ],
  }
})
