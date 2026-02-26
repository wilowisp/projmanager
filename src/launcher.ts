import './styles/launcher.css'
import { generateId } from './utils/uuid'

interface ProjectMeta {
  id: string
  name: string
  description: string
  updatedAt: string
  path: string
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function getStoredProjects(): ProjectMeta[] {
  const raw = localStorage.getItem('pm_launcher_projects')
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function saveProjects(projects: ProjectMeta[]): void {
  localStorage.setItem('pm_launcher_projects', JSON.stringify(projects))
}

function syncFromLocalStorage(projects: ProjectMeta[]): ProjectMeta[] {
  const ids = new Set(projects.map(p => p.id))
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!
    if (!key.startsWith('pm_project_')) continue
    const id = key.replace('pm_project_', '')
    if (ids.has(id)) continue
    try {
      const data = JSON.parse(localStorage.getItem(key)!)
      projects.push({
        id,
        name: data.name ?? id,
        description: data.description ?? '',
        updatedAt: data.updatedAt ?? new Date().toISOString(),
        path: projectPath(id),
      })
      ids.add(id)
    } catch { /* ignore */ }
  }
  return projects
}

// All projects are served via the deployed demo page with ?p= routing
function projectPath(id: string): string {
  return `${import.meta.env.BASE_URL}projects/demo/?p=${id}`
}

// ─── Export / Import helpers ──────────────────────────────────────────────────

function exportAllProjects(): void {
  const projects = syncFromLocalStorage(getStoredProjects())
  const allData = projects.map(p => {
    const raw = localStorage.getItem(`pm_project_${p.id}`)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }).filter(Boolean)

  if (allData.length === 0) {
    alert('내보낼 프로젝트가 없습니다.')
    return
  }

  const bundle = {
    _type: 'pm-all-projects',
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: allData,
  }
  downloadJSON(bundle, `all-projects-${today()}.json`)
}

function importProjects(json: string): number {
  const data = JSON.parse(json)
  let count = 0

  if (data._type === 'pm-all-projects' && Array.isArray(data.projects)) {
    data.projects.forEach((p: { id?: string }) => {
      if (p?.id) { localStorage.setItem(`pm_project_${p.id}`, JSON.stringify(p)); count++ }
    })
  } else if (data.id) {
    // Single project
    localStorage.setItem(`pm_project_${data.id}`, JSON.stringify(data))
    count = 1
  }

  if (count > 0) {
    localStorage.removeItem('pm_launcher_projects') // Force rescan
  }
  return count
}

function downloadJSON(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(): void {
  let projects = syncFromLocalStorage(getStoredProjects())
  saveProjects(projects)

  const root = document.getElementById('root')!
  root.innerHTML = `
    <div class="launcher">
      <header class="launcher-header">
        <div class="launcher-logo">📋</div>
        <h1>Project Manager</h1>
        <p class="launcher-sub">간트 차트 · 업무 의존관계 · 크리티컬 패스 · 서버 불필요</p>
        <p class="launcher-hint">
          데이터는 <strong>이 브라우저에만</strong> 저장됩니다.<br>
          다른 기기로 옮기려면 <strong>내보내기(JSON)</strong>를 사용하세요.
        </p>
      </header>

      <div class="launcher-toolbar">
        <button class="btn btn-primary" id="btn-new">＋ 새 프로젝트</button>
        <div class="launcher-toolbar-gap"></div>
        <button class="btn btn-ghost" id="btn-import-all" title="JSON 파일에서 프로젝트 가져오기">📥 가져오기</button>
        <button class="btn btn-ghost" id="btn-export-all" title="모든 프로젝트를 JSON 파일로 내보내기">📤 전체 내보내기</button>
      </div>

      <div class="project-grid" id="project-grid">
        ${projects.length === 0
          ? '<p class="empty-msg">프로젝트가 없습니다. <strong>새 프로젝트</strong>를 만들어보세요!</p>'
          : projects.map(p => renderProjectCard(p)).join('')}
      </div>
    </div>
  `

  document.getElementById('btn-new')?.addEventListener('click', () => showNewProjectDialog())

  document.getElementById('btn-export-all')?.addEventListener('click', exportAllProjects)

  document.getElementById('btn-import-all')?.addEventListener('click', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const count = importProjects(reader.result as string)
          if (count > 0) {
            render()
            alert(`${count}개 프로젝트를 가져왔습니다.`)
          } else {
            alert('가져올 수 있는 프로젝트 데이터가 없습니다.')
          }
        } catch {
          alert('올바른 JSON 파일이 아닙니다.')
        }
      }
      reader.readAsText(file)
    })
    input.click()
  })

  document.querySelectorAll<HTMLElement>('.project-card').forEach(card => {
    card.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('.card-delete')) return
      window.location.href = card.dataset.path!
    })
  })

  document.querySelectorAll<HTMLElement>('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset.id!
      if (!confirm('이 프로젝트를 브라우저에서 삭제할까요?')) return
      localStorage.removeItem(`pm_project_${id}`)
      projects = projects.filter(p => p.id !== id)
      saveProjects(projects)
      render()
    })
  })
}

