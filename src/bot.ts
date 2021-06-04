/**
 * bot
 */

// import path from 'path'
import * as fs from 'fs'
import * as core from '@actions/core'
// import { exec } from '@actions/exec'
import * as github from '@actions/github'
import { IssueCommentEvent, PullRequest, User } from '@octokit/webhooks-definitions/schema'
import * as yargs from 'yargs-parser'
import * as semver from 'semver'
import * as io from '@actions/io'

const GITHUB_TOKEN = process.env['GITHUB_TOKEN']!
const GITHUB_OWNER = process.env['GITHUB_ACTOR']!
const GITHUB_REPOSITORY = process.env['GITHUB_REPOSITORY']!
const GITHUB_SHA = process.env['GITHUB_SHA']!

type GitHubAPI = ReturnType<typeof github.getOctokit>['rest']

export default async function main() {
  await io.which('npm', true)
  await io.which('git', true)

  core.info(`owner: ${GITHUB_OWNER}`)
  core.info(`repo: ${GITHUB_REPOSITORY}`)

  const options = {
    matcher: core.getInput('matcher'),
    users: core.getInput('users').split(','),
    report: core.getInput('report'),
  }
  core.info(`options: ${JSON.stringify(options)}`)

  const { action, comment, issue, sender } = github.context.payload as IssueCommentEvent
  if(action !== 'created') return
  if(!check_user(sender, options.users)) return

  const { body, } = comment  
  const content = body.trim()
  core.info(`raw: ${content}`)
  if(!check_content(content, options.matcher)) return

  const gh = github.getOctokit(GITHUB_TOKEN).rest
  const [ owner, repo ] = GITHUB_REPOSITORY!.split('/')
  const report = create_report(gh, owner, repo, issue)

  const parsed = parse(content.replace(options.matcher, ''))
  core.info(`parsed: ${JSON.stringify(parsed)}`)
  
  const context = {
    report,
    gh,
    owner,
    repo,
  }

  switch(parsed.command) {
    case 'echo': return await echo.apply(context, [ parsed.params[0], parsed.options ])
    case 'release': return await release.apply(context, [ parsed.params[0], parsed.options ])
    default: return
  }
}

function check_user(user: User, list: string[]) {
  const trimed_list = list.map(item => item.trim().toLowerCase()).filter(Boolean)
  const username = user.login.toLowerCase()
  core.info(`check user:${username} in list:${trimed_list}`)
  return trimed_list.includes(username)
}

function check_content(content: string, matcher: string) {
  return content.startsWith(matcher)
}

function parse(content: string) {
  const { _, ...options } = yargs(content)
  const command = _.shift()
  return { command, params: _, options }
}

function create_report(gh: GitHubAPI, owner: string, repo: string, issue: IssueCommentEvent['issue']) {  
  return async (content: string) => {
    await gh.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: content.toString()
    })
  }
}

//#region commands
interface Context {
  gh: GitHubAPI,
  owner: string,
  repo: string,
  report: (content: string) => Promise<void>,
}

interface EchoOptions {}
async function echo(this: Context, content: string, _options: EchoOptions) {
  const { report } = this
  await report(content)
}

interface ReleaseOptions {}
/**
 * Release version
 * 
 * @param version 
 * @param _options 
 * @returns 
 */
async function release(this: Context, version: semver.ReleaseType | string = 'patch', _options: ReleaseOptions = {}) {
  const { report, gh, owner, repo } = this
  // const exists = fs.existsSync('package.json')
  // if(!exists) {
  //   await report('package.json not found')
  //   return
  // }

  // const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  // const curr = semver.parse(pkg.version)
  const pkg = await get_pkg()
  if(!pkg) {
    await report('package version parsed failed')
    return
  }
  const curr = pkg.version
  const next = get_next_version(curr)
  if(!next) {
    await report('next version parsed failed')
    return
  }

  const ref = await create_branch(version)
  const branch = get_branch_name(ref.ref)
  const pr = await create_pr(version, branch)
  await update_version(pkg, version, branch)
  await merge_pr(pr)
  await delete_branch(ref.ref)
  await create_release(version)
  

  async function get_pkg() {
    const res = await gh.repos.getContent({
      owner,
      repo,
      path: 'package.json'
    })

    const data = res.data
    if(Array.isArray(data)) return null
    if(data.type !== 'file') return null
    return JSON.parse((data as any).content)
  }

  function get_next_version(curr: semver.SemVer) {
    switch(version) {
      case 'major':
      case 'premajor':
      case 'minor':
      case 'preminor':
      case 'patch':
      case 'prepatch':
      case 'prerelease': {
        return semver.inc(curr, version)
      }
      default: {
        // check: next should gt then curr, use `semver.gt`
        return semver.parse(version)!.format()
      }
    }
  }

  async function create_branch(version: string) {
    const res = await gh.git.createRef({
      owner,
      repo,
      ref: `refs/tags/release_${version}`,
      sha: GITHUB_SHA
    })
    return res.data
  }

  function get_branch_name(ref: string) {
    return ref.replace(/refs\/tags\//, '')
  }

  async function create_pr(version: string, branch: string) {
    const res = await gh.pulls.create({
      owner,
      repo,
      head: branch,
      base: 'master',
      title: `[Release] Version ${version}`,
      body: '',
      maintainer_can_modify: true
    })

    return res.data as PullRequest
  }

  async function merge_pr(pr: PullRequest) {
    await gh.pulls.merge({
      owner,
      repo,
      pull_number: pr.number
    })
  }

  async function update_version(pkg: any, version: string, branch: string) {
    const content = JSON.stringify({ ...pkg, version }, undefined, 2)
    const content_path = 'package.json'
    const message = `release:${version}`

    await gh.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: content_path,
      message,
      content,
      branch
    })
  }

  async function delete_branch(ref: string) {
    await gh.git.deleteRef({
      owner,
      repo,
      ref,
    })
  }

  async function create_release(version: string) {
    await gh.repos.createRelease({
      owner,
      repo,
      tag_name: 'v' + version,
      name: `Release v${version}`,
      body: '',
    })
  }
}
//#endregion

main().catch(error => {
  core.error(error)
  core.setFailed(error.message)
})
