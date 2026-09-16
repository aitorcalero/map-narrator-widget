const { createOpenAIDescriber } = require('./openai-describer')
const { createServer } = require('./server')

const port = Number(process.env.PORT ?? 8787)
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY is required')
  process.exit(1)
}

const server = createServer({
  describeMap: createOpenAIDescriber({ apiKey, model: process.env.OPENAI_MODEL ?? 'gpt-5-mini' }),
  allowedOrigin: process.env.MAP_NARRATOR_ALLOWED_ORIGIN
})
server.listen(port, '0.0.0.0', () => console.log(`map-narrator-api listening on ${port}`))
