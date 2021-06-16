"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const exec_1 = require("@actions/exec");
async function getExecResult(commandLine, args, options) {
    let result = '';
    await exec_1.exec(commandLine, args, {
        ...options,
        listeners: {
            stdout: (data) => {
                result += data.toString();
            }
        }
    });
    return result.trim();
}
exports.default = getExecResult;
//# sourceMappingURL=exec-result.js.map