import * as fs from 'fs'

export const VERSION_REGEXP: RegExp = /(\d+\.\d+\.\d+)/

export default function getVersion(): string {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  return matchVersion(pkg.version)
}

export function matchVersion(version: string): string {
  const ma = version.match(VERSION_REGEXP)
  if(null === ma) throw new Error(`Bad version string`)
  return ma[1]
}