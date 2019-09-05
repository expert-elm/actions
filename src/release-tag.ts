import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as io from '@actions/io'
import * as path from 'path'
import getExecResult from './exec-result'

const DEFAULT_CONTEXT: string = '.'
const COMMAND_GIT_USER = `git show -s --format='%an' ${process.env.GITHUB_REF}`
const COMMAND_GIT_EMAIL = `git show -s --format='%ae' ${process.env.GITHUB_REF}`
const COMMAND_GIT_CONFIG = (name: string, email: string): string => `git config user.email "${email}" && git config user.name "${name}"`
// const COMMAND_GIT_PUSH = (token: string): string => `git -c http.extraheader="AUTHORIZATION: basic ${token}" push origin master`
const COMMAND_NPM_VERSION = (version: string): string => `npm version ${version} -m "Release version v${version}"`
// const COMMAND_NPM_PUBLISH: string = 'npm publish'

export default async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const token = core.getInput('token')
    if(undefined === token) throw new Error(`token was required`)
    core.debug(`Token: ${token}`)

    const context = core.getInput('context') || DEFAULT_CONTEXT
    core.debug(`Context: ${context}`)
    const isCurrentContext = context === '.'

    const version = getVersion()
    core.debug(`Version: ${version}`)

    // const gh = new GitHub({ auth: `token ${token}` })
    // const user = await getUser(gh)
    // core.debug(`User: ${user}`)
    const name = await getExecResult(COMMAND_GIT_USER)
    const email = await getExecResult(COMMAND_GIT_EMAIL)

    await exec(COMMAND_GIT_CONFIG(name, email))
    await exec(COMMAND_NPM_VERSION(version))
    
    if(!isCurrentContext) {
      await io.cp('./package.json', path.join(context, 'package.json'))
      await io.cp('./README.md', path.join(context, 'README.md'))
      await io.cp('./LICENSE', path.join(context, 'LICENSE'))
    }

    // await exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context })
    // await exec(COMMAND_GIT_PUSH(token))
    // await release(gh, version, core.getInput('name'), core.getInput('body'))
  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

export async function getUser(gh: GitHub): Promise<{ name: string, email: string }> {
  const { data: { name, email }} = await gh.users.getAuthenticated()
  return { name, email }
}

function getVersion(): string {
  const ref = process.env.GITHUB_REF
  if(undefined === ref) throw new Error(`Not ref found in process.env`)
  const ver = ref.split('/').pop()
  if(undefined === ver) throw new Error(`Not match version`)
  return ver
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

main()