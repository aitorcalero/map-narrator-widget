import { narrationContentStyle } from '../src/runtime/layout'

describe('narrationContentStyle', () => {
  it('keeps generated narration scrollable inside a bounded widget', () => {
    expect(narrationContentStyle).toMatchObject({
      flex: '1 1 auto',
      minHeight: 0,
      overflowY: 'auto'
    })
  })
})
