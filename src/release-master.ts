import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as io from '@actions/io'
import path from 'path'

async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const context = core.getInput('context')
    core.debug(`Context: ${context}`)
    const isCurrentDir = context === '.'

    const currentVersion = exec('npm view . version')
    const currentCommit = exec('git rev-parse --verify --short HEAD')
    exec(`npm --no-git-tag-version version ${currentVersion}-${currentCommit}`)
    
    if(!isCurrentDir) {
      await io.cp('./package.json', path.join(context, 'package.json'))
      await io.cp('./README.md', path.join(context, 'README.md'))
      await io.cp('./LICENSE', path.join(context, 'LICENSE'))
    }

    await exec(`npm publish`, undefined, { cwd: context })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()