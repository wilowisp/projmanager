# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static, client-side **project management and Gantt chart app** hosted on GitHub Pages. Supports MS Project-style task dependencies (FS/SS/FF/SF), critical-path calculation, drag-based Gantt editing, and inline table editing. Each subfolder under `projects/` is an independent project with its own URL.

**Architecture principle:** UI code is shared; data is per-project folder. To create a new project:
```bash
npm run new-project "My Project Name"   # creates projects/my-project-name/
```

## Key Commands

```bash
npm install               # install dependencies
npm run dev               # dev server at http://localhost:5173
npm run build             # production build → dist/
npm run preview           # preview dist/ locally
npx tsc --noEmit          # type-check without building
npm run new-project <name> # scaffold a new project folder
npm run deploy            # build + push dist/ to gh-pages branch (manual)
```

GitHub Actions auto-deploys on every push to `main` via `.github/workflows/deploy.yml`.

## Source Structure

```
src/
  main.ts              ← App entry (project view); reads meta[name="pm-project-id"]
  launcher.ts          ← Launcher entry (index.html)
  types.ts             ← All TypeScript interfaces
  store.ts             ← Data layer: CRUD, localStorage persistence, CPM trigger
  utils/
    uuid.ts            ← generateId()
    dates.ts           ← parseDate, formatDate, addDays, calendarDuration, etc.
    wbs.ts             ← rebuildWbs, parsePredecessorToken, serializePredecessors
    critical-path.ts   ← CPM forward/backward pass → CPMResult map
  components/
    TaskTable.ts       ← Left panel: inline-editable table, drag-reorder
    GanttChart.ts      ← Right panel: SVG Gantt with bars, arrows, drag
    Toolbar.ts         ← Top bar: project name, zoom, export/import
    Modal.ts           ← Modal dialog + showConfirm() + showToast()
  styles/
    app.css            ← All styles for the project app (dark theme, CSS vars)
    launcher.css       ← Styles for the launcher page
projects/
  demo/
    index.html         ← Project page (meta tag sets project ID)
    data.json          ← Initial data loaded on first visit (stored in localStorage after)
index.html             ← Launcher page
vite.config.ts         ← Multi-page build; auto-discovers all projects/ folders
scripts/
  new-project.js       ← Generates projects/<name>/ with index.html + data.json
.github/
  workflows/deploy.yml ← Build + deploy to gh-pages on push to main
```

## Routing & Project Identity

- Launcher: `index.html` → `src/launcher.ts`
- Project page: `projects/<name>/index.html` → `src/main.ts`
- Project ID is read from `<meta name="pm-project-id" content="<id>">` in the project's `index.html`
- Data storage key in localStorage: `pm_project_<id>`
- On first load, `store.loadFromUrl('./data.json')` fetches the bundled `data.json` if localStorage is empty

## GitHub Pages Data Persistence (No Server)

Data is stored **directly in the GitHub repository** — no backend server needed:

| Layer | What it does |
|-------|-------------|
| `data.json` (gh-pages branch) | Canonical storage; served by GitHub Pages |
| localStorage | Write-back cache; instant local updates |
| GitHub Contents API | How the app writes back to `data.json` |

**Flow:**
1. App loads → reads `data.json` from GitHub API (fresh) or GitHub Pages URL → falls back to localStorage
2. User edits → localStorage updated immediately (no lag)
3. 1.5s after last edit → app PUTs updated `data.json` to GitHub API on `gh-pages` branch
4. GitHub Pages serves the new `data.json` → accessible from any browser/device

**Setup (one-time per user):**
1. Create a GitHub PAT at `github.com/settings/tokens` with `contents:write` scope
2. In the app toolbar: click **⚙ Settings** → enter owner/repo/PAT → Save & Sync
3. Settings are stored in `localStorage` only (never committed)

**Files involved:** `src/utils/github-api.ts`, `src/components/SettingsModal.ts`, `store.ts#scheduleSyncToGitHub`

## Data Model

Core types are in `src/types.ts`. Key interfaces:

```ts
Task         — id, wbs, title, startDate, endDate, duration, progress,
               predecessors (TaskDependency[]), parentId, status, priority, …
TaskDependency — { taskId, type: 'FS'|'SS'|'FF'|'SF', lag: number }
ProjectData  — { tasks, milestones, settings, startDate, endDate, … }
```

Predecessor string format (same as MS Project): `"2"`, `"3FS+1"`, `"1SS-2,4FF"`.

## Store Pattern

`Store` extends a minimal `EventEmitter`. Components subscribe via `store.on(event => …)`.
Emitted event types: `task:add`, `task:update`, `task:delete`, `task:reorder`, `project:update`, `data:load`.

After any task mutation, `Store` automatically:
1. Calls `rebuildWbs()` to renumber WBS
2. Calls `computeCriticalPath()` to update CPM result
3. Saves to localStorage

## Gantt Chart (SVG)

`GanttChart.ts` renders two `<svg>` elements: a fixed header (timeline) and a scrollable body (bars + arrows).

- Day width varies by zoom: `{ day: 38, week: 12, month: 3.5, quarter: 1.2 }` px/day
- Task bars: `<rect>` with a progress overlay rect + inner label text + resize handle
- Dependency arrows: `<path>` elements with SVG `<marker>` arrowheads; routed as elbow paths
- Critical path bars highlighted in `--bar-critical` (red) when `showCritical` is on
- Drag-to-move: updates `startDate`; drag right-edge handle: updates `duration`

## GitHub Pages Deployment

Vite `base` is set via `VITE_BASE_PATH` env var (set to `/<repo-name>/` by GitHub Actions).
Each project page's `index.html` is auto-discovered at build time by `vite.config.ts` using `readdirSync('projects/')`.

URL pattern: `https://<user>.github.io/<repo>/projects/<name>/`

To add a new project and deploy:
```bash
npm run new-project "My Work 2026"
git add projects/my-work-2026
git commit -m "Add project: My Work 2026"
git push   # triggers GitHub Actions → live in ~60s
```