function renderProjectCard(p: ProjectMeta): string {
  const updated = new Date(p.updatedAt).toLocaleDateString('ko-KR')
  return `
    <div class="project-card" data-path="${escHtml(projectPath(p.id))}" data-id="${p.id}">
      <div class="card-icon">📁</div>
      <div class="card-info">
        <h2 class="card-name">${escHtml(p.name)}</h2>
        <p class="card-desc">${escHtml(p.description || '설명 없음')}</p>
        <span class="card-meta">수정: ${updated}</span>
      </div>
      <div class="card-actions">
        <button class="card-export btn btn-ghost" data-id="${p.id}" title="이 프로젝트 내보내기">📤</button>
        <button class="card-delete btn btn-ghost" data-id="${p.id}" title="삭제">✕</button>
      </div>
    </div>
  `
}

// ─── New Project Dialog ───────────────────────────────────────────────────────

function showNewProjectDialog(): void {
  const dialog = document.createElement('div')
  dialog.className = 'new-project-overlay'
  dialog.innerHTML = `
    <div class="new-project-dialog">
      <h2>새 프로젝트</h2>
      <div class="form-group">
        <label>프로젝트 이름</label>
        <input id="np-name" class="form-input" type="text" placeholder="예: 2026 연간 계획" autofocus />
      </div>
      <div class="form-group">
        <label>설명 (선택)</label>
        <input id="np-desc" class="form-input" type="text" placeholder="간단한 설명" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="np-ok">만들기</button>
        <button class="btn btn-ghost" id="np-cancel">취소</button>
      </div>
    </div>
  `

  document.body.append(dialog)
  const nameInput = dialog.querySelector<HTMLInputElement>('#np-name')!
  nameInput.focus()

  const create = () => {
    const name = nameInput.value.trim()
    if (!name) { nameInput.focus(); return }
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '') || generateId()
    const desc = (dialog.querySelector<HTMLInputElement>('#np-desc')!).value.trim()

    // Create empty project in localStorage
    const today2 = new Date().toISOString().split('T')[0]
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    const projData = {
      id, name, description: desc,
      startDate: today2, endDate: nextYear,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [], milestones: [],
      settings: { workingDays: [false,true,true,true,true,true,false], holidays: [], defaultZoom: 'month' },
    }
    localStorage.setItem(`pm_project_${id}`, JSON.stringify(projData))

    // Update launcher list
    const projects = syncFromLocalStorage(getStoredProjects())
    if (!projects.some(p => p.id === id)) {
      projects.push({ id, name, description: desc, updatedAt: projData.updatedAt, path: projectPath(id) })
    }
    saveProjects(projects)
    dialog.remove()

    // Navigate to the project via the universal app page
    window.location.href = projectPath(id)
  }

  dialog.querySelector('#np-ok')!.addEventListener('click', create)
  dialog.querySelector('#np-cancel')!.addEventListener('click', () => dialog.remove())
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') dialog.remove() })
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove() })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

render()

// Wire up per-card export buttons (after render)
document.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.card-export')
  if (!btn) return
  e.stopPropagation()
  const id = btn.dataset.id!
  const raw = localStorage.getItem(`pm_project_${id}`)
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    downloadJSON(data, `${id}-${today()}.json`)
  } catch { alert('내보내기 실패') }
})
