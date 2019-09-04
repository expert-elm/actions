import * as fs from 'fs'

export default function getVersion(): string {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  const re = /(\d+\.\d+\.\d+)/
  const ma = pkg.version.match(re)
  if(null === ma) throw new Error(`Bad version string`)
  return ma[1]
}