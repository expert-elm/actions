/**
 * Release version from tag
 */
import * as GitHub from '@actions/github';
declare type GH = ReturnType<typeof GitHub.getOctokit>['rest'];
export default function main(): Promise<void>;
export declare function createRelease(gh: GH, version: string, name?: string, body?: string): Promise<void>;
export declare function createPullRequest(gh: GH, version: string): Promise<void>;
export declare function deleteBranch(gh: GH): Promise<void>;
export declare function createRef(gh: GH, version: string): Promise<void>;
export {};
//# sourceMappingURL=release-tag.d.ts.map