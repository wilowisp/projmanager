import type { Task, CPMResult, TaskCPM } from '../types'
import { parseDate, daysBetween } from './dates'

/**
 * Classic CPM (Critical Path Method) using calendar-day durations.
 * Returns a Map<taskId, TaskCPM> with early/late start/finish and float.
 */
export function computeCriticalPath(tasks: Task[], projectStart: string): CPMResult {
  const result = new Map<string, TaskCPM>()
  if (tasks.length === 0) return result

  const projStart = parseDate(projectStart)

  // Map taskId -> index, startDay (days from project start)
  const startDay = new Map<string, number>()
  const dur = new Map<string, number>()

  tasks.forEach(t => {
    startDay.set(t.id, daysBetween(projStart, parseDate(t.startDate)))
    dur.set(t.id, t.duration)
  })

  // ── Forward Pass ──────────────────────────────────────────────────────────
  // Topological order via simple iteration (handles cycles gracefully)
  const earlyStart = new Map<string, number>()
  const earlyFinish = new Map<string, number>()

  // Initialize
  tasks.forEach(t => earlyStart.set(t.id, 0))

  // Multiple passes to propagate (handles non-topo input)
  for (let pass = 0; pass < tasks.length; pass++) {
    tasks.forEach(t => {
      let es = 0
      t.predecessors.forEach(dep => {
        const predEF = earlyFinish.get(dep.taskId) ?? 0
        const predES = earlyStart.get(dep.taskId) ?? 0
        let constraint: number
        switch (dep.type) {
          case 'FS': constraint = predEF + dep.lag; break
          case 'SS': constraint = predES + dep.lag; break
          case 'FF': constraint = predEF + dep.lag - (t.duration - 1); break
          case 'SF': constraint = predES + dep.lag - (t.duration - 1); break
          default:   constraint = predEF + dep.lag
        }
        es = Math.max(es, constraint)
      })
      earlyStart.set(t.id, Math.max(earlyStart.get(t.id) ?? 0, es))
      earlyFinish.set(t.id, (earlyStart.get(t.id) ?? 0) + t.duration - 1)
    })
  }

  // ── Backward Pass ─────────────────────────────────────────────────────────
  const projectEnd = Math.max(...tasks.map(t => earlyFinish.get(t.id) ?? 0))

  const lateFinish = new Map<string, number>()
  const lateStart = new Map<string, number>()

  // Initialize to project end
  tasks.forEach(t => {
    lateFinish.set(t.id, projectEnd)
    lateStart.set(t.id, projectEnd - t.duration + 1)
  })

  // Successor map
  const successors = new Map<string, { taskId: string; dep: Task['predecessors'][0] }[]>()
  tasks.forEach(t => successors.set(t.id, []))
  tasks.forEach(t => {
    t.predecessors.forEach(dep => {
      const list = successors.get(dep.taskId) ?? []
      list.push({ taskId: t.id, dep })
      successors.set(dep.taskId, list)
    })
  })

  for (let pass = 0; pass < tasks.length; pass++) {
    ;[...tasks].reverse().forEach(t => {
      const succs = successors.get(t.id) ?? []
      if (succs.length === 0) {
        lateFinish.set(t.id, Math.min(lateFinish.get(t.id) ?? projectEnd, projectEnd))
      } else {
        succs.forEach(({ taskId: sId, dep }) => {
          const succLS = lateStart.get(sId) ?? projectEnd
          const succLF = lateFinish.get(sId) ?? projectEnd
          let lf: number
          switch (dep.type) {
            case 'FS': lf = succLS - dep.lag; break
            case 'SS': lf = succLS - dep.lag + t.duration - 1; break
            case 'FF': lf = succLF - dep.lag; break
            case 'SF': lf = succLF - dep.lag + t.duration - 1; break
            default:   lf = succLS - dep.lag
          }
          lateFinish.set(t.id, Math.min(lateFinish.get(t.id) ?? projectEnd, lf))
        })
      }
      lateStart.set(t.id, (lateFinish.get(t.id) ?? projectEnd) - t.duration + 1)
    })
  }

  // ── Assemble Result ───────────────────────────────────────────────────────
  tasks.forEach(t => {
    const es = earlyStart.get(t.id) ?? 0
    const ef = earlyFinish.get(t.id) ?? 0
    const ls = lateStart.get(t.id) ?? 0
    const lf = lateFinish.get(t.id) ?? 0
    const tf = ls - es
    const cpm: TaskCPM = { earlyStart: es, earlyFinish: ef, lateStart: ls, lateFinish: lf, totalFloat: tf, isCritical: tf <= 0 }
    result.set(t.id, cpm)
  })

  return result
}
