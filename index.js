import fs from 'fs'
import yaml from 'js-yaml'

export function getConfig(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return yaml.load(content) || {}
  }
  return {}
}
