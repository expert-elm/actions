/**
 * bot
 */

// import path from 'path'
// import fs from 'fs'
import * as core from '@actions/core'
// import { exec } from '@actions/exec'
import * as github from '@actions/github'
import { IssueCommentEvent, User } from '@octokit/webhooks-definitions/schema'
import * as yargs from 'yargs-parser'
// import io from '@actions/io'

const GITHUB_TOKEN = process.env['GITHUB_TOKEN']!
const GITHUB_OWNER = process.env['GITHUB_ACTOR']!
const GITHUB_REPOSITORY = process.env['GITHUB_REPOSITORY']!

type GitHubAPI = ReturnType<typeof github.getOctokit>['rest']

export default async function main() {
  const options = {
    matcher: core.getInput('matcher'),
    users: core.getInput('users').split(','),
    report: core.getInput('report'),
  }
  core.debug(`options: ${options}`)

  const { action, comment, issue, sender } = github.context.payload as IssueCommentEvent
  if(action !== 'created') return
  if(!check_user(sender, options.users)) return

  const { body, } = comment  
  const content = body.trim()
  if(!check_content(content, options.matcher)) return

  const gh = github.getOctokit(GITHUB_TOKEN, { auth: `token ${GITHUB_TOKEN}` }).rest
  const report = create_report(gh, issue)

  const parsed = parse(content)
  core.debug(`parsed: ${parsed}`)

  switch(parsed.command) {
    case 'echo': return await echo.apply({ report }, [ parsed.params[0], parsed.options ])
    default: return
  }
}

function check_user(user: User, list: string[]) {
  const trimed_list = list.map(item => item.trim().toLowerCase()).filter(Boolean)
  const username = user.login.toLowerCase()
  if(trimed_list.includes(username)) return true
  return false
}

function check_content(content: string, matcher: string) {
  if(!content.startsWith(matcher)) return false
  return true
}

function parse(content: string) {
  const { _, ...options } = yargs(content)
  const command = _.shift()
  return { command, params: _, options }
}

function create_report(gh: GitHubAPI, issue: IssueCommentEvent['issue']) {  
  return async (content: string) => {
    await gh.issues.createComment({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPOSITORY,
      issue_number: issue.number,
      body: content
    })
  }
}

//#region commands
interface Context {
  report: (content: string) => Promise<void>
}

interface EchoOptions {

}

async function echo(this: Context, content: string, _options: EchoOptions) {
  const { report } = this
  await report(content)
}
//#endregion

main().catch(error => {
  core.error(error)
  core.setFailed(error.message)
})
