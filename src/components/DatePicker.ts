import { parseDate, MONTH_NAMES_FULL } from '../utils/dates'

/**
 * Floating calendar popup.
 * - Click a day to select
 * - Type directly in the text input for manual entry
 * - Navigate months with ◀ / ▶
 * - Closes on outside click, Escape, or after selection
 */
export class DatePicker {
  private el: HTMLElement
  private year: number
  private month: number
  private selectedDate: string
  private onSelectCb: (date: string) => void
  private closeHandler!: (e: MouseEvent) => void
  private keyHandler!: (e: KeyboardEvent) => void

  constructor(initialDate: string, onSelect: (date: string) => void) {
    this.selectedDate = initialDate || ''
    this.onSelectCb = onSelect
    const d = initialDate ? parseDate(initialDate) : new Date()
    this.year = d.getFullYear()
    this.month = d.getMonth()

    this.el = document.createElement('div')
    this.el.className = 'datepicker-popup'
    this.el.addEventListener('mousedown', e => e.stopPropagation()) // prevent blur
  }

  show(anchor: HTMLElement): void {
    this.buildUI()
    document.body.append(this.el)
    this.position(anchor)

    // Close on outside click
    this.closeHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) this.close()
    }
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close()
    }
    setTimeout(() => {
      document.addEventListener('mousedown', this.closeHandler)
      document.addEventListener('keydown', this.keyHandler)
    }, 0)
  }

  close(): void {
    this.el.remove()
    document.removeEventListener('mousedown', this.closeHandler)
    document.removeEventListener('keydown', this.keyHandler)
  }

  private position(anchor: HTMLElement): void {
    const r = anchor.getBoundingClientRect()
    const dpH = 280
    const top = r.bottom + window.scrollY + 4
    const left = r.left + window.scrollX
    const overflowRight = left + 240 - window.innerWidth
    const overflowBottom = top + dpH - window.innerHeight - window.scrollY

    this.el.style.top = `${overflowBottom > 0 ? r.top + window.scrollY - dpH - 4 : top}px`
    this.el.style.left = `${overflowRight > 0 ? left - overflowRight - 8 : left}px`
  }

  private buildUI(): void {
    const today = fmtDate(new Date())
    const firstDOW = new Date(this.year, this.month, 1).getDay()
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate()

    this.el.innerHTML = `
      <div class="dp-input-row">
        <input class="dp-text-input form-input" type="text"
          value="${this.selectedDate}" placeholder="YYYY-MM-DD" />
      </div>
      <div class="dp-nav-row">
        <button class="dp-nav-btn" data-dir="-1">&lt;</button>
        <span class="dp-month-label">${MONTH_NAMES_FULL[this.month]} ${this.year}</span>
        <button class="dp-nav-btn" data-dir="1">&gt;</button>
      </div>
      <div class="dp-weekdays">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span>
        <span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div class="dp-days">
        ${Array.from({ length: firstDOW }, () => '<span></span>').join('')}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const ds = `${this.year}-${String(this.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const isToday = ds === today
          const isSel  = ds === this.selectedDate
          return `<button class="dp-day${isToday ? ' dp-today' : ''}${isSel ? ' dp-selected' : ''}"
            data-date="${ds}">${d}</button>`
        }).join('')}
      </div>
      <div class="dp-footer">
        <button class="dp-today-btn">Today</button>
        <button class="dp-clear-btn">Clear</button>
      </div>
    `

    // Text input — commit on Enter or blur
    const input = this.el.querySelector<HTMLInputElement>('.dp-text-input')!
    const commitText = () => {
      const v = input.value.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        this.selectedDate = v
        this.onSelectCb(v)
        this.close()
      }
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') commitText() })
    input.addEventListener('blur', commitText)
    // Don't close when clicking inside input
    input.addEventListener('mousedown', e => e.stopPropagation())

    // Month navigation
    this.el.querySelectorAll<HTMLElement>('.dp-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.month += parseInt(btn.dataset.dir!)
        if (this.month < 0)  { this.month = 11; this.year-- }
        if (this.month > 11) { this.month =  0; this.year++ }
        const anchor = this.el.parentElement
        this.buildUI()
        if (anchor) this.position(anchor as HTMLElement)
      })
    })

    // Day buttons
    this.el.querySelectorAll<HTMLButtonElement>('.dp-day').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDate = btn.dataset.date!
        this.onSelectCb(this.selectedDate)
        this.close()
      })
    })

    // Today / Clear
    this.el.querySelector('.dp-today-btn')!.addEventListener('click', () => {
      this.selectedDate = today
      this.onSelectCb(today)
      this.close()
    })
    this.el.querySelector('.dp-clear-btn')!.addEventListener('click', () => {
      this.onSelectCb('')
      this.close()
    })
  }
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
