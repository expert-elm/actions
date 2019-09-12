import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as io from '@actions/io'
import * as path from 'path'
import getExecResult from './exec-result'
import { matchVersion } from './pkg-version'

const DEFAULT_CONTEXT: string = '.'
const GITREF = process.env.GITHUB_REF!.replace('heads', 'remotes/origin')
const COMMAND_GIT_USER = `git show -s --format='%an' ${GITREF}`
const COMMAND_GIT_EMAIL = `git show -s --format='%ae' ${GITREF}`
const COMMAND_GIT_CONFIG_USER = (name: string): string => `git config user.name "${name}"`
const COMMAND_GIT_CONFIG_EMAIL = (email: string): string => `git config user.email "${email}"`
const COMMAND_NPM_VERSION = (version: string): string => `npm version ${version} -m "Release version v${version}"`
// const COMMAND_GIT_PUSH = (token: string, version: string): string => `git -c http.extraheader="AUTHORIZATION: basic ${token}" push origin v${version}`
const COMMAND_NPM_PUBLISH: string = 'npm publish'

export default async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const token = core.getInput('token') || process.env.GITHUB_TOKEN
    if(undefined === token) throw new Error(`token was required`)
    core.debug(`Token: ${token}`)

    const context = core.getInput('context') || DEFAULT_CONTEXT
    core.debug(`Context: ${context}`)
    const isCurrentContext = context === '.'

    const version = getVersion()
    core.debug(`Version: ${version}`)

    const name = await getExecResult(COMMAND_GIT_USER)
    const email = await getExecResult(COMMAND_GIT_EMAIL)
    await exec(COMMAND_GIT_CONFIG_USER(name))
    await exec(COMMAND_GIT_CONFIG_EMAIL(email))

    await exec(COMMAND_NPM_VERSION(version))
    
    if(!isCurrentContext) {
      await io.cp('./package.json', path.join(context, 'package.json'))
      await io.cp('./README.md', path.join(context, 'README.md'))
      await io.cp('./LICENSE', path.join(context, 'LICENSE'))
    }

    const gh = new GitHub({ auth: `token ${token}` })
    await exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context })
    // await exec(COMMAND_GIT_PUSH(token, version))
    await createTag(gh, version)
    await release(gh, version, core.getInput('name'), core.getInput('body'))
  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

function getVersion(): string {
  const ref = GITREF
  if(undefined === ref) throw new Error(`Not ref found in process.env`)
  const ver = ref.split('/').pop()
  if(undefined === ver) throw new Error(`Not match version`)
  return matchVersion(ver)
}

export async function release(gh: GitHub, version: string, name?: string, body?: string): Promise<void> {
  const [ owner, repo ] = process.env.GITHUB_REPOSITORY!.split('/')
  await gh.repos.createRelease({
    owner,
    repo,
    tag_name: version,
    name: name || `Release version v${version}`,
    body
  })
}


export async function createTag(gh: GitHub, version: string): Promise<void> {
  const [ owner, repo ] = process.env.GITHUB_REPOSITORY!.split('/')
  await gh.git.createRef({
    owner,
    repo,
    ref: 'refs/tags/v' + version,
    sha: process.env.GITHUB_SHA as string
  })
}

main()