import type { Store } from '../store'
import type { Task, ZoomLevel } from '../types'
import { parseDate, formatDate, addDays, daysBetween, MONTH_NAMES } from '../utils/dates'

// ── Layout constants ──────────────────────────────────────────────────────────
const ROW_H = 36
const BAR_H = 20
const BAR_Y_OFF = (ROW_H - BAR_H) / 2    // vertical offset within row
const HEADER_H = 46                        // two-row header
const MILESTONE_R = 9
const ARROW_OFFSET = 12                    // horizontal elbow margin
const MIN_DAY_W: Record<ZoomLevel, number> = { day: 38, week: 12, month: 3.5, quarter: 1.2 }

export class GanttChart {
  private el: HTMLElement
  private svg!: SVGSVGElement
  private headerSvg!: SVGSVGElement
  private selectedId: string | null = null
  private zoom: ZoomLevel = 'month'
  private showCritical = false
  private onSelectCallback: ((id: string | null) => void) | null = null

  // drag state
  private dragTask: Task | null = null
  private dragMode: 'move' | 'resize' = 'move'
  private dragStartX = 0
  private dragOrigStart = ''
  private dragOrigDur = 0
  constructor(private store: Store) {
    this.zoom = store.getDefaultZoom()
    this.el = document.createElement('div')
    this.el.className = 'gantt-wrap'
    this.buildSkeleton()
    this.render()
    this.listenStore()
  }

  getElement(): HTMLElement { return this.el }

  onSelect(fn: (id: string | null) => void): void { this.onSelectCallback = fn }

  setSelected(id: string | null): void {
    this.selectedId = id
    this.svg.querySelectorAll<SVGElement>('.task-bar').forEach(el => {
      el.classList.toggle('bar-selected', el.dataset.id === id)
    })
  }

  setZoom(zoom: ZoomLevel): void { this.zoom = zoom; this.render() }
  setShowCritical(v: boolean): void { this.showCritical = v; this.render() }

