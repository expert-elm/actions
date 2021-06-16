"use strict";
/**
 * bot
 */
Object.defineProperty(exports, "__esModule", { value: true });
// import path from 'path'
const fs = require("fs");
const core = require("@actions/core");
const exec_1 = require("@actions/exec");
const github = require("@actions/github");
const yargs = require("yargs-parser");
const semver = require("semver");
const io = require("@actions/io");
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'];
const GITHUB_OWNER = process.env['GITHUB_ACTOR'];
const GITHUB_REPOSITORY = process.env['GITHUB_REPOSITORY'];
const GITHUB_SHA = process.env['GITHUB_SHA'];
const NODE_AUTH_TOKEN = process.env['NODE_AUTH_TOKEN'];
async function main() {
    await io.which('npm', true);
    await io.which('git', true);
    core.info(`owner: ${GITHUB_OWNER}`);
    core.info(`repo: ${GITHUB_REPOSITORY}`);
    const options = {
        matcher: core.getInput('matcher'),
        users: core.getInput('users').split(','),
        report: core.getInput('report'),
    };
    core.info(`options: ${JSON.stringify(options)}`);
    const { action, comment, issue, sender } = github.context.payload;
    if (action !== 'created')
        return;
    if (!check_user(sender, options.users))
        return;
    const { body, } = comment;
    const content = body.trim();
    core.info(`raw: ${content}`);
    if (!check_content(content, options.matcher))
        return;
    const gh = github.getOctokit(GITHUB_TOKEN).rest;
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    const report = create_report(gh, owner, repo, issue);
    const parsed = parse(content.replace(options.matcher, ''));
    core.info(`parsed: ${JSON.stringify(parsed)}`);
    const context = {
        report,
        gh,
        owner,
        repo,
    };
    switch (parsed.command) {
        case 'echo': return await echo.apply(context, [parsed.params[0], parsed.options]);
        case 'release': return await release.apply(context, [parsed.params[0], parsed.options]);
        default: fallback(parsed.command);
    }
}
exports.default = main;
function check_user(user, list) {
    const trimed_list = list.map(item => item.trim().toLowerCase()).filter(Boolean);
    const username = user.login.toLowerCase();
    core.info(`check user:${username} in list:${trimed_list}`);
    return trimed_list.includes(username);
}
function check_content(content, matcher) {
    return content.startsWith(matcher);
}
function parse(content) {
    const { _, ...options } = yargs(content);
    const command = _.shift();
    return { command, params: _, options };
}
function create_report(gh, owner, repo, issue) {
    return async (content) => {
        await gh.issues.createComment({
            owner,
            repo,
            issue_number: issue.number,
            body: content.toString()
        });
    };
}
function fallback(command) {
    if (command) {
        core.info(`unknown command ${command}`);
    }
    else {
        core.info(`no command`);
    }
}
async function echo(content, _options) {
    const { report } = this;
    await report(content);
}
/**
 * Release version
 *
 * @param version
 * @param _options
 * @returns
 */
