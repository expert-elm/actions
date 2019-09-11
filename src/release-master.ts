import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as io from '@actions/io'
import getExecResult from './exec-result'
import getVersion from './pkg-version'
import * as path from 'path'
import * as fs from 'fs'

const DEFAULT_CONTEXT: string = '.'
const DEFAULT_TAG: string = 'master'
const DEFAULT_GH_PACKAGE: boolean = true

const OWNER: string = process.env.GITHUB_ACTOR as string
const REGISTRY: string = `https://npm.pkg.github.com/${OWNER}`

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

    const isPublishToPackage = core.getInput('gh-package') || DEFAULT_GH_PACKAGE
    if(!isPublishToPackage) return

    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
    pkg.name = `@${OWNER.toLowerCase()}/${pkg.name}`
    pkg.publishConfig = {}
    pkg.publishConfig.registry = REGISTRY
    fs.writeFileSync(
      path.join(context, 'package.json'),
      JSON.stringify(pkg),
      'utf-8'
    )
    fs.writeFileSync(
      path.join(context, '.npmrc'),
      `//npm.pkg.github.com/:_authToken=${process.env.GITHUB_TOKEN}`,
      'utf-8'
    )
    await exec(`npm login --registry=${REGISTRY}`)
    await exec(`npm publish ${tag ? `--tag ${tag}` : ''}`, undefined, { cwd: context })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()