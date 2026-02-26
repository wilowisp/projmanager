import type { Store } from '../store'

type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

// ─── Shared popup utility ─────────────────────────────────────────────────────

function positionPopup(el: HTMLElement, anchor: HTMLElement): void {
  const r = anchor.getBoundingClientRect()
  const maxH = 320
  const left = Math.min(r.left, window.innerWidth - 300)
  const fitsBelow = r.bottom + maxH + 8 < window.innerHeight
  el.style.top  = fitsBelow ? `${r.bottom + 4}px` : `${r.top - maxH - 4}px`
  el.style.left = `${Math.max(4, left)}px`
}

function addOutsideClose(el: HTMLElement, close: () => void): () => void {
  const handler = (e: MouseEvent) => {
    if (!el.contains(e.target as Node)) close()
  }
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  setTimeout(() => {
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
  }, 0)
  return () => {
    document.removeEventListener('mousedown', handler)
    document.removeEventListener('keydown', keyHandler)
  }
}

// ─── PredSelector ─────────────────────────────────────────────────────────────

/**
 * Floating dropdown for selecting predecessor tasks.
 * Shows all tasks (in table order) with dependency type + lag controls.
 */
export class PredSelector {
  private el: HTMLElement
  private cleanup!: () => void

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'task-selector-popup'
    this.el.addEventListener('mousedown', e => e.stopPropagation())
  }

  show(
    anchor: HTMLElement,
    store: Store,
    currentTaskId: string,
    onChange: (raw: string) => void,
  ): void {
    const tasks = store.getVisibleTasks().filter(t => t.id !== currentTaskId)
    const currentTask = store.getTask(currentTaskId)!
    const currentPreds = new Map(currentTask.predecessors.map(p => [p.taskId, p]))

    this.el.innerHTML = `
      <div class="ts-header">
        <span class="ts-title">Select Predecessors</span>
        <button class="ts-clear btn btn-ghost" style="font-size:11px;padding:2px 6px">Clear all</button>
      </div>
      <div class="ts-list">
        ${tasks.map(t => {
          const pred = currentPreds.get(t.id)
          const checked = pred ? 'checked' : ''
          const depType = pred?.type ?? 'FS'
          const lag = pred?.lag ?? 0
          return `
            <div class="ts-row${pred ? ' ts-row-active' : ''}" data-id="${t.id}">
              <input type="checkbox" class="ts-check" data-id="${t.id}" ${checked} />
              <span class="ts-wbs">${t.wbs}</span>
              <span class="ts-name">${escHtml(t.title)}</span>
              <select class="ts-type" data-id="${t.id}" ${!pred ? 'disabled' : ''}>
                ${(['FS','SS','FF','SF'] as DependencyType[]).map(d =>
                  `<option${d === depType ? ' selected' : ''}>${d}</option>`
                ).join('')}
              </select>
              <input type="number" class="ts-lag" data-id="${t.id}"
                value="${lag}" min="-99" max="99" style="width:44px"
                ${!pred ? 'disabled' : ''} />
              <span class="ts-lag-label">d</span>
            </div>
          `
        }).join('')}
      </div>
    `

    document.body.append(this.el)
    positionPopup(this.el, anchor)

    const emit = () => {
      const parts: string[] = []
      this.el.querySelectorAll<HTMLInputElement>('.ts-check:checked').forEach(cb => {
        const id = cb.dataset.id!
        const t = store.getTask(id)
        if (!t) return
        const type = (this.el.querySelector<HTMLSelectElement>(`.ts-type[data-id="${id}"]`)?.value ?? 'FS') as DependencyType
        const lag = parseInt(this.el.querySelector<HTMLInputElement>(`.ts-lag[data-id="${id}"]`)?.value ?? '0', 10)
        let token = t.wbs
        if (type !== 'FS') token += type
        if (lag > 0) token += `+${lag}`
        else if (lag < 0) token += `${lag}`
        parts.push(token)
      })
      onChange(parts.join(','))
    }

    // Checkbox toggles enable/disable type+lag inputs
    this.el.querySelectorAll<HTMLInputElement>('.ts-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id!
        const row = this.el.querySelector<HTMLElement>(`.ts-row[data-id="${id}"]`)!
        const typeEl = this.el.querySelector<HTMLSelectElement>(`.ts-type[data-id="${id}"]`)!
        const lagEl  = this.el.querySelector<HTMLInputElement>(`.ts-lag[data-id="${id}"]`)!
        typeEl.disabled = !cb.checked
        lagEl.disabled  = !cb.checked
        row.classList.toggle('ts-row-active', cb.checked)
        emit()
      })
    })

    this.el.querySelectorAll<HTMLSelectElement>('.ts-type').forEach(sel => {
      sel.addEventListener('change', emit)
    })
    this.el.querySelectorAll<HTMLInputElement>('.ts-lag').forEach(inp => {
      inp.addEventListener('input', emit)
    })

    this.el.querySelector('.ts-clear')!.addEventListener('click', () => {
      this.el.querySelectorAll<HTMLInputElement>('.ts-check').forEach(cb => { cb.checked = false })
      this.el.querySelectorAll<HTMLSelectElement>('.ts-type').forEach(s => { s.disabled = true })
      this.el.querySelectorAll<HTMLInputElement>('.ts-lag').forEach(i => { i.disabled = true })
      this.el.querySelectorAll('.ts-row').forEach(r => r.classList.remove('ts-row-active'))
      onChange('')
    })

    this.cleanup = addOutsideClose(this.el, () => this.close())
  }

  close(): void {
    this.el.remove()
    this.cleanup?.()
  }
}

