import './styles/app.css'
import { Store } from './store'
import { Toolbar } from './components/Toolbar'
import { TaskTable } from './components/TaskTable'
import { GanttChart } from './components/GanttChart'
import { Modal, showToast } from './components/Modal'
import { openSettingsModal } from './components/SettingsModal'
import { todayISO } from './utils/dates'
import type { ZoomLevel } from './types'

// ─── Determine Project ID ─────────────────────────────────────────────────────
// Priority: URL ?p=<id> param > meta tag (for backward compat with deployed folders)

function getProjectId(): string | null {
  const urlParam = new URLSearchParams(window.location.search).get('p')
  if (urlParam) return urlParam
  return document.querySelector<HTMLMetaElement>('meta[name="pm-project-id"]')?.content ?? null
}

// ─── Main App ─────────────────────────────────────────────────────────────────

async function initApp(): Promise<void> {
  const urlParam = new URLSearchParams(window.location.search).get('p')
  const projectId = getProjectId()
  if (!projectId) return  // Launcher page

  const store = new Store(projectId)

  // Skip static data.json fallback for URL-param projects (user-created, no deployed data.json)
  const skipStaticLoad = !!urlParam && urlParam !== 'demo'
  await store.initialLoad(skipStaticLoad)

  document.title = store.getProject().name

  const root = document.getElementById('root')!
  root.className = 'app-root'

  let currentZoom: ZoomLevel = store.getDefaultZoom()

  const toolbar = new Toolbar(store, {
    onAddTask() {
      const lastId = store.getVisibleTasks().at(-1)?.id
      const newTask = store.addTask(lastId)
      table.setSelected(newTask.id)
      gantt.setSelected(newTask.id)
    },
    onAddMilestone() { openMilestoneModal() },
    onZoomChange(zoom) {
      currentZoom = zoom
      gantt.setZoom(zoom)
    },
    onToggleCriticalPath(show) {
      gantt.setShowCritical(show)
    },
    onScrollToToday() { gantt.scrollToToday() },
    onOpenSettings() { openSettingsModal(store) },
  })

  const table = new TaskTable(store)
  const gantt = new GanttChart(store)

  // Cross-selection sync
  table.onSelect(id => gantt.setSelected(id))
  gantt.onSelect(id => table.setSelected(id))

  // ── DOM structure ─────────────────────────────────────────────────────────

  const content = document.createElement('div')
  content.className = 'content-area'

  const leftPanel = document.createElement('div')
  leftPanel.id = 'left-panel'
  leftPanel.className = 'left-panel'
  leftPanel.append(table.getElement())

  const divider = document.createElement('div')
  divider.className = 'panel-divider'
  divider.title = 'Drag to resize'

  const rightPanel = document.createElement('div')
  rightPanel.id = 'right-panel'
  rightPanel.className = 'right-panel'
  rightPanel.append(gantt.getElement())

  content.append(leftPanel, divider, rightPanel)
  root.append(toolbar.getElement(), content)

  // ── Vertical scroll sync ──────────────────────────────────────────────────

  const tableWrap = leftPanel.querySelector<HTMLElement>('.task-table-wrap')!
  const ganttBodyWrap = rightPanel.querySelector<HTMLElement>('.gantt-body-wrap')!
  let syncLock = false

  tableWrap.addEventListener('scroll', () => {
    if (syncLock) return
    syncLock = true
    ganttBodyWrap.scrollTop = tableWrap.scrollTop
    syncLock = false
  })
  ganttBodyWrap.addEventListener('scroll', () => {
    if (syncLock) return
    syncLock = true
    tableWrap.scrollTop = ganttBodyWrap.scrollTop
    syncLock = false
  })

  // ── Resizable divider ─────────────────────────────────────────────────────

  let resizing = false
  let resizeStartX = 0
  let resizeStartW = 0

  divider.addEventListener('mousedown', e => {
    resizing = true
    resizeStartX = e.clientX
    resizeStartW = leftPanel.getBoundingClientRect().width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', e => {
    if (!resizing) return
    const newW = Math.max(200, Math.min(
      resizeStartW + (e.clientX - resizeStartX),
      window.innerWidth - 300,
    ))
    leftPanel.style.width = `${newW}px`
    leftPanel.style.flex = 'none'
  })

  document.addEventListener('mouseup', () => {
    if (resizing) {
      resizing = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  })

  // ── Store events ──────────────────────────────────────────────────────────

  store.on(event => {
    if (event.type === 'project:update') {
      toolbar.syncProjectName()
      document.title = store.getProject().name
    }
    if (event.type === 'data:load') {
      toolbar.syncProjectName()
      document.title = store.getProject().name
      gantt.setZoom(currentZoom)
    }
  })

  // ── Milestone modal ────────────────────────────────────────────────────────

  function openMilestoneModal(): void {
    const modal = new Modal('Add Milestone')
    const form = document.createElement('div')
    form.innerHTML = `
      <div class="form-group">
        <label>Title</label>
        <input id="ms-title" class="form-input" type="text" placeholder="Milestone name" />
      </div>
      <div class="form-group">
        <label>Date</label>
        <input id="ms-date" class="form-input" type="date" value="${todayISO()}" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="ms-ok">Add</button>
        <button class="btn btn-ghost" id="ms-cancel">Cancel</button>
      </div>
    `
    form.querySelector('#ms-ok')!.addEventListener('click', () => {
      const title = (form.querySelector('#ms-title') as HTMLInputElement).value.trim()
      const date = (form.querySelector('#ms-date') as HTMLInputElement).value
      if (!title) { showToast('Enter a title', 'error'); return }
      store.addMilestone(title, date)
      modal.close()
      showToast('Milestone added', 'success')
    })
    form.querySelector('#ms-cancel')!.addEventListener('click', () => modal.close())
    modal.setContent(form)
    modal.open()
    ;(form.querySelector('#ms-title') as HTMLInputElement).focus()
  }

  gantt.setZoom(currentZoom)
  toolbar.setZoom(currentZoom)
}

initApp()
