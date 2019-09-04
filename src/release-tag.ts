import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as io from '@actions/io'
import * as path from 'path'

const DEFAULT_CONTEXT: string = '.'
const COMMAND_GIT_CONFIG = (name: string, email: string): string => `git config user.email "${email}" && git config user.name "${name}"`
const COMMAND_GIT_PUSH: string = `git -c http.extraheader="AUTHORIZATION: basic ${process.env.GITHUB_TOKEN}" push origin master`
const COMMAND_NPM_VERSION = (version: string): string => `npm version ${version} -m "Release version v${version}"`
const COMMAND_NPM_PUBLISH: string = 'npm publish'

export default async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const context = core.getInput('context') || DEFAULT_CONTEXT
    core.debug(`Context: ${context}`)
    const isCurrentContext = context === '.'

    const version = getVersion()

    const gh = new GitHub({ auth: () => `token ${process.env.GITHUB_TOKEN}` })
    const user = await getUser(gh)
    await exec(COMMAND_GIT_CONFIG(user.name, user.email))
    await exec(COMMAND_NPM_VERSION(version))
    
    if(!isCurrentContext) {
      await io.cp('./package.json', path.join(context, 'package.json'))
      await io.cp('./README.md', path.join(context, 'README.md'))
      await io.cp('./LICENSE', path.join(context, 'LICENSE'))
    }

    await exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context })
    await exec(COMMAND_GIT_PUSH)
    await release(gh, version, core.getInput('name'), core.getInput('body'))
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getUser(gh: GitHub): Promise<{ name: string, email: string }> {
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

async function release(gh: GitHub, version: string, name?: string, body?: string): Promise<void> {
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