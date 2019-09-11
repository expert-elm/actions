import exec from './exec-result'

describe(`exec()`, () => {
  test('echo', async () => {
    const out = await exec(`echo 42`)
    return expect(out).toBe('42')
  })
})