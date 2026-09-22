const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createForensicsLogger } = require('../src/forensics-log')

test('writes bounded forensic events with owner-only file permissions', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'map-narrator-forensics-'))
  const filePath = path.join(directory, 'events.jsonl')
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))

  const log = createForensicsLogger({ filePath })
  log({ event: 'map-narrator-forensics', requestId: 'request-1', stage: 'upstream', status: 502, code: 'OPENAI_401' })

  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { event: 'map-narrator-forensics', requestId: 'request-1', stage: 'upstream', status: 502, code: 'OPENAI_401' })
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600)
  }
})
