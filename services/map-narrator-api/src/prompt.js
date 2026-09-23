const MAX_CUSTOM_PROMPT_LENGTH = 500

const DEFAULT_VISUAL_PROMPT = 'Describe the current rendered map image for a person who cannot see it. Start with overall layout, then relative spatial relationships, visible symbols, colors, labels, and patterns. Use supplied GIS metadata only to corroborate visible meaning. Do not invent labels, values, causes, entities, or relationships. State uncertainty and unreadable details explicitly.'

const UNSAFE_CUSTOM_PROMPT_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|system)\b/i,
  /\bdisregard\s+(all\s+)?(previous|prior|system)\b/i,
  /\b(bypass|disable|remove|override)\b.{0,40}\b(safety|privacy|restriction|limitation|instruction)\b/i,
  /\b(do\s+not|don't|never)\b.{0,40}\b(state|mention|show|report)\b.{0,30}\b(uncertain|limitation|private|personal|secret)\b/i,
  /\b(reveal|include|send|expose)\b.{0,40}\b(api\s*key|credential|password|secret|private|personal)\b/i
]

function normalizeCustomPrompt (value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new TypeError('custom prompt must be a string')
  const prompt = value.trim()
  if (!prompt) return undefined
  if (prompt.length > MAX_CUSTOM_PROMPT_LENGTH) throw new RangeError(`custom prompt must be at most ${MAX_CUSTOM_PROMPT_LENGTH} characters`)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(prompt)) throw new TypeError('custom prompt contains invalid characters')
  if (UNSAFE_CUSTOM_PROMPT_PATTERNS.some((pattern) => pattern.test(prompt))) {
    throw new TypeError('custom prompt conflicts with protected safety instructions')
  }
  return prompt
}

function buildVisualPrompt (customPrompt) {
  return customPrompt ? `${customPrompt}\n\n${DEFAULT_VISUAL_PROMPT}` : DEFAULT_VISUAL_PROMPT
}

module.exports = { DEFAULT_VISUAL_PROMPT, MAX_CUSTOM_PROMPT_LENGTH, buildVisualPrompt, normalizeCustomPrompt }
