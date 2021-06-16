"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const exec_1 = require("@actions/exec");
const io = require("@actions/io");
const exec_result_1 = require("./exec-result");
const pkg_version_1 = require("./pkg-version");
const path = require("path");
const DEFAULT_CONTEXT = '.';
const DEFAULT_TAG = 'master';
async function main() {
    try {
        await io.which('npm', true);
        await io.which('git', true);
        const context = core.getInput('context') || DEFAULT_CONTEXT;
        core.debug(`Context: ${context}`);
        const isCurrentContext = context === '.';
        const currentVersion = pkg_version_1.default();
        core.debug(`Version: ${currentVersion}`);
        const currentCommit = await exec_result_1.default('git rev-parse --verify --short HEAD');
        core.debug(`Commit: ${currentCommit}`);
        await exec_1.exec(`npm --no-git-tag-version version ${currentVersion}-${currentCommit}`);
        if (!isCurrentContext) {
            await io.cp('./package.json', path.join(context, 'package.json'));
            await io.cp('./README.md', path.join(context, 'README.md'));
            await io.cp('./LICENSE', path.join(context, 'LICENSE'));
        }
        const tag = core.getInput('tag') || DEFAULT_TAG;
        core.debug(`Tag: ${tag}`);
        await exec_1.exec(`npm publish ${tag ? `--tag ${tag}` : ''}`, undefined, { cwd: context });
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
exports.default = main;
main();
//# sourceMappingURL=release-master.js.map