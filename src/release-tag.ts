import * as core from '@actions/core'
import { exec } from '@actions/exec'
import getExecResult from './exec-result'
import * as io from '@actions/io'
import * as path from 'path'

const DEFAULT_CONTEXT: string = '.'
const COMMAND_GIT_LAST_TAG: string = 'git tag --sort=v:refname | tail -n1'
const COMMAND_GIT_CHECKOUT: string = 'git checkout'
const COMMAND_NPM_VERSION: string = 'npm --no-git-tag-version version from-git'
const COMMAND_NPM_PUBLISH: string = 'npm publish'

export default async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const context = core.getInput('context') || DEFAULT_CONTEXT
    core.debug(`Context: ${context}`)
    const isCurrentContext = context === '.'

    const tag = await getExecResult(COMMAND_GIT_LAST_TAG)
    await exec(COMMAND_GIT_CHECKOUT + ' ' + tag)
    await exec(COMMAND_NPM_VERSION)
    
    if(!isCurrentContext) {
      await io.cp('./package.json', path.join(context, 'package.json'))
      await io.cp('./README.md', path.join(context, 'README.md'))
      await io.cp('./LICENSE', path.join(context, 'LICENSE'))
    }

    await exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()