"use strict";
/**
 * Release version from tag
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRef = exports.deleteBranch = exports.createPullRequest = exports.createRelease = void 0;
const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const exec_1 = require("@actions/exec");
const GitHub = require("@actions/github");
const io = require("@actions/io");
const exec_result_1 = require("./exec-result");
const pkg_version_1 = require("./pkg-version");
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'];
const GITHUB_REF = process.env['GITHUB_REF'].replace('heads', 'remotes/origin');
const GITHUB_OWNER = process.env['GITHUB_ACTOR'];
const GITHUB_REPOSITORY = process.env['GITHUB_REPOSITORY'];
const DEFAULT_CONTEXT = '.';
const DEFAULT_PACKAGES = true;
const DEFAULT_DELETE_BRANCH = true;
const COMMAND_GIT_USER = `git show -s --format='%an' ${GITHUB_REF}`;
const COMMAND_GIT_EMAIL = `git show -s --format='%ae' ${GITHUB_REF}`;
const COMMAND_GIT_CONFIG_USER = (name) => `git config user.name "${name}"`;
const COMMAND_GIT_CONFIG_EMAIL = (email) => `git config user.email "${email}"`;
const COMMAND_NPM_VERSION = (version) => `npm version ${version} -m "Release version v${version}"`;
const COMMAND_NPM_PUBLISH = 'npm publish';
async function main() {
    await io.which('npm', true);
    await io.which('git', true);
    const context = core.getInput('context') || DEFAULT_CONTEXT;
    core.debug(`Context: ${context}`);
    const isCurrentContext = context === '.';
    const version = getVersion(GITHUB_REF);
    core.debug(`Version: ${version}`);
    const name = await exec_result_1.default(COMMAND_GIT_USER);
    const email = await exec_result_1.default(COMMAND_GIT_EMAIL);
    await exec_1.exec(COMMAND_GIT_CONFIG_USER(name));
    await exec_1.exec(COMMAND_GIT_CONFIG_EMAIL(email));
    await exec_1.exec(COMMAND_NPM_VERSION(version));
    if (!isCurrentContext)
        copyFileToContext(context);
    const gh = GitHub.getOctokit(GITHUB_TOKEN, { auth: `token ${GITHUB_TOKEN}` }).rest;
    await exec_1.exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context });
    await createRef(gh, version);
    await createRelease(gh, version, core.getInput('title'), core.getInput('body'));
    try {
        await createPullRequest(gh, version);
    }
    catch (e) {
        core.error(e);
    }
    const isPublishPackages = core.getInput('packages') || DEFAULT_PACKAGES;
    if (isPublishPackages) {
        try {
            configurePackageFiles(context);
            await exec_1.exec(COMMAND_NPM_PUBLISH, undefined, { cwd: context });
        }
        catch (e) {
            core.error(e);
        }
    }
    const isDeleteBranch = core.getInput('delete-branch') || DEFAULT_DELETE_BRANCH;
    if (isDeleteBranch) {
        try {
            await deleteBranch(gh);
        }
        catch (e) {
            core.error(e);
        }
    }
}
exports.default = main;
async function copyFileToContext(context) {
    await io.cp('./package.json', path.join(context, 'package.json'));
    try {
        await io.cp('./README.md', path.join(context, 'README.md'));
        await io.cp('./LICENSE', path.join(context, 'LICENSE'));
    }
    catch (_e) { }
}
function getVersion(ref) {
    assertVersion(ref);
    if (undefined === ref)
        throw new Error(`Not ref found in process.env`);
    const ver = ref.split('/').pop();
    if (undefined === ver)
        throw new Error(`Not match version`);
    return pkg_version_1.matchVersion(ver);
}
function assertVersion(ref) {
    if (!/release/i.test(ref))
        throw new Error(`Not release branch`);
}
async function createRelease(gh, version, name, body = '') {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    await gh.repos.createRelease({
        owner,
        repo,
        tag_name: 'v' + version,
        name: name || `Release version v${version}`,
        body
    });
}
exports.createRelease = createRelease;
async function createPullRequest(gh, version) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const { data: { number: pull_number } } = await gh.pulls.create({
        owner,
        repo,
        head: 'release/' + version,
        base: 'master',
        title: 'Release version ' + version,
        body: `release version ` + version,
        maintainer_can_modify: true
    });
    await gh.pulls.merge({
        owner,
        repo,
        pull_number
    });
}
exports.createPullRequest = createPullRequest;
async function deleteBranch(gh) {
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    await gh.git.deleteRef({
        owner,
        repo,
        ref: GITHUB_REF
    });
}
exports.deleteBranch = deleteBranch;
async function createRef(gh, version) {
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    await gh.git.createRef({
        owner,
        repo,
        ref: 'refs/tags/v' + version,
        sha: process.env.GITHUB_SHA
    });
}
exports.createRef = createRef;
function configurePackageFiles(context) {
    overridePackageConfig(context);
    create_npm_config(context);
}
function overridePackageConfig(context) {
    const pkgPath = path.join(context, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.name = `@${GITHUB_OWNER.toLowerCase()}/${pkg.name}`;
    const content = JSON.stringify(pkg);
    console.log(content);
    fs.writeFileSync(pkgPath, content, 'utf-8');
}
function create_npm_config(context) {
    const content = `\
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
registry=https://npm.pkg.github.com
`;
    console.log(content);
    fs.writeFileSync(path.join(context, '.npmrc'), content, 'utf-8');
}
main().catch(error => {
    core.error(error);
    core.setFailed(error.message);
});
//# sourceMappingURL=release-tag.js.map