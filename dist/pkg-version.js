"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchVersion = exports.VERSION_REGEXP = void 0;
const fs = require("fs");
exports.VERSION_REGEXP = /(\d+\.\d+\.\d+)/;
function getVersion() {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    return matchVersion(pkg.version);
}
exports.default = getVersion;
function matchVersion(version) {
    const ma = version.match(exports.VERSION_REGEXP);
    if (null === ma)
        throw new Error(`Bad version string`);
    return ma[1];
}
exports.matchVersion = matchVersion;
//# sourceMappingURL=pkg-version.js.map