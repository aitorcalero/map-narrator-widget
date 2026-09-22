const path = require('node:path')
const { createOpenAIDescriber } = require('./openai-describer')
const { createElevenLabsSynthesizer } = require('./elevenlabs-synthesizer')
const { createForensicsLogger } = require('./forensics-log')
const { createServer } = require('./server')

const port = Number(process.env.PORT ?? 8787)
const apiKey = process.env.OPENAI_API_KEY
const forensicLogPath = path.resolve(process.env.MAP_NARRATOR_FORENSICS_LOG ?? path.join(__dirname, '..', 'logs', 'forensics.jsonl'))
const writeForensics = createForensicsLogger({ filePath: forensicLogPath })
if (!apiKey) {
  console.error('OPENAI_API_KEY is required')
  process.exit(1)
}

let synthesizeSpeech
if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
  synthesizeSpeech = createElevenLabsSynthesizer({
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    model: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2'
  })
}

const server = createServer({
  describeMap: createOpenAIDescriber({ apiKey, model: process.env.OPENAI_MODEL ?? 'gpt-5-mini' }),
  synthesizeSpeech,
  allowedOrigin: process.env.MAP_NARRATOR_ALLOWED_ORIGIN,
  forensics: (event) => {
    const entry = { event: 'map-narrator-forensics', ...event }
    writeForensics(entry)
    console.log(JSON.stringify(entry))
  }
})
server.listen(port, '0.0.0.0', () => console.log(`map-narrator-api listening on ${port}`))