async function release(version = 'patch', options = {}) {
    const { report, gh, owner, repo } = this;
    core.info(`release owner: ${owner}`);
    core.info(`release repo: ${repo}`);
    const [pkg, pkg_sha] = await get_pkg();
    if (!pkg) {
        await report('package version parsed failed');
        return;
    }
    const curr = pkg.version;
    const next = get_next_version(curr);
    if (!next) {
        await report('next version parsed failed');
        return;
    }
    const ref = await create_branch(next);
    const branch = get_branch_name(ref.ref);
    await update_version(pkg, next, branch, pkg_sha);
    const pr = await create_pr(next, branch);
    await merge_pr(pr);
    await delete_branch(ref.ref);
    await create_release(next);
    await build();
    await publish_to_npm();
    await publish_to_github();
    async function get_pkg() {
        const res = await gh.repos.getContent({
            owner,
            repo,
            path: 'package.json'
        });
        const data = res.data;
        if (Array.isArray(data))
            return [null, ''];
        if (data.type !== 'file')
            return [null, ''];
        const content = data.content;
        return [JSON.parse(Buffer.from(content, 'base64').toString('utf-8')), data.sha];
    }
    function get_next_version(curr) {
        switch (version) {
            case 'major':
            case 'premajor':
            case 'minor':
            case 'preminor':
            case 'patch':
            case 'prepatch':
            case 'prerelease': {
                return semver.inc(curr, version);
            }
            default: {
                // check: next should gt then curr, use `semver.gt`
                return semver.parse(version).format();
            }
        }
    }
    async function create_branch(version) {
        const res = await gh.git.createRef({
            owner,
            repo,
            ref: `refs/heads/release-${version}`,
            sha: GITHUB_SHA
        });
        return res.data;
    }
    function get_branch_name(ref) {
        return ref.replace(/refs\/heads\//, '');
    }
    async function create_pr(version, branch) {
        const res = await gh.pulls.create({
            owner,
            repo,
            head: branch,
            base: 'master',
            title: `[Release] v${version}`,
            body: '',
            maintainer_can_modify: true
        });
        return res.data;
    }
    async function merge_pr(pr) {
        await gh.pulls.merge({
            owner,
            repo,
            pull_number: pr.number
        });
    }
    async function update_version(pkg, version, branch, sha) {
        const pkg_content = JSON.stringify({ ...pkg, version }, undefined, 2) + '\n';
        const content = Buffer.from(pkg_content).toString('base64');
        const content_path = 'package.json';
        const message = `release:${version}`;
        await gh.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: content_path,
            message,
            content,
            branch,
            sha,
        });
        fs.writeFileSync('package.json', pkg_content, 'utf-8');
    }
    async function delete_branch(ref) {
        await gh.git.deleteRef({
            owner,
            repo,
            ref: ref.replace(/refs\//, ''),
        });
    }
    async function create_release(version) {
        await gh.repos.createRelease({
            owner,
            repo,
            tag_name: 'v' + version,
            name: `v${version}`,
            body: '',
        });
    }
    /**
     * run build
     */
    async function build() {
        if (undefined === options.build || 'boolean' === typeof options.build) {
            if (false === options.build) {
                return;
            }
            if (pkg.scripts && pkg.scripts.build) {
                return await exec_1.exec(`npm run build`);
            }
            return;
        }
        else if ('string' === typeof options.build) {
            return await exec_1.exec(options.build);
        }
        else
            return;
    }
    async function publish_to_npm() {
        create_npm_config();
        return await exec_1.exec(`npm publish ${options['dry-run'] ? '--dry-run' : ''}`);
    }
    async function publish_to_github() {
        override_package_name();
        create_github_config();
        await exec_1.exec(`npm publish ${options['dry-run'] ? '--dry-run' : ''}`);
    }
    function override_package_name() {
        const pkg_path = 'package.json';
        const pkg = JSON.parse(fs.readFileSync(pkg_path, 'utf-8'));
        if (pkg.name.startsWith('@')) {
            const splited = pkg.name.split('/');
            pkg.name = `@${owner.toLowerCase()}/${splited[1]}`;
        }
        else {
            pkg.name = `@${owner.toLowerCase()}/${pkg.name}`;
        }
        const content = JSON.stringify(pkg, undefined, 2) + '\n';
        fs.writeFileSync(pkg_path, content, 'utf-8');
    }
    function create_npm_config() {
        const content = `\
  //registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
  registry=https://registry.npmjs.org
  `;
        fs.writeFileSync('.npmrc', content, 'utf-8');
    }
    function create_github_config() {
        const content = `\
  //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
  registry=https://npm.pkg.github.com
  `;
        fs.writeFileSync('.npmrc', content, 'utf-8');
    }
}
//#endregion
main().catch(error => {
    core.error(error);
    core.setFailed(error.message);
});
//# sourceMappingURL=bot.js.map