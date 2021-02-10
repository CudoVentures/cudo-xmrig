const index = require('./')
const assert = require('assert')
const { describe, it } = require('mocha')


/*
 * ABOUT        XMRig/6.7.2 gcc/7.5.0
 * LIBS         libuv/1.18.0 
 * HUGE PAGES   supported
 * 1GB PAGES    disabled
 * CPU          Intel(R) Core(TM) i7-6700 CPU @ 3.40GHz (1) 64-bit AES
                threads:8
 * MEMORY       4.1/7.5 GB (54%)
 * DONATE       0%
 * ASSEMBLY     auto:intel
 * POOL #1      stratum.cudopool.com:31010 algo rx/0
 * COMMANDS     'h' hashrate, 'p' pause, 'r' resume, 's' results, 'c' connection
 * OPENCL       disabled
 * CUDA         disabled
[2021-01-19 11:04:42.448]  net      use pool stratum.cudopool.com:31010  51.89.64.35
[2021-01-19 11:04:42.448]  net      new job from stratum.cudopool.com:31010 diff 25000 algo rx/0 height 2277832
[2021-01-19 11:04:42.448]  cpu      use argon2 implementation AVX2
[2021-01-19 11:04:42.454]  msr      register values for "intel" preset have been set successfully (6 ms)
[2021-01-19 11:04:42.454]  randomx  init dataset algo rx/0 (8 threads) seed 99a9701212ff499e...
[2021-01-19 11:04:42.637]  randomx  allocated 2336 MB (2080+256) huge pages 100% 1168/1168 +JIT (183 ms)
[2021-01-19 11:04:46.534]  randomx  dataset ready (3896 ms)
[2021-01-19 11:04:46.534]  cpu      use profile  rx  (4 threads) scratchpad 2048 KB
[2021-01-19 11:04:46.536]  cpu      READY threads 4/4 (4) huge pages 100% 4/4 memory 8192 KB (2 ms)
[2021-01-19 11:04:47.535]  miner    speed 10s/60s/15m n/a n/a n/a H/s max n/a H/s
[2021-01-19 11:05:28.348]  cpu      accepted (8/0) diff 37500 (60 ms)
[2021-01-19 11:05:28.562]  miner    speed 10s/60s/15m 2585.1 n/a n/a H/s max 2588.9 H/s
[2021-01-19 11:05:29.563]  miner    speed 10s/60s/15m 2584.7 n/a n/a H/s max 2588.9 H/s
[2021-01-19 11:05:30.563]  miner    speed 10s/60s/15m 2585.0 n/a n/a H/s max 2588.9 H/s
[2021-01-19 11:05:31.564]  miner    speed 10s/60s/15m 2585.2 n/a n/a H/s max 2588.9 H/s
*/
const exampleLogs = [
  {
    should: 'parse a 0 hash rate when it is n/a',
    message: '[2021-01-19 11:04:48.536]  miner    speed 10s/60s/15m n/a n/a n/a H/s max n/a H/s',
    expected: { type: 'hashRate', hashRate: 0, message: 'miner    speed 10s/60s/15m n/a n/a n/a H/s max n/a H/s' }
  },
  {
    should: 'parse hash rate messages',
    message: '[2021-01-19 11:05:31.564]  miner    speed 10s/60s/15m 2585.2 n/a n/a H/s max 2588.9 H/s',
    expected: { type: 'hashRate', hashRate: 2585.2, message: 'miner    speed 10s/60s/15m 2585.2 n/a n/a H/s max 2588.9 H/s' }
  },
  {
    should: 'parse hash rate messages',
    message: '[2021-01-19 11:07:39.639]  miner    speed 10s/60s/15m 2587.3 2586.5 n/a H/s max 2589.8 H/s',
    expected: { type: 'hashRate', hashRate: 2587.3, message: 'miner    speed 10s/60s/15m 2587.3 2586.5 n/a H/s max 2589.8 H/s' }
  },
  {
    should: 'parse log messages',
    message: '[2021-01-19 11:04:42.454]  randomx  init dataset algo rx/0 (8 threads) seed 99a9701212ff499e...',
    expected: { type: 'log', message: 'randomx  init dataset algo rx/0 (8 threads) seed 99a9701212ff499e...' }
  },
  {
    should: 'parse log messages',
    message: '[2021-01-19 11:04:42.448]  net      use pool stratum.cudopool.com:31010  51.89.64.35',
    expected: { type: 'log', message: 'net      use pool stratum.cudopool.com:31010  51.89.64.35' }
  },
  {
    should: 'parse share messages',
    message: '[2021-01-19 11:05:28.348]  cpu      accepted (8/0) diff 37500 (60 ms)',
    expected: { type: 'shares', accepted: 8, rejected: 0, difficulty: 37500, message: 'cpu      accepted (8/0) diff 37500 (60 ms)' }
  }
]

describe('cudo-xmrig/6.8.1', () => {
  exampleLogs.forEach(log => {
    it(log.should, () => {
      const module = index()
      const parsedMessage = module.parseLog(log.message)
      assert.deepStrictEqual(parsedMessage, log.expected)
    })
  })
})
