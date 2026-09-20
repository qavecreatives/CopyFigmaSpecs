const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const formatterPath = path.join(root, 'formatters.js')
const pluginPath = path.join(root, 'code.js')
const formatters = fs.readFileSync(formatterPath, 'utf8').replace(/^export\s+/gm, '')
const plugin = fs.readFileSync(pluginPath, 'utf8').replace(/^import .*?;\s*/m, '')
const bridge = `const { buildSnapshot, formatHtmlCss } = (() => {\n${formatters}\nreturn { buildSnapshot, formatHtmlCss };\n})();\n`
fs.writeFileSync(pluginPath, `${bridge}${plugin}`)