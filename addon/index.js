const { execFile } = require('child_process')
const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')

const NEWLINE_SEPERATOR = /[\r]{0,1}\n/
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

module.exports = () => {
  const module = new EventEmitter()
  module.isRunning = false
  module.proc = null

  module.parseLog = message => {
    const parts = message.toLowerCase().split(' ').filter(o => o)
    const log = message.split(' ').slice(4).join(' ').trim()

    if (parts[2] === 'speed' && parts[4]) {
      let hashRate = parseFloat(parts[4] || 0) || 0
      return { type: 'hashRate', hashRate }
    }

    return { type: 'log', message: log }
  }

  module.logBuffer = ''
  module.readLog = data => {
    module.logBuffer += data.toString()
    const split = module.logBuffer.split(NEWLINE_SEPERATOR)
    split.forEach(o => {
      const log = module.parseLog(o.replace(ANSI_REGEX, ''))
      module.emit('log', log)
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
      executable = path.resolve(ctx.workloadDir, 'Release', 'xmrig.exe')
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
      '--no-nvml',
      '--no-color',
      '--print-time=1'
    ]

    if (ctx.workloadSettings['threads'] !== undefined) {
      params.push('-t', ctx.workloadSettings['threads'])
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
      module.proc = execFile(executable, params, {
        silent: true,
        env
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
