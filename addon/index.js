const { spawn } = require('child_process')
const { time } = require('console')
const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')

const NEWLINE_SEPERATOR = /[\r]{0,1}\n/
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

//[2021-01-19 11:05:28.562]  miner    speed 10s/60s/15m 2585.1 n/a n/a H/s max 2588.9 H/s
const timestampAndMessageMatch = /\[(?<timestamp>.*)\]\s+(?<message>.*)/
const categoryAndMessageMatch = /(?<category>\w+)\s+(?<subMessage>.*)/
const hashRateMatch = /speed 10s\/60s\/15m (?<hashRate10s>.*) (?<hashRate60s>.*) (?<hashRate15m>.*) H\/s max (?<hashRateMax>.*) H\/s/
// accepted (63/0) diff 61364 (108 ms)
const shareMatch = /accepted \((?<accepted>\d+)\/(?<rejected>\d+)\) diff (?<difficulty>\d+) \((?<time>\d+) ms\)/

module.exports = () => {
  const module = new EventEmitter()
  module.isRunning = false
  module.proc = null

  module.parseLog = logLine => {
    const timestampAndMessageParsed = logLine.match(timestampAndMessageMatch)
    if (timestampAndMessageParsed == null) {
      return { type: 'log', message: logLine }
    }

    const { message } = timestampAndMessageParsed.groups
    if (!message) {
      return { type: 'log', message: logLine }
    }

    const categoryAndMessageParsed = message.match(categoryAndMessageMatch)
    if (categoryAndMessageParsed == null) {
      return { type: 'log', message: logLine }
    }

    const { category, subMessage } = categoryAndMessageParsed.groups

    if (!category || !subMessage) {
      return { type: 'log', message }
    }

    switch (category) {
      case 'miner':
        const hashRateGroups = subMessage.match(hashRateMatch)
        if (hashRateGroups == null) {
          return { type: 'log', message }
        }
        const { hashRate10s } = hashRateGroups.groups
        if (hashRate10s == null || hashRate10s === 'n/a') {
          return { type: 'hashRate', hashRate: 0, message }
        }

        return { type: 'hashRate', hashRate: parseFloat(hashRate10s), message }
      case 'cpu':
        const shareGroups = subMessage.match(shareMatch)
        if (shareGroups == null) {
          return { type: 'log', message }
        }
        const { accepted, difficulty, rejected } = shareGroups.groups
        if (!accepted || !rejected) {
          return { type: 'log', message }
        }
        return {
          difficulty: parseInt(difficulty),
          accepted: parseInt(accepted),
          message,
          rejected: parseInt(rejected),
          type: 'shares'
        }
      default:
        return { type: 'log', message }
    }
  }

  module.logBuffer = ''
  module.readLog = data => {
    module.logBuffer += data.toString()
    const split = module.logBuffer.split(NEWLINE_SEPERATOR)
    split.forEach(o => {
      const log = module.parseLog(o.replace(ANSI_REGEX, ''))
      if (log) {
        module.emit('log', log)
      }
    })
    module.logBuffer = split[split.length - 1]
  }

  module.start = (ctx, env) => {
    module.isRunning = true
    if (module.proc) {
      return
    }

    let executable
    if (ctx.workload.platform === 'win') {
      executable = path.resolve(ctx.workloadDir, 'xmrig.exe')
      env.PATH = `${env.PATH};${ctx.workloadDir}`
    } else if (ctx.workload.platform === 'linux') {
      executable = path.resolve(ctx.workloadDir, 'xmrig')
      env.LD_LIBRARY_PATH = `$LD_LIBRARY_PATH:${ctx.workloadDir}`
    } else if (ctx.workload.platform === 'mac') {
      executable = path.resolve(ctx.workloadDir, 'xmrig')
    }

    let algo
    if (ctx.workload.algorithmId === 'randomx') {
      algo = 'rx/0'
    }

    const params = [
      '-a', algo,
      '-o', `${ctx.workload.host}:${ctx.workload.port}`,
      '-u', ctx.poolUser,
      '-p', 'x',
      '--no-color',
      '--print-time=1'
    ]

    if (ctx.workloadSettings['cpu-threads'] !== undefined) {
      params.push('-t', ctx.workloadSettings['cpu-threads'])
    }
    if (ctx.workloadSettings['cpu-affinity'] !== undefined) {
      params.push('--cpu-affinity', ctx.workloadSettings['cpu-affinity'])
    }
    if (ctx.workloadSettings['cpu-priority'] !== undefined) {
      params.push('--cpu-priority', ctx.workloadSettings['cpu-priority'])
    }
    if (ctx.workloadSettings['asm'] !== undefined) {
      params.push(`--asm=${ctx.workloadSettings['asm']}`)
    }
    if (ctx.workloadSettings['randomx-no-numa'] !== undefined) {
      params.push('--randomx-no-numa')
    }

    try {
      fs.accessSync(executable, fs.constants.R_OK)
      module.proc = spawn(executable, params, {
        env,
        windowsHide: true
      })
    } catch (err) {
      module.emit('error', err.toString())
      module.emit('exit')
      return
    }

    // Pass through and console output or errors to event emitter
    module.proc.stdout.on('data', data => module.readLog(data))
    module.proc.stderr.on('data', data => module.emit('error', data.toString()))

    // Update state when kill has completed and restart if it has already been triggered
    module.proc.on('exit', code => {
      if (code) {
        module.isRunning = false
      } else if (module.isRunning) {
        module.start()
      }

      module.proc = null
      module.emit('exit', code)
    })

    module.proc.on('error', err => {
      module.emit('error', err)
    })

    module.emit('start', params)
  }

  module.stop = signal => {
    module.isRunning = false

    // Start killing child process
    if (module.proc) {
      module.proc.kill(signal)
    }
  }

  // Ensure miner is stopped once process closes
  process.on('exit', () => {
    if (module.proc) {
      module.proc.kill()
    }
  })

  return module
}
