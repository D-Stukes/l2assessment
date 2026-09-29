import { createApp } from './app.js'
import { seedIfEmpty, DEMO_PASSWORD } from './seed.js'

const PORT = Number(process.env.PORT) || 3001

if (seedIfEmpty()) {
  console.log(`Created demo data. Log in as maria@acme.test or priya@brightside.test (password: ${DEMO_PASSWORD})`)
}

createApp().listen(PORT, () => {
  console.log(`Relay AI API listening on http://localhost:${PORT}`)
})
