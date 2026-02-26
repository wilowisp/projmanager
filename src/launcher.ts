import './styles/launcher.css'
import { generateId } from './utils/uuid'

interface ProjectMeta {
  id: string
  name: string
  description: string
  updatedAt: string
  path: string
}

function getStoredProjects(): ProjectMeta[] {
  const raw = localStorage.getItem('pm_launcher_projects')
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function saveProjects(projects: ProjectMeta[]): void {
  localStorage.setItem('pm_launcher_projects', JSON.stringify(projects))
}

function syncFromLocalStorage(projects: ProjectMeta[]): ProjectMeta[] {
  // Also find any projects stored directly (pm_project_* keys)
  const ids = new Set(projects.map(p => p.id))
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!
    if (key.startsWith('pm_project_')) {
      const id = key.replace('pm_project_', '')
      if (!ids.has(id)) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!)
          projects.push({
            id,
            name: data.name ?? id,
            description: data.description ?? '',
            updatedAt: data.updatedAt ?? new Date().toISOString(),
            path: `projects/${id}/`,
          })
          ids.add(id)
        } catch { /* ignore */ }
      }
    }
  }
  return projects
}

function render(): void {
  let projects = syncFromLocalStorage(getStoredProjects())
  saveProjects(projects)

  const root = document.getElementById('root')!
  root.innerHTML = `
    <div class="launcher">
      <header class="launcher-header">
        <div class="launcher-logo">📋</div>
        <h1>Project Manager</h1>
        <p class="launcher-sub">GitHub Pages · Gantt · MS Project Dependencies · No Server Required</p>
        <p class="launcher-hint">
          Data is stored in your browser and synced to <strong>GitHub Pages</strong> via the GitHub API.<br>
          Open a project → click <strong>⚙ Settings</strong> to configure your GitHub token once.
        </p>
      </header>

      <div class="launcher-toolbar">
        <button class="btn btn-primary" id="btn-new">＋ New Project</button>
      </div>

      <div class="project-grid" id="project-grid">
        ${projects.length === 0 ? '<p class="empty-msg">No projects yet. Create your first project!</p>' : ''}
        ${projects.map(p => renderProjectCard(p)).join('')}
      </div>
    </div>
  `

  document.getElementById('btn-new')?.addEventListener('click', () => showNewProjectDialog())

  document.querySelectorAll<HTMLElement>('.project-card').forEach(card => {
    card.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('.card-delete')) return
      const path = card.dataset.path!
      window.location.href = path
    })
  })

  document.querySelectorAll<HTMLElement>('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset.id!
      if (!confirm('Delete this project from browser storage? (The folder on GitHub will remain)')) return
      localStorage.removeItem(`pm_project_${id}`)
      projects = projects.filter(p => p.id !== id)
      saveProjects(projects)
      render()
    })
  })
}

function renderProjectCard(p: ProjectMeta): string {
  const updated = new Date(p.updatedAt).toLocaleDateString()
  return `
    <div class="project-card" data-path="${p.path}" data-id="${p.id}">
      <div class="card-icon">📁</div>
      <div class="card-info">
        <h2 class="card-name">${escHtml(p.name)}</h2>
        <p class="card-desc">${escHtml(p.description || 'No description')}</p>
        <span class="card-meta">Updated ${updated}</span>
      </div>
      <button class="card-delete btn btn-ghost" data-id="${p.id}" title="Remove from list">✕</button>
    </div>
  `
}

function showNewProjectDialog(): void {
  const dialog = document.createElement('div')
  dialog.className = 'new-project-overlay'
  dialog.innerHTML = `
    <div class="new-project-dialog">
      <h2>New Project</h2>
      <div class="form-group">
        <label>Project Name</label>
        <input id="np-name" class="form-input" type="text" placeholder="My Project" autofocus />
      </div>
      <div class="form-group">
        <label>Description (optional)</label>
        <input id="np-desc" class="form-input" type="text" placeholder="Short description" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="np-ok">Create</button>
        <button class="btn btn-ghost" id="np-cancel">Cancel</button>
      </div>
      <p class="np-note">💡 Project data is saved in your browser. Run <code>npm run new-project &lt;name&gt;</code> to create a deployable folder.</p>
    </div>
  `

  document.body.append(dialog)
  const nameInput = dialog.querySelector<HTMLInputElement>('#np-name')!
  nameInput.focus()

  const create = () => {
    const name = nameInput.value.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || generateId()
    const desc = (dialog.querySelector<HTMLInputElement>('#np-desc')!).value.trim()

    // Create project in localStorage
    const today = new Date().toISOString().split('T')[0]
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    const projData = {
      id, name, description: desc,
      startDate: today, endDate: nextYear,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [], milestones: [],
      settings: { workingDays: [false,true,true,true,true,true,false], holidays: [], defaultZoom: 'month' },
    }
    localStorage.setItem(`pm_project_${id}`, JSON.stringify(projData))

    // Register in launcher
    const projects = syncFromLocalStorage(getStoredProjects())
    projects.push({ id, name, description: desc, updatedAt: new Date().toISOString(), path: `projects/${id}/` })
    saveProjects(projects)

    dialog.remove()
    // Navigate to the new project path (will show the app if the folder exists, or show the 404 from GitHub Pages)
    // For dev server, we navigate — the project app will auto-load from localStorage
    window.location.href = `projects/${id}/`
  }

  dialog.querySelector('#np-ok')!.addEventListener('click', create)
  dialog.querySelector('#np-cancel')!.addEventListener('click', () => dialog.remove())
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') dialog.remove() })
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove() })
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

render()
