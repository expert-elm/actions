import core from '@actions/core'
import { exec } from '@actions/exec'
import io from '@actions/io'
import getExecResult from './exec-result'
import getVersion from './pkg-version'
import path from 'path'

const DEFAULT_CONTEXT: string = '.'
const DEFAULT_TAG: string = 'master'

export default async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const context = core.getInput('context') || DEFAULT_CONTEXT
    core.debug(`Context: ${context}`)
    const isCurrentContext = context === '.'

    const currentVersion = getVersion()
    core.debug(`Version: ${currentVersion}`)

    const currentCommit = await getExecResult('git rev-parse --verify --short HEAD')
    core.debug(`Commit: ${currentCommit}`)
    await exec(`npm --no-git-tag-version version ${currentVersion}-${currentCommit}`)
    
    if(!isCurrentContext) {
      await io.cp('./package.json', path.join(context, 'package.json'))
      await io.cp('./README.md', path.join(context, 'README.md'))
      await io.cp('./LICENSE', path.join(context, 'LICENSE'))
    }

    const tag = core.getInput('tag') || DEFAULT_TAG
    core.debug(`Tag: ${tag}`)

    await exec(`npm publish ${tag ? `--tag ${tag}` : ''}`, undefined, { cwd: context })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()