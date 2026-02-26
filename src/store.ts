import type {
  ProjectData, Task, Milestone, ProjectSettings,
  StoreEvent, CPMResult, ZoomLevel,
} from './types'
import { generateId } from './utils/uuid'
import { parseDate, formatDate, addDays, calendarDuration, todayISO } from './utils/dates'
import { rebuildWbs, findByWbs, parsePredecessorToken } from './utils/wbs'
import { computeCriticalPath } from './utils/critical-path'
import {
  loadGitHubSettings, deriveFilePath,
  readFromGitHub, writeToGitHub, type GitHubSettings,
} from './utils/github-api'

// ─── EventEmitter ─────────────────────────────────────────────────────────────

type Listener = (event: StoreEvent) => void

class EventEmitter {
  private listeners: Listener[] = []
  on(fn: Listener): () => void {
    this.listeners.push(fn)
    return () => { this.listeners = this.listeners.filter(l => l !== fn) }
  }
  emit(event: StoreEvent): void {
    this.listeners.forEach(l => l(event))
  }
}

// ─── Default Project ──────────────────────────────────────────────────────────

function defaultProject(id: string): ProjectData {
  const today = todayISO()
  const nextYear = formatDate(addDays(parseDate(today), 364))
  return {
    id,
    name: id,
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
}

// ─── Sync state ────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'

// ─── Store ────────────────────────────────────────────────────────────────────

export class Store extends EventEmitter {
  private data!: ProjectData
  private cpm!: CPMResult
  readonly projectId: string
  private syncStatus: SyncStatus = 'idle'
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private onSyncStatusChange: ((s: SyncStatus) => void) | null = null
  private githubFilePath: string | null = null

  constructor(projectId: string) {
    super()
    this.projectId = projectId
    this.loadFromLocalStorage()
    this.rebuildCPM()
  }

  onSyncStatus(fn: (s: SyncStatus) => void): void {
    this.onSyncStatusChange = fn
  }

  private setSyncStatus(s: SyncStatus): void {
    this.syncStatus = s
    this.onSyncStatusChange?.(s)
  }

  getSyncStatus(): SyncStatus { return this.syncStatus }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private storageKey(): string {
    return `pm_project_${this.projectId}`
  }

  private loadFromLocalStorage(): void {
    const raw = localStorage.getItem(this.storageKey())
    if (raw) {
      try {
        this.data = JSON.parse(raw) as ProjectData
        return
      } catch { /* fall through */ }
    }
    this.data = defaultProject(this.projectId)
    this.saveLocal()
  }

  private saveLocal(): void {
    this.data.updatedAt = new Date().toISOString()
    localStorage.setItem(this.storageKey(), JSON.stringify(this.data))
  }

  /**
   * Load data on app start.
   * Priority: GitHub API (freshest) → static data.json → localStorage
   */
  async initialLoad(): Promise<void> {
    const gh = loadGitHubSettings()
    if (gh) {
      this.githubFilePath = deriveFilePath(gh)
      // Try GitHub API first (always fresh)
      this.setSyncStatus('syncing')
      const remote = await readFromGitHub<ProjectData>(gh, this.githubFilePath)
      if (remote) {
        // Use remote if it's newer than local
        const localUpdated = new Date(this.data.updatedAt).getTime()
        const remoteUpdated = new Date(remote.updatedAt).getTime()
        if (remoteUpdated >= localUpdated) {
          this.data = remote
          this.saveLocal()
          this.rebuildCPM()
          this.emit({ type: 'data:load' })
        }
        this.setSyncStatus('ok')
        return
      }
      this.setSyncStatus('error')
    }

    // Fallback: static data.json from GitHub Pages URL
    const hasLocal = !!localStorage.getItem(this.storageKey())
    if (!hasLocal) {
      await this.loadFromStaticUrl('./data.json')
    }
  }

  private async loadFromStaticUrl(url: string): Promise<void> {
    try {
      const res = await fetch(url)
      if (!res.ok) return
      const json = (await res.json()) as ProjectData
      this.data = json
      this.saveLocal()
      this.rebuildCPM()
      this.emit({ type: 'data:load' })
    } catch { /* offline or no data.json */ }
  }

  /** Schedule a debounced sync to GitHub (300ms after last change) */
  private scheduleSyncToGitHub(): void {
    const gh = loadGitHubSettings()
    if (!gh || !this.githubFilePath) return
    if (this.syncTimer) clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => void this.pushToGitHub(gh), 1500)
  }

  private async pushToGitHub(gh: GitHubSettings): Promise<void> {
    if (!this.githubFilePath) return
    this.setSyncStatus('syncing')
    const json = JSON.stringify(this.data, null, 2)
    const ok = await writeToGitHub(gh, this.githubFilePath, json)
    this.setSyncStatus(ok ? 'ok' : 'error')
  }

  /** Manually trigger a sync (e.g. from toolbar button) */
  async syncNow(): Promise<boolean> {
    const gh = loadGitHubSettings()
    if (!gh) return false
    if (!this.githubFilePath) this.githubFilePath = deriveFilePath(gh)
    this.setSyncStatus('syncing')
    const json = JSON.stringify(this.data, null, 2)
    const ok = await writeToGitHub(gh, this.githubFilePath, json)
    this.setSyncStatus(ok ? 'ok' : 'error')
    return ok
  }

  /** Call after saving, to persist and schedule GitHub sync */
  private save(): void {
    this.saveLocal()
    this.scheduleSyncToGitHub()
  }

  exportJSON(): string {
    return JSON.stringify(this.data, null, 2)
  }

  importJSON(json: string): void {
    const parsed = JSON.parse(json) as ProjectData
    this.data = parsed
    this.save()
    this.rebuildCPM()
    this.emit({ type: 'data:load' })
  }

  // ── Project ──────────────────────────────────────────────────────────────────

  getProject(): ProjectData { return this.data }

  updateProject(patch: Partial<ProjectData>): void {
    Object.assign(this.data, patch)
    this.save()
    this.emit({ type: 'project:update', payload: patch })
  }

  getSettings(): ProjectSettings { return this.data.settings }

  updateSettings(patch: Partial<ProjectSettings>): void {
    Object.assign(this.data.settings, patch)
    this.save()
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  getTasks(): Task[] { return this.data.tasks }

  getVisibleTasks(): Task[] {
    const tasks = this.data.tasks
    const hidden = new Set<string>()
    tasks.forEach(t => {
      if (t.collapsed) {
        this.getDescendants(t.id).forEach(d => hidden.add(d.id))
      }
    })
    return tasks.filter(t => !hidden.has(t.id))
  }

  getTask(id: string): Task | undefined {
    return this.data.tasks.find(t => t.id === id)
  }

  addTask(after?: string, parentId?: string): Task {
    const today = todayISO()
    const newTask: Task = {
      id: generateId(),
      wbs: '',
      title: 'New Task',
      assignee: '',
      status: 'not_started',
      priority: 'medium',
      startDate: today,
      endDate: formatDate(addDays(parseDate(today), 4)),
      duration: 5,
      progress: 0,
      predecessors: [],
      parentId: parentId ?? null,
      collapsed: false,
      color: null,
      notes: '',
      isMilestone: false,
    }
    if (after) {
      const idx = this.data.tasks.findIndex(t => t.id === after)
      if (idx >= 0) { this.data.tasks.splice(idx + 1, 0, newTask) }
      else this.data.tasks.push(newTask)
    } else {
      this.data.tasks.push(newTask)
    }
    rebuildWbs(this.data.tasks)
    this.save()
    this.rebuildCPM()
    this.emit({ type: 'task:add', payload: newTask })
    return newTask
  }

  updateTask(id: string, patch: Partial<Task>): void {
    const task = this.getTask(id)
    if (!task) return
    Object.assign(task, patch)
    if (patch.startDate !== undefined || patch.endDate !== undefined) {
      if (patch.endDate === undefined) {
        task.endDate = formatDate(addDays(parseDate(task.startDate), task.duration - 1))
      } else if (patch.startDate === undefined) {
        task.duration = calendarDuration(task.startDate, task.endDate)
      } else {
        task.duration = calendarDuration(task.startDate, task.endDate)
      }
    } else if (patch.duration !== undefined) {
      task.endDate = formatDate(addDays(parseDate(task.startDate), task.duration - 1))
    }
    this.updateSummaryTask(task.parentId)
    rebuildWbs(this.data.tasks)
    this.save()
    this.rebuildCPM()
    this.emit({ type: 'task:update', payload: task })
  }

  deleteTask(id: string): void {
    const toDelete = new Set([id, ...this.getDescendants(id).map(t => t.id)])
    this.data.tasks.forEach(t => {
      t.predecessors = t.predecessors.filter(p => !toDelete.has(p.taskId))
    })
    this.data.tasks = this.data.tasks.filter(t => !toDelete.has(t.id))
    rebuildWbs(this.data.tasks)
    this.save()
    this.rebuildCPM()
    this.emit({ type: 'task:delete', payload: id })
  }

  indentTask(id: string): void {
    const idx = this.data.tasks.findIndex(t => t.id === id)
    if (idx <= 0) return
    const task = this.data.tasks[idx]
    for (let i = idx - 1; i >= 0; i--) {
      if (this.data.tasks[i].parentId === task.parentId) {
        task.parentId = this.data.tasks[i].id
        break
      }
    }
    rebuildWbs(this.data.tasks)
    this.save()
    this.emit({ type: 'task:reorder', payload: this.data.tasks })
  }

  outdentTask(id: string): void {
    const task = this.getTask(id)
    if (!task || !task.parentId) return
    const parent = this.getTask(task.parentId)
    task.parentId = parent?.parentId ?? null
    rebuildWbs(this.data.tasks)
    this.save()
    this.emit({ type: 'task:reorder', payload: this.data.tasks })
  }

  moveTask(id: string, afterId: string | null): void {
    const fromIdx = this.data.tasks.findIndex(t => t.id === id)
    if (fromIdx < 0) return
    const [task] = this.data.tasks.splice(fromIdx, 1)
    if (afterId === null) this.data.tasks.unshift(task)
    else {
      const toIdx = this.data.tasks.findIndex(t => t.id === afterId)
      this.data.tasks.splice(toIdx + 1, 0, task)
    }
    rebuildWbs(this.data.tasks)
    this.save()
    this.emit({ type: 'task:reorder', payload: this.data.tasks })
  }

  toggleCollapse(id: string): void {
    const task = this.getTask(id)
    if (!task) return
    task.collapsed = !task.collapsed
    this.save()
    this.emit({ type: 'task:update', payload: task })
  }

  setPredecessorsFromString(taskId: string, raw: string): void {
    const task = this.getTask(taskId)
    if (!task) return
    const preds: Task['predecessors'] = []
    raw.split(',').forEach(token => {
      const parsed = parsePredecessorToken(token)
      if (!parsed) return
      const found = findByWbs(this.data.tasks, parsed.wbs)
      if (found && found.id !== taskId) {
        preds.push({ taskId: found.id, type: parsed.type as Task['predecessors'][0]['type'], lag: parsed.lag })
      }
    })
    task.predecessors = preds
    this.save()
    this.rebuildCPM()
    this.emit({ type: 'task:update', payload: task })
  }

  // ── Milestones ────────────────────────────────────────────────────────────────

  getMilestones(): Milestone[] { return this.data.milestones }

  addMilestone(title: string, date: string): Milestone {
    const m: Milestone = { id: generateId(), title, date, color: '#F39C12', taskIds: [] }
    this.data.milestones.push(m)
    this.save()
    return m
  }

  deleteMilestone(id: string): void {
    this.data.milestones = this.data.milestones.filter(m => m.id !== id)
    this.save()
  }

  // ── CPM ───────────────────────────────────────────────────────────────────────

  getCPM(): CPMResult { return this.cpm }

  private rebuildCPM(): void {
    this.cpm = computeCriticalPath(this.data.tasks, this.data.startDate)
  }

  isCritical(taskId: string): boolean {
    return this.cpm.get(taskId)?.isCritical ?? false
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  getDescendants(id: string): Task[] {
    const children = this.data.tasks.filter(t => t.parentId === id)
    return children.flatMap(c => [c, ...this.getDescendants(c.id)])
  }

  getDepth(task: Task): number {
    let d = 0
    let t: Task | undefined = task
    while (t?.parentId) { d++; t = this.getTask(t.parentId) }
    return d
  }

  isSummary(id: string): boolean {
    return this.data.tasks.some(t => t.parentId === id)
  }

  private updateSummaryTask(parentId: string | null): void {
    if (!parentId) return
    const parent = this.getTask(parentId)
    if (!parent) return
    const children = this.data.tasks.filter(t => t.parentId === parentId)
    if (children.length === 0) return
    const starts = children.map(c => parseDate(c.startDate))
    const ends = children.map(c => parseDate(c.endDate))
    const minStart = new Date(Math.min(...starts.map(d => d.getTime())))
    const maxEnd = new Date(Math.max(...ends.map(d => d.getTime())))
    parent.startDate = formatDate(minStart)
    parent.endDate = formatDate(maxEnd)
    parent.duration = calendarDuration(parent.startDate, parent.endDate)
    parent.progress = Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length)
    this.updateSummaryTask(parent.parentId)
  }

  getDefaultZoom(): ZoomLevel { return this.data.settings.defaultZoom }
}
