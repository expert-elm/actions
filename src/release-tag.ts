import * as path from 'path'
import * as fs from 'fs'
import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as GitHub from '@octokit/rest'
import * as io from '@actions/io'
import getExecResult from './exec-result'
import { matchVersion } from './pkg-version'

const TOKEN: string = process.env.GITHUB_TOKEN as string
const REF = process.env.GITHUB_REF!.replace('heads', 'remotes/origin')
const OWNER: string = process.env.GITHUB_ACTOR as string

const DEFAULT_CONTEXT: string = '.'
const DEFAULT_PACKAGES: boolean = true
const DEFAULT_DELETE_BRANCH: boolean = true

const COMMAND_GIT_USER = `git show -s --format='%an' ${REF}`
const COMMAND_GIT_EMAIL = `git show -s --format='%ae' ${REF}`
const COMMAND_GIT_CONFIG_USER = (name: string): string => `git config user.name "${name}"`
const COMMAND_GIT_CONFIG_EMAIL = (email: string): string => `git config user.email "${email}"`
const COMMAND_NPM_VERSION = (version: string): string => `npm version ${version} -m "Release version v${version}"`
const COMMAND_NPM_PUBLISH: string = 'npm publish'

export default async function main() {
  try {
    await io.which('npm', true)
    await io.which('git', true)

    const context = core.getInput('context') || DEFAULT_CONTEXT
    core.debug(`Context: ${context}`)
    const isCurrentContext = context === '.'

    const version = getVersion(REF)
    core.debug(`Version: ${version}`)

    const name = await getExecResult(COMMAND_GIT_USER)
    const email = await getExecResult(COMMAND_GIT_EMAIL)
    await exec(COMMAND_GIT_CONFIG_USER(name))
    await exec(COMMAND_GIT_CONFIG_EMAIL(email))

    await exec(COMMAND_NPM_VERSION(version))
    
    if(!isCurrentContext) copyFileToContext(context)

    const gh = new GitHub({ auth: `token ${TOKEN}` })
    await exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context })
    await createRef(gh, version)
    await createRelease(gh, version, core.getInput('title'), core.getInput('body'))

    await createPullRequest(gh, version)

    const isPublishPackages = core.getInput('packages') || DEFAULT_PACKAGES
    if(isPublishPackages) {
      try {
        configurePackageFiles(context)
        await exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context })
      } catch(e) {
        core.error(e)
      }
    }

    const isDeleteBranch = core.getInput('delete-branch') || DEFAULT_DELETE_BRANCH
    if(isDeleteBranch) {
      try {
        await deleteBranch(gh)
      } catch(e) {
        core.error(e)
      }
    }

  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

async function copyFileToContext(context: string): Promise<void> {
  await io.cp('./package.json', path.join(context, 'package.json'))
  try { 
    await io.cp('./README.md', path.join(context, 'README.md')) 
    await io.cp('./LICENSE', path.join(context, 'LICENSE'))
  } catch(_e) {}
}

function getVersion(ref: string): string {
  assertVersion(ref)
  if(undefined === ref) throw new Error(`Not ref found in process.env`)
  const ver = ref.split('/').pop()
  if(undefined === ver) throw new Error(`Not match version`)
  return matchVersion(ver)
}

function assertVersion(ref: string): void {
  if(!/release/i.test(ref)) throw new Error(`Not release branch`)
}

export async function createRelease(gh: GitHub, version: string, name?: string, body?: string): Promise<void> {
  const [ owner, repo ] = process.env.GITHUB_REPOSITORY!.split('/')
  await gh.repos.createRelease({
    owner,
    repo,
    tag_name: 'v' + version,
    name: name || `Release version v${version}`,
    body
  })
}

export async function createPullRequest(gh: GitHub, version: string): Promise<void> {
  const [ owner, repo ] = process.env.GITHUB_REPOSITORY!.split('/')
  const { data: { number: pull_number } } = await gh.pulls.create({
    owner,
    repo,
    head: 'release/' + version,
    base: 'master',
    title: 'Release version ' + version,
    body: `release version ` + version,
    maintainer_can_modify: true
  })
  await gh.pulls.merge({
    owner,
    repo,
    pull_number
  })
}

export async function deleteBranch(gh: GitHub): Promise<void> {
  const [ owner, repo ] = process.env.GITHUB_REPOSITORY!.split('/')
  await gh.git.deleteRef({
    owner,
    repo,
    ref: REF
  })
}

export async function createRef(gh: GitHub, version: string): Promise<void> {
  const [ owner, repo ] = process.env.GITHUB_REPOSITORY!.split('/')
  await gh.git.createRef({
    owner,
    repo,
    ref: 'refs/tags/v' + version,
    sha: process.env.GITHUB_SHA as string
  })
}

function configurePackageFiles(context: string): void {
  overridePackageConfig(context)
  createNPMConfig(context)
}

function overridePackageConfig(context: string) {
  const pkgPath = path.join(context, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.name = `@${OWNER.toLowerCase()}/${pkg.name}`
  fs.writeFileSync(pkgPath, JSON.stringify(pkg), 'utf-8')
}

function createNPMConfig(context: string) {
  fs.writeFileSync(
    path.join(context, '.npmrc'),
    `\
//npm.pkg.github.com/:_authToken=${TOKEN}
registry=https://npm.pkg.github.com
`,
    'utf-8'
  )
}

main()