// ─── AssigneeSelector ─────────────────────────────────────────────────────────

/**
 * Floating dropdown for picking an assignee.
 * Shows unique assignees in the project + free-text input.
 */
export class AssigneeSelector {
  private el: HTMLElement
  private cleanup!: () => void

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'task-selector-popup assignee-popup'
    this.el.addEventListener('mousedown', e => e.stopPropagation())
  }

  show(
    anchor: HTMLElement,
    store: Store,
    currentValue: string,
    onChange: (value: string) => void,
  ): void {
    // Unique assignees across all tasks, in task order
    const seen = new Set<string>()
    const assignees: string[] = []
    store.getTasks().forEach(t => {
      if (t.assignee && !seen.has(t.assignee)) {
        seen.add(t.assignee)
        assignees.push(t.assignee)
      }
    })

    this.el.innerHTML = `
      <div class="ts-header">
        <span class="ts-title">Assignee</span>
      </div>
      <div class="ts-input-row">
        <input class="ts-text-input form-input" type="text"
          value="${escHtml(currentValue)}" placeholder="Type name…" />
      </div>
      <div class="ts-list">
        ${assignees.length === 0 ? '<span class="ts-empty">No assignees yet</span>' : ''}
        ${assignees.map(a => `
          <div class="ts-row${a === currentValue ? ' ts-row-active' : ''}" data-name="${escHtml(a)}">
            <span class="ts-avatar">${a.charAt(0).toUpperCase()}</span>
            <span class="ts-name">${escHtml(a)}</span>
          </div>`
        ).join('')}
      </div>
    `

    document.body.append(this.el)
    positionPopup(this.el, anchor)

    const input = this.el.querySelector<HTMLInputElement>('.ts-text-input')!
    input.focus()
    input.select()

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { onChange(input.value.trim()); this.close() }
    })

    this.el.querySelectorAll<HTMLElement>('.ts-row').forEach(row => {
      row.addEventListener('click', () => {
        onChange(row.dataset.name!)
        this.close()
      })
    })

    this.cleanup = addOutsideClose(this.el, () => {
      // Commit text input on close
      const v = input.value.trim()
      if (v !== currentValue) onChange(v)
      this.close()
    })
  }

  close(): void {
    this.el.remove()
    this.cleanup?.()
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
