import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync, existsSync } from 'fs'

function getProjectInputs(): Record<string, string> {
  const projectsDir = resolve(__dirname, 'projects')
  if (!existsSync(projectsDir)) return {}
  return readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .reduce((inputs, dir) => {
      const htmlPath = resolve(projectsDir, dir.name, 'index.html')
      if (existsSync(htmlPath)) {
        inputs[`project-${dir.name}`] = htmlPath
      }
      return inputs
    }, {} as Record<string, string>)
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...getProjectInputs(),
      },
    },
  },
})
