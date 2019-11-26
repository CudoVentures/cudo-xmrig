const { Storage } = require('@google-cloud/storage')
const crypto = require('crypto')
const tar = require('tar')
const path = require('path')
const fs = require('fs')

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'cudo-189019'
const signPath = process.env.SIGN_PATH || process.argv[2]
const bucketName = process.env.BUCKET_NAME || `${projectId}_cloudbuild`

if (!signPath) {
  throw new Error('Please specify a sign path')
}

const storage = new Storage()
const bucket = storage.bucket(bucketName)
const pollInterval = 4 * 1000
const pollTimeout = 1000 * 1000 // 10 mins'
let timeoutTimer

const sign = async () => {
  await bucket.getMetadata()

  // unique generate signing id
  const id = crypto.randomBytes(8).toString('hex')
  const platform = 'win'
  console.log(`unique signing id ${id} generated`)

  // generate paths
  const bucketUnsigned = `unsigned/${platform}/${id}.tar`
  const bucketSigned = `signed/${platform}/${id}.tar`
  const workingDir = path.dirname(signPath)
  const signFilename = path.basename(signPath)
  const localTar = path.join(workingDir, `${id}.tar`)

  // compress signing file
  console.log(`compressing into ${localTar}`)
  await tar.c({
    file: localTar,
    cwd: workingDir
  }, [signFilename])

  // upload unsigned file to bucket
  console.log(`uploading ${localTar}`)
  await bucket.upload(localTar, {
    destination: bucketUnsigned,
    resumable: false
  })

  // poll for signed file to appear
  console.log(`waiting for gs://${bucketName}/${bucketSigned} to exist`)
  let signed = false
  while (!signed) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    // load files in id directory of bucket
    const bucketFiles = await bucket.getFiles({
      prefix: bucketSigned
    })

    // check whether any files were found
    if (bucketFiles[0].length > 0) {
      signed = true
    }
  }

  // download resulting file
  console.log(`downloading gs://${bucketName}/${bucketSigned}`)
  await bucket.file(bucketSigned).download({
    destination: localTar
  })

  // decompress local tar
  console.log(`unarchiving to ${workingDir}`)
  await tar.x({
    unlink: true,
    file: localTar,
    cwd: workingDir
  })

  console.log(`cleaning up`)
  fs.unlinkSync(localTar)

  console.log(`signing complete\n`)
  clearTimeout(timeoutTimer)
}
sign()

timeoutTimer = setTimeout(() => {
  console.log(`signing poll timed out after ${pollTimeout}ms`)
  process.exit(0)
}, pollTimeout)

process.on('SIGINT', () => process.exit())
process.on('SIGTERM', () => process.exit())
