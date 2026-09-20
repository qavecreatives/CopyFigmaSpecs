const assert = require('node:assert/strict')
const test = require('node:test')
const { formatHtmlCss, formatHtml, formatCss } = require('../formatters.js')

const root = {
  name: 'Button / Primary',
  type: 'FRAME',
  width: 240,
  height: 56,
  layoutMode: 'HORIZONTAL',
  layoutWrap: 'NO_WRAP',
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
  itemSpacing: 16,
  paddingTop: 12,
  paddingRight: 20,
  paddingBottom: 12,
  paddingLeft: 20,
  fills: [{ color: '#1A1A1A', opacity: 1 }],
  cornerRadius: 12,
  children: [
    { name: 'Label', type: 'TEXT', characters: 'Copy', fontFamily: 'Space Grotesk', fontStyle: 'Medium', fontSize: 14, fontWeight: 500, children: [] },
    { name: 'Icon', type: 'VECTOR', children: [] },
    { name: 'Icon', type: 'VECTOR', children: [] },
  ],
}

test('formats nested HTML with stable sanitized classes', () => {
  const html = formatHtml(root)
  assert.match(html, /<div class="button-primary">/)
  assert.match(html, /<span class="label">Copy<\/span>/)
  assert.match(html, /class="icon"/)
  assert.match(html, /class="icon-2"/)
  assert.ok(html.indexOf('button-primary') < html.indexOf('label'))
})

test('formats direct CSS equivalents and omits unsupported values', () => {
  const css = formatCss(root)
  assert.match(css, /display: flex;/)
  assert.match(css, /flex-direction: row;/)
  assert.match(css, /gap: 16px;/)
  assert.match(css, /padding: 12px 20px;/)
  assert.match(css, /background: #1A1A1A;/)
  assert.match(css, /border-radius: 12px;/)
  assert.match(css, /font-family: "Space Grotesk";/)
  assert.match(css, /font-size: 14px;/)
  assert.match(css, /font-weight: 500;/)
  assert.doesNotMatch(css, /layoutSizingHorizontal/)
})

test('combines HTML before CSS and exposes independent sections', () => {
  const output = formatHtmlCss(root)
  assert.equal(output.combined, `${output.html}\n\n${output.css}`)
  assert.ok(output.combined.indexOf('<!-- HTML -->') < output.combined.indexOf('/* CSS */'))
})