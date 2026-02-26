import { Modal, showToast } from './Modal'
import {
  loadGitHubSettings, saveGitHubSettings, clearGitHubSettings,
  verifyGitHubAccess, deriveFilePath, type GitHubSettings,
} from '../utils/github-api'
import type { Store } from '../store'

export function openSettingsModal(store: Store): void {
  const modal = new Modal('Settings — GitHub Sync')
  const existing = loadGitHubSettings()

  const body = document.createElement('div')
  body.innerHTML = `
    <p class="settings-note">
      Data is saved to <strong>GitHub Pages directly</strong> via the GitHub Contents API.<br>
      Changes write to <code>gh-pages</code> branch and are live immediately — no server needed.
    </p>

    <h3 class="settings-section">GitHub Repository</h3>
    <div class="form-group">
      <label>Owner (username or org)</label>
      <input id="gs-owner" class="form-input" type="text" placeholder="alice" value="${existing?.owner ?? ''}" />
    </div>
    <div class="form-group">
      <label>Repository name</label>
      <input id="gs-repo" class="form-input" type="text" placeholder="projmanager" value="${existing?.repo ?? ''}" />
    </div>
    <div class="form-group">
      <label>Branch (where GitHub Pages is served from)</label>
      <input id="gs-branch" class="form-input" type="text" placeholder="gh-pages" value="${existing?.branch ?? 'gh-pages'}" />
    </div>
    <div class="form-group">
      <label>Base path (repo name in URL, if project repo — leave blank for user/org pages)</label>
      <input id="gs-base" class="form-input" type="text" placeholder="projmanager" value="${existing?.basePath ?? ''}" />
      <span class="field-hint">Current URL path: <code>${window.location.pathname}</code><br>
      Resolved data.json path: <code id="gs-preview">…</code></span>
    </div>

    <h3 class="settings-section">Personal Access Token</h3>
    <div class="form-group">
      <label>GitHub PAT (needs <code>contents:write</code> permission)</label>
      <input id="gs-pat" class="form-input" type="password" placeholder="ghp_…" value="${existing?.pat ?? ''}" />
      <span class="field-hint">
        Create at <a href="https://github.com/settings/tokens/new?scopes=repo&description=projmanager" target="_blank" rel="noopener">github.com/settings/tokens</a>.
        Stored only in your browser — never committed.
      </span>
    </div>

    <div class="form-group" id="gs-status-row" style="display:none">
      <span id="gs-status"></span>
    </div>

    <div class="form-actions">
      <button class="btn btn-ghost" id="gs-test">Test connection</button>
      <button class="btn btn-ghost" id="gs-clear">Clear</button>
      <button class="btn btn-primary" id="gs-save">Save &amp; Sync</button>
    </div>

    <hr class="settings-hr" />

    <h3 class="settings-section">Project Dates</h3>
    <div class="form-row">
      <div class="form-group">
        <label>Start Date</label>
        <input id="gs-start" class="form-input" type="date" value="${store.getProject().startDate}" />
      </div>
      <div class="form-group">
        <label>End Date</label>
        <input id="gs-end" class="form-input" type="date" value="${store.getProject().endDate}" />
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <input id="gs-desc" class="form-input" type="text" value="${store.getProject().description}" />
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="gs-proj-save">Save Project Settings</button>
    </div>
  `

  // Live preview of derived path
  const updatePreview = () => {
    const owner = (body.querySelector('#gs-owner') as HTMLInputElement).value.trim()
    const repo = (body.querySelector('#gs-repo') as HTMLInputElement).value.trim()
    const branch = (body.querySelector('#gs-branch') as HTMLInputElement).value.trim() || 'gh-pages'
    const basePath = (body.querySelector('#gs-base') as HTMLInputElement).value.trim()
    const pat = (body.querySelector('#gs-pat') as HTMLInputElement).value.trim()
    const preview = body.querySelector<HTMLElement>('#gs-preview')!
    if (owner && repo) {
      const tmp: GitHubSettings = { owner, repo, branch, basePath, pat }
      preview.textContent = deriveFilePath(tmp)
    } else {
      preview.textContent = '…'
    }
  }

  ;['gs-owner','gs-repo','gs-base'].forEach(id => {
    body.querySelector(`#${id}`)!.addEventListener('input', updatePreview)
  })
  updatePreview()

  const getSettings = (): GitHubSettings => ({
    owner: (body.querySelector('#gs-owner') as HTMLInputElement).value.trim(),
    repo: (body.querySelector('#gs-repo') as HTMLInputElement).value.trim(),
    branch: (body.querySelector('#gs-branch') as HTMLInputElement).value.trim() || 'gh-pages',
    basePath: (body.querySelector('#gs-base') as HTMLInputElement).value.trim(),
    pat: (body.querySelector('#gs-pat') as HTMLInputElement).value.trim(),
  })

  const setStatus = (msg: string, ok: boolean) => {
    const row = body.querySelector<HTMLElement>('#gs-status-row')!
    const el = body.querySelector<HTMLElement>('#gs-status')!
    row.style.display = ''
    el.textContent = msg
    el.style.color = ok ? 'var(--success)' : 'var(--danger)'
  }

  // Test
  body.querySelector('#gs-test')!.addEventListener('click', async () => {
    const s = getSettings()
    if (!s.pat || !s.owner || !s.repo) { setStatus('Fill in owner, repo, and PAT first', false); return }
    setStatus('Testing…', true)
    const err = await verifyGitHubAccess(s)
    setStatus(err ?? '✓ Connected successfully', !err)
  })

  // Clear
  body.querySelector('#gs-clear')!.addEventListener('click', () => {
    clearGitHubSettings()
    showToast('GitHub sync settings cleared', 'info')
    modal.close()
  })

  // Save & Sync
  body.querySelector('#gs-save')!.addEventListener('click', async () => {
    const s = getSettings()
    if (!s.pat || !s.owner || !s.repo) { setStatus('Fill in all required fields', false); return }
    setStatus('Verifying…', true)
    const err = await verifyGitHubAccess(s)
    if (err) { setStatus(err, false); return }
    saveGitHubSettings(s)
    setStatus('Settings saved. Syncing…', true)
    const ok = await store.syncNow()
    setStatus(ok ? '✓ Data saved to GitHub Pages!' : 'Sync failed — check PAT permissions', ok)
    if (ok) showToast('Synced to GitHub Pages', 'success')
  })

  // Project settings save
  body.querySelector('#gs-proj-save')!.addEventListener('click', () => {
    const start = (body.querySelector('#gs-start') as HTMLInputElement).value
    const end = (body.querySelector('#gs-end') as HTMLInputElement).value
    const desc = (body.querySelector('#gs-desc') as HTMLInputElement).value.trim()
    store.updateProject({ startDate: start, endDate: end, description: desc })
    showToast('Project settings saved', 'success')
  })

  modal.setContent(body)
  modal.open()
}
