const index = require('./')
const assert = require('assert')
const { describe, it } = require('mocha')

const exampleLogs = [
  {
    should: 'parse hash rate messages',
    message: '[2019-11-26 17:55:46.923] speed 10s/60s/15m 647.7 n/a n/a H/s max 647.7 H/s',
    expected: { type: 'hashRate', hashRate: 647.7 }
  },
  {
    should: 'parse log messages',
    message: '[2019-11-26 17:55:23.261]  rx   init dataset algo rx/0 (2 threads) seed b5e68b657d8d6817...',
    expected: { type: 'log', message: 'init dataset algo rx/0 (2 threads) seed b5e68b657d8d6817...' }
  }
]

describe('cudo-xmrig/6.3.4', () => {
  exampleLogs.forEach(log => {
    it(log.should, () => {
      const module = index()
      const parsedMessage = module.parseLog(log.message)
      assert.deepStrictEqual(parsedMessage, log.expected)
    })
  })
})
