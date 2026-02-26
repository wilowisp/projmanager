/**
 * GitHub Contents API helper.
 * Reads and writes data.json directly to the gh-pages branch —
 * no server required. GitHub Pages serves the file; the API writes it.
 */

export interface GitHubSettings {
  owner: string        // e.g. "alice"
  repo: string         // e.g. "projmanager"
  branch: string       // usually "gh-pages"
  basePath: string     // e.g. "" or "projmanager" (repo sub-path prefix stripped by Pages)
  pat: string          // Personal Access Token (stored in localStorage only)
}

const SETTINGS_KEY = 'pm_github_settings'

export function loadGitHubSettings(): GitHubSettings | null {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function saveGitHubSettings(s: GitHubSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function clearGitHubSettings(): void {
  localStorage.removeItem(SETTINGS_KEY)
}

/**
 * Derive the file path inside the repo from the current URL.
 *
 * GitHub Pages serves:
 *   https://<owner>.github.io/<repo>/projects/<name>/
 * The file in the gh-pages branch is at:
 *   projects/<name>/data.json
 *
 * If basePath is set (e.g. the repo name portion), strip it from pathname.
 */
export function deriveFilePath(settings: GitHubSettings): string {
  let pathname = window.location.pathname
  // Strip leading slash
  if (pathname.startsWith('/')) pathname = pathname.slice(1)
  // Strip repo/basePath prefix (e.g. "projmanager/")
  const prefix = settings.basePath ? settings.basePath.replace(/^\/|\/$/g, '') + '/' : ''
  if (prefix && pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length)
  // Strip trailing slash
  pathname = pathname.replace(/\/$/, '')
  return pathname ? `${pathname}/data.json` : 'data.json'
}

interface GitHubFileResponse {
  sha: string
  content: string        // base64-encoded
  download_url: string
}

/**
 * Read a file from the GitHub API (not from Pages cache — always fresh).
 * Returns parsed JSON or null on failure.
 */
export async function readFromGitHub<T>(settings: GitHubSettings, filePath: string): Promise<T | null> {
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${filePath}?ref=${settings.branch}`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${settings.pat}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) return null
    const file = (await res.json()) as GitHubFileResponse
    const decoded = atob(file.content.replace(/\n/g, ''))
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}

/**
 * Write (create or update) a file on the GitHub API.
 * Returns true on success.
 */
export async function writeToGitHub(
  settings: GitHubSettings,
  filePath: string,
  content: string,
  message = 'Update project data',
): Promise<boolean> {
  const apiUrl = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${filePath}`
  const headers = {
    Authorization: `token ${settings.pat}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  // Get current SHA (needed for update)
  let sha: string | undefined
  try {
    const res = await fetch(`${apiUrl}?ref=${settings.branch}`, { headers })
    if (res.ok) {
      const file = (await res.json()) as GitHubFileResponse
      sha = file.sha
    }
  } catch { /* file doesn't exist yet — create it */ }

  // Base64-encode content
  const encoded = btoa(unescape(encodeURIComponent(content)))

  const body: Record<string, string> = {
    message,
    content: encoded,
    branch: settings.branch,
  }
  if (sha) body.sha = sha

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Verify that a PAT has read/write access to the repo.
 * Returns an error string or null if OK.
 */
export async function verifyGitHubAccess(settings: GitHubSettings): Promise<string | null> {
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${settings.pat}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (res.status === 401) return 'Invalid token (401 Unauthorized)'
    if (res.status === 404) return `Repository "${settings.owner}/${settings.repo}" not found`
    if (!res.ok) return `GitHub API error: ${res.status}`
    return null
  } catch {
    return 'Network error — check your internet connection'
  }
}
