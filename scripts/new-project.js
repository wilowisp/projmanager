#!/usr/bin/env node
/**
 * Create a new project folder.
 * Usage: node scripts/new-project.js <project-name>
 *
 * This creates:
 *   projects/<name>/index.html   — the project page
 *   projects/<name>/data.json    — empty project data
 *
 * After running this:
 *   1. npm run build
 *   2. git add projects/<name> && git commit && git push
 *   3. GitHub Actions will deploy to: https://<user>.github.io/<repo>/projects/<name>/
 */

const { existsSync, mkdirSync, writeFileSync } = require('fs')
const { resolve, join } = require('path')

const name = process.argv[2]
if (!name) {
  console.error('Usage: node scripts/new-project.js <project-name>')
  process.exit(1)
}

const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
if (!id) {
  console.error('Invalid project name. Use letters, numbers, and hyphens.')
  process.exit(1)
}

const root = resolve(__dirname, '..')
const dir = join(root, 'projects', id)

if (existsSync(dir)) {
  console.error(`Project "${id}" already exists at projects/${id}/`)
  process.exit(1)
}

mkdirSync(dir, { recursive: true })

// ── index.html ────────────────────────────────────────────────────────────────
writeFileSync(join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="pm-project-id" content="${id}" />
  <title>${name}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`)

// ── data.json ─────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]
const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]

const data = {
  id,
  name,
  description: '',
  startDate: today,
  endDate: nextYear,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tasks: [],
  milestones: [],
  settings: {
    workingDays: [false, true, true, true, true, true, false],
    holidays: [],
    defaultZoom: 'month',
  },
}

writeFileSync(join(dir, 'data.json'), JSON.stringify(data, null, 2))

console.log(`\n✅ Project "${name}" created!\n`)
console.log(`   Folder : projects/${id}/`)
console.log(`   Dev URL: http://localhost:5173/projects/${id}/`)
console.log(`\nNext steps:`)
console.log(`   1. npm run dev  — view at http://localhost:5173/projects/${id}/`)
console.log(`   2. git add projects/${id} && git commit -m "Add project: ${name}"`)
console.log(`   3. git push  — GitHub Actions deploys automatically\n`)
