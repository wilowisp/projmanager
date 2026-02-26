import type { Store, SyncStatus } from '../store'
import type { ZoomLevel } from '../types'
import { showToast } from './Modal'
import { loadGitHubSettings } from '../utils/github-api'

export interface ToolbarEvents {
  onAddTask: () => void
  onAddMilestone: () => void
  onZoomChange: (zoom: ZoomLevel) => void
  onToggleCriticalPath: (show: boolean) => void
  onScrollToToday: () => void
  onOpenSettings: () => void
}

const SYNC_ICONS: Record<SyncStatus, string> = {
  idle:    '○',
  syncing: '⟳',
  ok:      '✓',
  error:   '✗',
  offline: '⚡',
}
const SYNC_TITLES: Record<SyncStatus, string> = {
  idle:    'GitHub 미설정 — ⚙ Settings에서 구성',
  syncing: 'GitHub에 저장 중…',
  ok:      'GitHub Pages에 저장됨',
  error:   'GitHub 동기화 실패 — Settings 확인',
  offline: '오프라인 — 로컬에 저장됨',
}

export class Toolbar {
  private el: HTMLElement
  private projectNameEl!: HTMLElement
  private zoomBtns!: NodeListOf<HTMLButtonElement>
  private syncBtn!: HTMLButtonElement

  constructor(private store: Store, private events: ToolbarEvents) {
    this.el = document.createElement('header')
    this.el.className = 'toolbar'
    this.render()
    this.store.onSyncStatus(s => this.updateSyncStatus(s))
  }

  getElement(): HTMLElement { return this.el }

  private render(): void {
    const p = this.store.getProject()
    const ghConfigured = !!loadGitHubSettings()

    this.el.innerHTML = `
      <div class="toolbar-left">
        <div class="project-name-wrap">
          <span class="project-icon">📋</span>
          <h1 class="project-name" contenteditable="true" spellcheck="false">${escHtml(p.name)}</h1>
        </div>
      </div>
      <div class="toolbar-center">
        <button class="btn btn-primary" id="tb-add-task">＋ Task</button>
        <button class="btn btn-ghost" id="tb-add-milestone">◇ Milestone</button>
        <div class="separator"></div>
        <div class="zoom-group" role="group" aria-label="Zoom level">
          <button class="zoom-btn" data-zoom="day">Day</button>
          <button class="zoom-btn" data-zoom="week">Week</button>
          <button class="zoom-btn zoom-btn--active" data-zoom="month">Month</button>
          <button class="zoom-btn" data-zoom="quarter">Quarter</button>
        </div>
        <div class="separator"></div>
        <button class="btn btn-ghost" id="tb-today">Today</button>
        <label class="toggle-label">
          <input type="checkbox" id="tb-critical" />
          <span>Critical</span>
        </label>
      </div>
      <div class="toolbar-right">
        <button class="sync-btn ${ghConfigured ? '' : 'sync-unconfigured'}" id="tb-sync"
          title="${SYNC_TITLES[this.store.getSyncStatus()]}">
          ${SYNC_ICONS[this.store.getSyncStatus()]} GitHub
        </button>
        <div class="separator"></div>
        <button class="btn btn-ghost" id="tb-share" title="이 프로젝트를 JSON으로 내보내기">📤 공유</button>
        <button class="btn btn-ghost" id="tb-import" title="JSON에서 가져오기">📥</button>
        <button class="btn btn-ghost" id="tb-settings" title="Settings">⚙</button>
        <a class="btn btn-ghost" href="${import.meta.env.BASE_URL}" title="모든 프로젝트">⊞</a>
      </div>
    `

    // Project name
    this.projectNameEl = this.el.querySelector('.project-name')!
    this.projectNameEl.addEventListener('blur', () => {
      const name = this.projectNameEl.textContent?.trim() ?? ''
      if (name && name !== this.store.getProject().name) {
        this.store.updateProject({ name })
        document.title = name
      }
    })
    this.projectNameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.projectNameEl.blur() }
    })

    // Toolbar actions
    this.el.querySelector('#tb-add-task')!.addEventListener('click', () => this.events.onAddTask())
    this.el.querySelector('#tb-add-milestone')!.addEventListener('click', () => this.events.onAddMilestone())
    this.el.querySelector('#tb-today')!.addEventListener('click', () => this.events.onScrollToToday())
    this.el.querySelector('#tb-settings')!.addEventListener('click', () => this.events.onOpenSettings())

    // Zoom
    this.zoomBtns = this.el.querySelectorAll<HTMLButtonElement>('.zoom-btn')
    this.zoomBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.zoomBtns.forEach(b => b.classList.remove('zoom-btn--active'))
        btn.classList.add('zoom-btn--active')
        this.events.onZoomChange(btn.dataset.zoom as ZoomLevel)
      })
    })

    // Critical path toggle
    this.el.querySelector<HTMLInputElement>('#tb-critical')!.addEventListener('change', e => {
      this.events.onToggleCriticalPath((e.target as HTMLInputElement).checked)
    })

    // GitHub sync button: manual push; opens settings if not configured
    this.syncBtn = this.el.querySelector<HTMLButtonElement>('#tb-sync')!
    this.syncBtn.addEventListener('click', async () => {
      if (!loadGitHubSettings()) {
        this.events.onOpenSettings()
        return
      }
      const ok = await this.store.syncNow()
      if (!ok) showToast('GitHub 동기화 실패 — Settings 확인', 'error')
      else showToast('GitHub Pages에 저장됨', 'success')
    })

    // Share (export) current project
    this.el.querySelector('#tb-share')!.addEventListener('click', () => {
      const json = this.store.exportJSON()
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${this.store.getProject().id}-${todayStr()}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      showToast('내보내기 완료', 'success')
    })

    // Import project data
    this.el.querySelector('#tb-import')!.addEventListener('click', () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          try {
            this.store.importJSON(reader.result as string)
            showToast('가져오기 완료', 'success')
          } catch {
            showToast('올바른 JSON 파일이 아닙니다', 'error')
          }
        }
        reader.readAsText(file)
      })
      input.click()
    })
  }

  private updateSyncStatus(status: SyncStatus): void {
    if (!this.syncBtn) return
    this.syncBtn.textContent = `${SYNC_ICONS[status]} GitHub`
    this.syncBtn.title = SYNC_TITLES[status]
    this.syncBtn.className = `sync-btn sync-${status}`
    if (status === 'syncing') {
      this.syncBtn.classList.add('spin')
    } else {
      this.syncBtn.classList.remove('spin')
    }
  }

  setZoom(zoom: ZoomLevel): void {
    this.zoomBtns?.forEach(btn => {
      btn.classList.toggle('zoom-btn--active', btn.dataset.zoom === zoom)
    })
  }

  syncProjectName(): void {
    this.projectNameEl.textContent = this.store.getProject().name
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