  scrollToToday(): void {
    const bodyWrap = this.el.querySelector<HTMLElement>('.gantt-body-wrap')
    if (!bodyWrap) return
    const proj = parseDate(this.store.getProject().startDate)
    const today = new Date()
    const days = daysBetween(proj, today)
    const dw = MIN_DAY_W[this.zoom]
    const x = days * dw - bodyWrap.clientWidth / 2
    bodyWrap.scrollLeft = Math.max(0, x)
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────

  private buildSkeleton(): void {
    this.el.innerHTML = `
      <div class="gantt-header-wrap">
        <svg class="gantt-header-svg"></svg>
      </div>
      <div class="gantt-body-wrap">
        <svg class="gantt-body-svg"></svg>
      </div>
    `
    this.headerSvg = this.el.querySelector<SVGSVGElement>('.gantt-header-svg')!
    this.svg = this.el.querySelector<SVGSVGElement>('.gantt-body-svg')!

    // Sync horizontal scroll between header and body
    const bodyWrap = this.el.querySelector<HTMLElement>('.gantt-body-wrap')!
    bodyWrap.addEventListener('scroll', () => {
      const headerWrap = this.el.querySelector<HTMLElement>('.gantt-header-wrap')!
      headerWrap.scrollLeft = bodyWrap.scrollLeft
    })

    this.setupDrag()
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render(): void {
    const tasks = this.store.getVisibleTasks()
    const proj = this.store.getProject()
    const projStart = parseDate(proj.startDate)
    const projEnd = parseDate(proj.endDate)
    const dw = MIN_DAY_W[this.zoom]
    const totalDays = Math.max(daysBetween(projStart, projEnd) + 30, 30)
    const totalW = totalDays * dw
    const totalH = tasks.length * ROW_H

    // Set SVG dimensions
    this.setSvgSize(this.headerSvg, totalW, HEADER_H)
    this.setSvgSize(this.svg, totalW, totalH || ROW_H)

    this.renderHeader(projStart, totalDays, dw)
    this.renderBody(tasks, projStart, totalDays, dw, totalW, totalH)
  }

  // ── Header ────────────────────────────────────────────────────────────────

  private renderHeader(projStart: Date, totalDays: number, dw: number): void {
    clearSvg(this.headerSvg)
    const ns = 'http://www.w3.org/2000/svg'

    // Background
    const bg = document.createElementNS(ns, 'rect')
    bg.setAttribute('width', String(this.headerSvg.width.baseVal.value))
    bg.setAttribute('height', String(HEADER_H))
    bg.setAttribute('fill', 'var(--gantt-header-bg)')
    this.headerSvg.append(bg)

    if (this.zoom === 'day') {
      this.renderDayHeader(projStart, totalDays, dw)
    } else if (this.zoom === 'week') {
      this.renderWeekHeader(projStart, totalDays, dw)
    } else {
      this.renderMonthHeader(projStart, totalDays, dw)
    }
  }

  private renderMonthHeader(projStart: Date, totalDays: number, dw: number): void {
    const ns = 'http://www.w3.org/2000/svg'
    let x = 0
    const cur = new Date(projStart)
    cur.setDate(1)
    let prevYear = -1

    while (x < totalDays * dw + dw * 31) {
      const year = cur.getFullYear()
      const month = cur.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const w = daysInMonth * dw
      const startOff = daysBetween(projStart, cur)
      const barX = startOff * dw

      if (barX > totalDays * dw + 100) break

      // Year row
      if (year !== prevYear) {
        const yearLbl = mkText(ns, String(year), barX + 2, 13, 'gantt-hdr-year')
        this.headerSvg.append(yearLbl)
        prevYear = year
      }

      // Month bar
      const rect = document.createElementNS(ns, 'rect')
      attr(rect, { x: String(barX), y: '22', width: String(w - 1), height: '24',
        fill: month % 2 === 0 ? 'var(--gantt-month-a)' : 'var(--gantt-month-b)',
        rx: '2' })
      this.headerSvg.append(rect)

      const lbl = mkText(ns, MONTH_NAMES[month], barX + w / 2, 38, 'gantt-hdr-month', 'middle')
      this.headerSvg.append(lbl)

      x = barX + w
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  private renderWeekHeader(projStart: Date, totalDays: number, dw: number): void {
    const ns = 'http://www.w3.org/2000/svg'
    let prevMonth = -1
    for (let day = 0; day < totalDays + 7; day++) {
      const cur = addDays(projStart, day)
      const dow = cur.getDay()
      const x = day * dw

      // Month label row
      if (cur.getMonth() !== prevMonth) {
        const lbl = mkText(ns, `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`, x + 2, 13, 'gantt-hdr-year')
        this.headerSvg.append(lbl)
        prevMonth = cur.getMonth()
        const sep = document.createElementNS(ns, 'line')
        attr(sep, { x1: String(x), y1: '0', x2: String(x), y2: String(HEADER_H), stroke: 'var(--gantt-grid)', 'stroke-width': '1' })
        this.headerSvg.append(sep)
      }

      // Week start
      if (dow === 1) {
        const rect = document.createElementNS(ns, 'rect')
        attr(rect, { x: String(x), y: '22', width: String(7 * dw - 1), height: '24',
          fill: 'var(--gantt-month-a)', rx: '2' })
        this.headerSvg.append(rect)
        const lbl = mkText(ns, `W${isoWeek(cur)}`, x + 2, 38, 'gantt-hdr-month')
        this.headerSvg.append(lbl)
      }
    }
  }

  private renderDayHeader(projStart: Date, totalDays: number, dw: number): void {
    const ns = 'http://www.w3.org/2000/svg'
    let prevMonth = -1
    for (let day = 0; day < totalDays; day++) {
      const cur = addDays(projStart, day)
      const x = day * dw
      const dow = cur.getDay()
      const isWeekend = dow === 0 || dow === 6

      if (cur.getMonth() !== prevMonth) {
        const lbl = mkText(ns, `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`, x + 2, 13, 'gantt-hdr-year')
        this.headerSvg.append(lbl)
        prevMonth = cur.getMonth()
      }

      const rect = document.createElementNS(ns, 'rect')
      attr(rect, { x: String(x), y: '22', width: String(dw - 1), height: '24',
        fill: isWeekend ? 'var(--gantt-weekend)' : 'var(--gantt-month-a)', rx: '1' })
      this.headerSvg.append(rect)

      const lbl = mkText(ns, String(cur.getDate()), x + dw / 2, 38, 'gantt-hdr-day', 'middle')
      this.headerSvg.append(lbl)
    }
  }

  // ── Body ──────────────────────────────────────────────────────────────────

  private renderBody(tasks: Task[], projStart: Date, totalDays: number, dw: number, totalW: number, totalH: number): void {
    clearSvg(this.svg)
    const ns = 'http://www.w3.org/2000/svg'

    // Arrow marker defs
    const defs = document.createElementNS(ns, 'defs')
    defs.innerHTML = `
      <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="var(--dep-arrow)"/>
      </marker>
      <marker id="arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="var(--dep-arrow-crit)"/>
      </marker>
    `
    this.svg.append(defs)

    // Grid background stripes
    tasks.forEach((_, i) => {
      const stripe = document.createElementNS(ns, 'rect')
      attr(stripe, { x: '0', y: String(i * ROW_H), width: String(totalW), height: String(ROW_H),
        fill: i % 2 === 0 ? 'var(--gantt-row-a)' : 'var(--gantt-row-b)' })
      this.svg.append(stripe)
    })

    // Vertical grid lines (month/week starts)
    this.renderVerticalGrid(projStart, totalDays, dw, totalH)

    // Today line
    const todayOff = daysBetween(projStart, new Date())
    if (todayOff >= 0 && todayOff <= totalDays) {
      const todayLine = document.createElementNS(ns, 'line')
      attr(todayLine, {
        x1: String(todayOff * dw), y1: '0',
        x2: String(todayOff * dw), y2: String(totalH),
        stroke: 'var(--today-line)', 'stroke-width': '2', 'stroke-dasharray': '4,3',
      })
      this.svg.append(todayLine)
    }

    // Task bars
    tasks.forEach((task, rowIdx) => this.renderBar(task, rowIdx, projStart, dw))

    // Dependency arrows (drawn after bars so they appear on top)
    tasks.forEach(task => {
      task.predecessors.forEach(dep => {
        const predTask = tasks.find(t => t.id === dep.taskId)
        if (!predTask) return
        const predRow = tasks.indexOf(predTask)
        const succRow = tasks.indexOf(task)
        if (predRow < 0 || succRow < 0) return
        this.renderArrow(predTask, predRow, task, succRow, dep.type, dep.lag, projStart, dw)
      })
    })

    // Milestones
    this.store.getMilestones().forEach(ms => {
      const x = daysBetween(projStart, parseDate(ms.date)) * dw
      const diamond = document.createElementNS(ns, 'polygon')
      const cy = totalH + 14
      const r = MILESTONE_R
      diamond.setAttribute('points', `${x},${cy - r} ${x + r},${cy} ${x},${cy + r} ${x - r},${cy}`)
      diamond.setAttribute('fill', ms.color)
      diamond.setAttribute('class', 'milestone-diamond')
      const title = document.createElementNS(ns, 'title')
      title.textContent = ms.title
      diamond.append(title)
      this.svg.append(diamond)
    })

    // Extend SVG height for milestones if any
    if (this.store.getMilestones().length > 0) {
      this.setSvgSize(this.svg, totalW, totalH + 30)
    }
  }

  private renderVerticalGrid(projStart: Date, totalDays: number, dw: number, totalH: number): void {
    const ns = 'http://www.w3.org/2000/svg'
    const cur = new Date(projStart)
    cur.setDate(1)
    while (daysBetween(projStart, cur) < totalDays + 31) {
      const x = daysBetween(projStart, cur) * dw
      if (x >= 0) {
        const line = document.createElementNS(ns, 'line')
        attr(line, { x1: String(x), y1: '0', x2: String(x), y2: String(totalH), stroke: 'var(--gantt-grid)', 'stroke-width': '1' })
        this.svg.append(line)
      }
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  private renderBar(task: Task, rowIdx: number, projStart: Date, dw: number): void {
    const ns = 'http://www.w3.org/2000/svg'
    const cpm = this.store.getCPM().get(task.id)
    const isCrit = this.showCritical && (cpm?.isCritical ?? false)
    const isSum = this.store.isSummary(task.id)
    const isSelected = task.id === this.selectedId

    const xStart = daysBetween(projStart, parseDate(task.startDate)) * dw
    const barW = Math.max(task.duration * dw - 1, 4)
    const y = rowIdx * ROW_H + BAR_Y_OFF

    if (task.isMilestone) {
      const mx = xStart
      const cy = rowIdx * ROW_H + ROW_H / 2
      const diamond = document.createElementNS(ns, 'polygon')
      const r = MILESTONE_R
      diamond.setAttribute('points', `${mx},${cy - r} ${mx + r},${cy} ${mx},${cy + r} ${mx - r},${cy}`)
      diamond.setAttribute('fill', task.color ?? '#F39C12')
      diamond.setAttribute('class', `task-bar milestone-bar${isSelected ? ' bar-selected' : ''}`)
      diamond.dataset.id = task.id
      this.addBarEvents(diamond, task)
      this.svg.append(diamond)
      return
    }

    const g = document.createElementNS(ns, 'g')
    g.setAttribute('class', `task-bar${isCrit ? ' bar-critical' : ''}${isSum ? ' bar-summary' : ''}${isSelected ? ' bar-selected' : ''}`)
    g.dataset.id = task.id

    // Background bar
    const rect = document.createElementNS(ns, 'rect')
    attr(rect, {
      x: String(xStart), y: String(y),
      width: String(barW), height: String(BAR_H),
      rx: isSum ? '0' : '3',
      fill: task.color ?? (isCrit ? 'var(--bar-critical)' : isSum ? 'var(--bar-summary)' : 'var(--bar-default)'),
    })
    g.append(rect)

    // Progress fill
    if (task.progress > 0) {
      const prog = document.createElementNS(ns, 'rect')
      attr(prog, {
        x: String(xStart), y: String(y),
        width: String(barW * task.progress / 100),
        height: String(BAR_H),
        rx: isSum ? '0' : '3',
        fill: 'rgba(0,0,0,0.2)',
      })
      g.append(prog)
    }

    // Label inside bar
    const lbl = document.createElementNS(ns, 'text')
    attr(lbl, { x: String(xStart + 4), y: String(y + BAR_H / 2 + 4), class: 'bar-label' })
    lbl.textContent = task.title
    g.append(lbl)

    // Resize handle (right edge)
    const handle = document.createElementNS(ns, 'rect')
    attr(handle, {
      x: String(xStart + barW - 6), y: String(y),
      width: '6', height: String(BAR_H),
      rx: '3', fill: 'rgba(255,255,255,0.4)',
      class: 'resize-handle', cursor: 'ew-resize',
    })
    handle.dataset.id = task.id
    handle.dataset.mode = 'resize'
    g.append(handle)

    // Tooltip
    const titleEl = document.createElementNS(ns, 'title')
    titleEl.textContent = `${task.title}\n${task.startDate} → ${task.endDate} (${task.duration}d)\n${task.progress}% complete`
    g.append(titleEl)

    this.addBarEvents(g, task)
    this.svg.append(g)
  }

  private addBarEvents(el: SVGElement, task: Task): void {
    el.addEventListener('click', e => {
      e.stopPropagation()
      this.selectedId = task.id
      this.setSelected(task.id)
      this.onSelectCallback?.(task.id)
    })

    el.addEventListener('mousedown', e => {
      const mode = (e.target as SVGElement).dataset.mode === 'resize' ? 'resize' : 'move'
      this.startDrag(e as MouseEvent, task, mode)
    })
  }

  // ── Dependency Arrows ─────────────────────────────────────────────────────

  private renderArrow(
    pred: Task, predRow: number,
    succ: Task, succRow: number,
    type: string, lag: number,
    projStart: Date, dw: number,
  ): void {
    const ns = 'http://www.w3.org/2000/svg'
    const cpm = this.store.getCPM()
    const isCrit = this.showCritical && (cpm.get(pred.id)?.isCritical ?? false) && (cpm.get(succ.id)?.isCritical ?? false)

    const predStartX = daysBetween(projStart, parseDate(pred.startDate)) * dw
    const predW = pred.duration * dw
    const succStartX = daysBetween(projStart, parseDate(succ.startDate)) * dw
    const succW = succ.duration * dw

    const predMidY = predRow * ROW_H + ROW_H / 2
    const succMidY = succRow * ROW_H + ROW_H / 2

    let fromX: number, toX: number

    switch (type) {
      case 'SS': fromX = predStartX; toX = succStartX; break
      case 'FF': fromX = predStartX + predW; toX = succStartX + succW; break
      case 'SF': fromX = predStartX; toX = succStartX + succW; break
      default:   fromX = predStartX + predW; toX = succStartX // FS
    }

    const lagPx = lag * dw
    toX += lagPx

    const d = buildArrowPath(fromX, predMidY, toX, succMidY, ARROW_OFFSET, type)
    const path = document.createElementNS(ns, 'path')
    attr(path, {
      d,
      stroke: isCrit ? 'var(--dep-arrow-crit)' : 'var(--dep-arrow)',
      'stroke-width': isCrit ? '2' : '1.5',
      fill: 'none',
      'marker-end': isCrit ? 'url(#arrow-crit)' : 'url(#arrow)',
      class: 'dep-arrow',
    })
    this.svg.append(path)
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  private setupDrag(): void {
    document.addEventListener('mousemove', e => this.onDragMove(e))
    document.addEventListener('mouseup', () => this.onDragEnd())
  }

  private startDrag(e: MouseEvent, task: Task, mode: 'move' | 'resize'): void {
    e.preventDefault()
    this.dragTask = task
    this.dragMode = mode
    this.dragStartX = e.clientX
    this.dragOrigStart = task.startDate
    this.dragOrigDur = task.duration
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.dragTask) return
    const dw = MIN_DAY_W[this.zoom]
    const dx = e.clientX - this.dragStartX
    const deltaDays = Math.round(dx / dw)

    const projStart = parseDate(this.store.getProject().startDate)
    const origStart = parseDate(this.dragOrigStart)

    if (this.dragMode === 'move') {
      const newStart = addDays(origStart, deltaDays)
      const newEnd = addDays(newStart, this.dragOrigDur - 1)
      // Preview by moving the bar element
      const bar = this.svg.querySelector<SVGElement>(`.task-bar[data-id="${this.dragTask.id}"]`)
      if (bar) {
        const newX = daysBetween(projStart, newStart) * dw
        bar.setAttribute('transform', `translate(${newX - daysBetween(projStart, parseDate(this.dragTask.startDate)) * dw},0)`)
      }
      void newEnd // suppress lint
    } else {
      const newDur = Math.max(1, this.dragOrigDur + deltaDays)
      const bar = this.svg.querySelector<SVGElement>(`.task-bar[data-id="${this.dragTask.id}"] rect`)
      if (bar) bar.setAttribute('width', String(newDur * dw - 1))
    }
  }

  private onDragEnd(): void {
    if (!this.dragTask) return
    const task = this.dragTask
    this.dragTask = null

    const dw = MIN_DAY_W[this.zoom]
    const bar = this.svg.querySelector<SVGElement>(`.task-bar[data-id="${task.id}"]`)
    const transform = bar?.getAttribute('transform')
    let deltaDays = 0

    if (transform) {
      const match = transform.match(/translate\((-?[\d.]+)/)
      if (match) deltaDays = Math.round(parseFloat(match[1]) / dw)
      bar?.removeAttribute('transform')
    }

    if (this.dragMode === 'move') {
      const newStart = formatDate(addDays(parseDate(this.dragOrigStart), deltaDays))
      this.store.updateTask(task.id, { startDate: newStart })
    } else {
      const barEl = this.svg.querySelector<SVGRectElement>(`.task-bar[data-id="${task.id}"] rect`)
      if (barEl) {
        const newW = parseFloat(barEl.getAttribute('width') ?? '0')
        const newDur = Math.max(1, Math.round(newW / dw))
        this.store.updateTask(task.id, { duration: newDur })
      }
    }
  }

  // ── Store listener ────────────────────────────────────────────────────────

  private listenStore(): void {
    this.store.on(event => {
      if (['task:add','task:update','task:delete','task:reorder','data:load','project:update'].includes(event.type)) {
        this.render()
      }
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setSvgSize(svg: SVGSVGElement, w: number, h: number): void {
    svg.setAttribute('width', String(Math.round(w)))
    svg.setAttribute('height', String(Math.round(h)))
    svg.setAttribute('viewBox', `0 0 ${Math.round(w)} ${Math.round(h)}`)
  }
}

// ── Utility functions ─────────────────────────────────────────────────────────

function clearSvg(svg: SVGSVGElement): void {
  while (svg.lastChild) svg.removeChild(svg.lastChild)
}

function attr(el: SVGElement, attrs: Record<string, string>): void {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
}

function mkText(
  ns: string, text: string, x: number, y: number,
  cls: string, anchor = 'start',
): SVGTextElement {
  const el = document.createElementNS(ns, 'text') as SVGTextElement
  ;(el as unknown as SVGElement).setAttribute('x', String(Math.round(x)))
  ;(el as unknown as SVGElement).setAttribute('y', String(y))
  ;(el as unknown as SVGElement).setAttribute('class', cls)
  ;(el as unknown as SVGElement).setAttribute('text-anchor', anchor)
  el.textContent = text
  return el
}

function isoWeek(d: Date): number {
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek = new Date(jan4)
  startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  return Math.ceil((((d.getTime() - startOfWeek.getTime()) / 86400000) + 1) / 7)
}

/**
 * Build SVG path string for a dependency arrow.
 * Draws elbow-routed L-shaped paths.
 */
function buildArrowPath(
  fromX: number, fromY: number,
  toX: number, toY: number,
  margin: number,
  _type: string,
): string {
  const dy = toY - fromY
  const dx = toX - fromX

  if (dx > margin * 2) {
    // Simple straight elbow: right → down/up → right
    const midX = fromX + dx / 2
    return `M${r(fromX)},${r(fromY)} L${r(midX)},${r(fromY)} L${r(midX)},${r(toY)} L${r(toX - 5)},${r(toY)}`
  }

  // Overlapping: go right, loop around
  const elbowX = fromX + margin
  const elbowY = (dy > 0) ? fromY - 10 : fromY + 10
  return `M${r(fromX)},${r(fromY)} L${r(elbowX)},${r(fromY)} L${r(elbowX)},${r(elbowY)} L${r(toX - margin)},${r(elbowY)} L${r(toX - margin)},${r(toY)} L${r(toX - 5)},${r(toY)}`
}

function r(n: number): number { return Math.round(n) }
