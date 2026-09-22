import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleKeaChat } from './src/server/handleKeaChat.ts'

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
