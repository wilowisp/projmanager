import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync, existsSync, cpSync } from 'fs'

function getProjectInputs() {
  const projectsDir = resolve(__dirname, 'projects')
  if (!existsSync(projectsDir)) return {}
  const inputs = {}
  for (const dir of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const htmlPath = resolve(projectsDir, dir.name, 'index.html')
    if (existsSync(htmlPath)) {
      inputs[`project-${dir.name}`] = htmlPath
    }
  }
  return inputs
}

// Copy projects/NAME/data.json → dist/projects/NAME/data.json after build.
// Vite only processes HTML entry points; static data files must be copied manually.
function copyProjectDataPlugin() {
  return {
    name: 'copy-project-data',
    closeBundle() {
      const projectsDir = resolve(__dirname, 'projects')
      const distDir = resolve(__dirname, 'dist', 'projects')
      if (!existsSync(projectsDir)) return
      for (const dir of readdirSync(projectsDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue
        const src = resolve(projectsDir, dir.name, 'data.json')
        if (existsSync(src)) {
          cpSync(src, resolve(distDir, dir.name, 'data.json'))
          console.log(`  copied projects/${dir.name}/data.json → dist/`)
        }
      }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [copyProjectDataPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...getProjectInputs(),
      },
    },
  },
})
