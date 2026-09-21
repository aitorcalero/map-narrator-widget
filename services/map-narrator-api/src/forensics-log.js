const fs = require('node:fs')
const path = require('node:path')

function createForensicsLogger ({ filePath, maxBytes = 1024 * 1024 }) {
  if (!path.isAbsolute(filePath)) throw new TypeError('forensics log path must be absolute')
  return (event) => {
    const line = `${JSON.stringify(event)}\n`
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 })
    const existingSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
    if (existingSize + Buffer.byteLength(line) > maxBytes) {
      fs.rmSync(`${filePath}.1`, { force: true })
      fs.renameSync(filePath, `${filePath}.1`)
    }
    fs.appendFileSync(filePath, line, { encoding: 'utf8', mode: 0o600 })
    fs.chmodSync(filePath, 0o600)
  }
}

module.exports = { createForensicsLogger }
