import type { Store } from '../store'
import type { Task } from '../types'
import { serializePredecessors } from '../utils/wbs'
import { showConfirm } from './Modal'
import { DatePicker } from './DatePicker'
import { PredSelector, AssigneeSelector } from './TaskSelector'

const STATUS_LABELS: Record<Task['status'], string> = {
  not_started: '○',
  in_progress: '▶',
  done: '✓',
  cancelled: '✗',
  on_hold: '‖',
}
const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: '#6c757d',
  medium: '#0d6efd',
  high: '#fd7e14',
  critical: '#dc3545',
}

// Singleton pickers — only one open at a time
const datePicker = { instance: null as DatePicker | null }
const predSelector = new PredSelector()
const assigneeSelector = new AssigneeSelector()

export class TaskTable {
  private el: HTMLElement
  private tbody!: HTMLElement
  private selectedId: string | null = null
  private onSelectCallback: ((id: string | null) => void) | null = null
  private dragSrc: string | null = null

  constructor(private store: Store) {
    this.el = document.createElement('div')
    this.el.className = 'task-table-wrap'
    this.build()
    this.listenStore()
  }

  getElement(): HTMLElement { return this.el }

  onSelect(fn: (id: string | null) => void): void { this.onSelectCallback = fn }

  setSelected(id: string | null): void {
    this.selectedId = id
    this.el.querySelectorAll<HTMLElement>('.task-row').forEach(row =>
      row.classList.toggle('selected', row.dataset.id === id))
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private build(): void {
    this.el.innerHTML = `
      <table class="task-table" cellspacing="0">
        <thead>
          <tr>
            <th class="col-wbs">WBS</th>
            <th class="col-name">Task Name</th>
            <th class="col-dur">Dur</th>
            <th class="col-start">Start</th>
            <th class="col-end">End</th>
            <th class="col-pct">%</th>
            <th class="col-pred">Pred</th>
            <th class="col-assign">Assignee</th>
            <th class="col-status">St</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody class="task-tbody"></tbody>
      </table>
    `
    this.tbody = this.el.querySelector('.task-tbody')!
    this.renderRows()
    this.setupKeyboard()
  }

  private renderRows(): void {
    const tasks = this.store.getVisibleTasks()
    this.tbody.innerHTML = ''
    tasks.forEach(task => this.tbody.append(this.buildRow(task)))
    this.restoreSelection()
  }

  private buildRow(task: Task): HTMLElement {
    const cpm = this.store.getCPM().get(task.id)
    const isCritical = cpm?.isCritical ?? false
    const isSum = this.store.isSummary(task.id)
    const depth = this.store.getDepth(task)
    const predStr = serializePredecessors(task.predecessors, this.store.getTasks())
    const indentPx = depth * 18 + 4

    const tr = document.createElement('tr')
    tr.className = `task-row${isCritical ? ' critical' : ''}${isSum ? ' summary' : ''}${task.isMilestone ? ' milestone-row' : ''}`
    tr.dataset.id = task.id
    tr.draggable = true

    tr.innerHTML = `
      <td class="col-wbs"><span class="wbs-num">${task.wbs}</span></td>
      <td class="col-name">
        <div class="task-name-cell" style="padding-left:${indentPx}px">
          ${isSum
            ? `<button class="collapse-btn" data-id="${task.id}">${task.collapsed ? '▶' : '▼'}</button>`
            : '<span class="collapse-spacer"></span>'}
          ${task.isMilestone ? '<span class="milestone-icon">◇</span>' : ''}
          <span class="priority-dot" style="background:${PRIORITY_COLORS[task.priority]}" title="${task.priority}"></span>
          <span class="task-title editable" data-field="title">${escHtml(task.title)}</span>
        </div>
      </td>
      <td class="col-dur"><span class="editable" data-field="duration">${task.duration}</span></td>
      <td class="col-start">
        <span class="editable date-cell" data-field="startDate">${task.startDate}</span>
      </td>
      <td class="col-end">
        <span class="editable date-cell" data-field="endDate">${task.endDate}</span>
      </td>
      <td class="col-pct">
        <div class="progress-cell">
          <div class="progress-bar-mini" style="width:${task.progress}%"></div>
          <span class="editable" data-field="progress">${task.progress}</span>
        </div>
      </td>
      <td class="col-pred">
        <span class="editable picker-cell pred-cell" data-field="predecessors">${predStr || '—'}</span>
      </td>
      <td class="col-assign">
        <span class="editable picker-cell" data-field="assignee">${escHtml(task.assignee) || '—'}</span>
      </td>
      <td class="col-status">
        <button class="status-btn" data-id="${task.id}" title="${task.status}">${STATUS_LABELS[task.status]}</button>
      </td>
      <td class="col-actions">
        <button class="act-btn add-after" data-id="${task.id}" title="Add task below">＋</button>
        <button class="act-btn delete-btn" data-id="${task.id}" title="Delete">✕</button>
        <button class="act-btn indent-btn" data-id="${task.id}" title="Indent">→</button>
        <button class="act-btn outdent-btn" data-id="${task.id}" title="Outdent">←</button>
      </td>
    `

    // ── Row selection ──────────────────────────────────────────────────────
    tr.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('button,.editable')) return
      this.selectRow(task.id)
    })

    // ── Cell interactions ──────────────────────────────────────────────────
    tr.querySelectorAll<HTMLElement>('.editable').forEach(cell => {
      const field = cell.dataset.field as keyof Task

      if (field === 'startDate' || field === 'endDate') {
        // Single-click → date picker
        cell.addEventListener('click', e => {
          e.stopPropagation()
          this.selectRow(task.id)
          this.openDatePicker(cell, task, field)
        })
      } else if (field === 'predecessors') {
        // Single-click → predecessor selector
        cell.addEventListener('click', e => {
          e.stopPropagation()
          this.selectRow(task.id)
          this.openPredSelector(cell, task)
        })
      } else if (field === 'assignee') {
        // Single-click → assignee selector
        cell.addEventListener('click', e => {
          e.stopPropagation()
          this.selectRow(task.id)
          this.openAssigneeSelector(cell, task)
        })
      } else {
        // Double-click → inline text edit
        cell.addEventListener('dblclick', () => this.startEdit(cell, task))
        cell.addEventListener('keydown', e => {
          if (e.key === 'F2') { e.preventDefault(); this.startEdit(cell, task) }
        })
      }
    })

    // ── Action buttons ─────────────────────────────────────────────────────
    tr.querySelector('.add-after')?.addEventListener('click', e => {
      e.stopPropagation(); this.store.addTask(task.id)
    })
    tr.querySelector('.delete-btn')?.addEventListener('click', async e => {
      e.stopPropagation()
      if (await showConfirm(`Delete "${task.title}"?`)) this.store.deleteTask(task.id)
    })
    tr.querySelector('.indent-btn')?.addEventListener('click', e => {
      e.stopPropagation(); this.store.indentTask(task.id)
    })
    tr.querySelector('.outdent-btn')?.addEventListener('click', e => {
      e.stopPropagation(); this.store.outdentTask(task.id)
    })
    tr.querySelector('.collapse-btn')?.addEventListener('click', e => {
      e.stopPropagation(); this.store.toggleCollapse(task.id)
    })
    tr.querySelector('.status-btn')?.addEventListener('click', e => {
      e.stopPropagation()
      const statuses: Task['status'][] = ['not_started','in_progress','done','on_hold','cancelled']
      const next = statuses[(statuses.indexOf(task.status) + 1) % statuses.length]
      this.store.updateTask(task.id, { status: next })
    })

    // ── Drag-to-reorder ────────────────────────────────────────────────────
    tr.addEventListener('dragstart', () => { this.dragSrc = task.id; tr.classList.add('dragging') })
    tr.addEventListener('dragend',   () => tr.classList.remove('dragging'))
    tr.addEventListener('dragover',  e => e.preventDefault())
    tr.addEventListener('drop', e => {
      e.preventDefault()
      if (this.dragSrc && this.dragSrc !== task.id) {
        this.store.moveTask(this.dragSrc, task.id)
        this.dragSrc = null
      }
    })

    return tr
  }

  // ── Date Picker ───────────────────────────────────────────────────────────

  private openDatePicker(cell: HTMLElement, task: Task, field: 'startDate' | 'endDate'): void {
    datePicker.instance?.close()
    const current = field === 'startDate' ? task.startDate : task.endDate
    const dp = new DatePicker(current, (date: string) => {
      if (date) this.store.updateTask(task.id, { [field]: date })
    })
    datePicker.instance = dp
    dp.show(cell)
  }

  // ── Pred Selector ─────────────────────────────────────────────────────────

  private openPredSelector(cell: HTMLElement, task: Task): void {
    predSelector.close()
    predSelector.show(cell, this.store, task.id, (raw: string) => {
      this.store.setPredecessorsFromString(task.id, raw)
    })
  }

  // ── Assignee Selector ─────────────────────────────────────────────────────

  private openAssigneeSelector(cell: HTMLElement, task: Task): void {
    assigneeSelector.close()
    assigneeSelector.show(cell, this.store, task.assignee, (value: string) => {
      this.store.updateTask(task.id, { assignee: value })
    })
  }

  // ── Inline Text Edit (title, duration, progress) ──────────────────────────

  private startEdit(cell: HTMLElement, task: Task): void {
    if (cell.dataset.editing) return
    cell.dataset.editing = '1'
    const field = cell.dataset.field as keyof Task
    const original = cell.textContent?.trim() ?? ''
    cell.classList.add('editing')

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'cell-input'
    input.value = original
    cell.textContent = ''
    cell.append(input)
    input.select()

    const commit = () => {
      delete cell.dataset.editing
      cell.classList.remove('editing')
      const val = input.value.trim()
      if (val !== original) this.commitEdit(task, field, val)
    }
    const cancel = () => {
      delete cell.dataset.editing
      cell.classList.remove('editing')
      cell.textContent = original
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); input.blur() }
      if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); cancel() }
      if (e.key === 'Tab') {
        e.preventDefault()
        input.blur()
        const cells = [...(cell.closest('tr')!).querySelectorAll<HTMLElement>('.editable:not(.date-cell):not(.picker-cell)')]
        const idx = cells.indexOf(cell)
        cells[e.shiftKey ? idx - 1 : idx + 1]?.dispatchEvent(new MouseEvent('dblclick'))
      }
    })
  }

  private commitEdit(task: Task, field: keyof Task, val: string): void {
    if (field === 'duration') {
      const n = parseInt(val, 10)
      if (!isNaN(n) && n >= 1) this.store.updateTask(task.id, { duration: n })
    } else if (field === 'progress') {
      const n = Math.min(100, Math.max(0, parseInt(val, 10)))
      if (!isNaN(n)) this.store.updateTask(task.id, { progress: n })
    } else {
      this.store.updateTask(task.id, { [field]: val } as Partial<Task>)
    }
  }

  // ── Store listener ────────────────────────────────────────────────────────

  private listenStore(): void {
    this.store.on(event => {
      if (['task:add','task:update','task:delete','task:reorder','data:load'].includes(event.type)) {
        this.renderRows()
      }
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  selectRow(id: string): void {
    this.selectedId = id
    this.restoreSelection()
    this.onSelectCallback?.(id)
  }

  private restoreSelection(): void {
    this.el.querySelectorAll<HTMLElement>('.task-row').forEach(row =>
      row.classList.toggle('selected', row.dataset.id === this.selectedId))
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', e => {
      if (!this.selectedId) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' ||
          (active as HTMLElement).contentEditable === 'true')) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const task = this.store.getTask(this.selectedId)
        if (task) showConfirm(`Delete "${task.title}"?`).then(ok => {
          if (ok) this.store.deleteTask(this.selectedId!)
        })
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.store.addTask(this.selectedId)
      }
    })
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
