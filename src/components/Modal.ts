/**
 * Simple modal dialog component.
 * Usage:
 *   const modal = new Modal('My Title')
 *   modal.setContent(el)
 *   modal.open()
 */
export class Modal {
  private overlay: HTMLElement
  private dialog: HTMLElement
  private titleEl: HTMLElement
  private bodyEl: HTMLElement

  constructor(title: string) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'modal-overlay'

    this.dialog = document.createElement('div')
    this.dialog.className = 'modal-dialog'

    const header = document.createElement('div')
    header.className = 'modal-header'

    this.titleEl = document.createElement('h2')
    this.titleEl.textContent = title

    const closeBtn = document.createElement('button')
    closeBtn.className = 'modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this.close())

    header.append(this.titleEl, closeBtn)

    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'modal-body'

    this.dialog.append(header, this.bodyEl)
    this.overlay.append(this.dialog)

    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.close()
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen()) this.close()
    })
  }

  setTitle(t: string): void {
    this.titleEl.textContent = t
  }

  setContent(el: HTMLElement): void {
    this.bodyEl.innerHTML = ''
    this.bodyEl.append(el)
  }

  setContentHTML(html: string): void {
    this.bodyEl.innerHTML = html
  }

  getBody(): HTMLElement {
    return this.bodyEl
  }

  open(): void {
    if (!document.body.contains(this.overlay)) {
      document.body.append(this.overlay)
    }
    requestAnimationFrame(() => this.overlay.classList.add('open'))
  }

  close(): void {
    this.overlay.classList.remove('open')
    setTimeout(() => this.overlay.remove(), 200)
  }

  isOpen(): boolean {
    return document.body.contains(this.overlay)
  }
}

/** Simple confirm dialog */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const modal = new Modal('Confirm')
    const body = document.createElement('div')
    body.innerHTML = `<p style="margin:0 0 1.5rem">${message}</p>`

    const btns = document.createElement('div')
    btns.style.cssText = 'display:flex;gap:.5rem;justify-content:flex-end'

    const cancel = document.createElement('button')
    cancel.className = 'btn btn-ghost'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => { modal.close(); resolve(false) })

    const ok = document.createElement('button')
    ok.className = 'btn btn-danger'
    ok.textContent = 'Delete'
    ok.addEventListener('click', () => { modal.close(); resolve(true) })

    btns.append(cancel, ok)
    body.append(btns)
    modal.setContent(body)
    modal.open()
  })
}

/** Toast notification */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.append(container)
  }
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  container.append(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
