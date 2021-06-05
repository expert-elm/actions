/**
 * publish to npm
 */

import * as fs from 'fs'
import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as io from '@actions/io'

const GITHUB_TOKEN = process.env['GITHUB_TOKEN']!
const GITHUB_OWNER = process.env['GITHUB_ACTOR']!
const GITHUB_REPOSITORY = process.env['GITHUB_REPOSITORY']!

export default async function main() {
  await io.which('npm', true)

  core.info(`owner: ${GITHUB_OWNER}`)
  core.info(`repo: ${GITHUB_REPOSITORY}`)

  const options = {
    github_package: core.getInput('github_package'),
  }
  core.info(`options: ${JSON.stringify(options)}`)
  
  exec(`npm publish`)

  if(options.github_package) {
    override_package_name()
    create_npm_config()
    exec(`npm publish`)
  }
}

function override_package_name() {
  const pkg_path = 'package.json'
  const pkg = JSON.parse(fs.readFileSync(pkg_path, 'utf-8'))
  if(pkg.name.startsWith('@')) {
    const splited = pkg.name.split('/')
    pkg.name = `@${GITHUB_OWNER.toLowerCase()}/${splited[1]}`
  }
  else {
    pkg.name = `@${GITHUB_OWNER.toLowerCase()}/${pkg.name}`
  }
  const content = JSON.stringify(pkg, undefined, 2) + '\n'
  fs.writeFileSync(pkg_path, content, 'utf-8')
}


function create_npm_config() {
  const content = `\
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
registry=https://npm.pkg.github.com
`
  fs.writeFileSync('.npmrc', content, 'utf-8')
}

main().catch(error => {
  core.error(error)
  core.setFailed(error.message)
})
