/**
 * bot
 */

 // import path from 'path'
 // import fs from 'fs'
 import core from '@actions/core'
 // import { exec } from '@actions/exec'
 import github from '@actions/github'
 // import io from '@actions/io'


 export default async function main() {
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`)
 }

 main().catch(error => {
  core.error(error)
  core.setFailed(error.message)
})
