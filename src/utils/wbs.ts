import type { Task } from '../types'

/**
 * Rebuild WBS numbers for the entire task list in-place.
 * WBS is based on parent-child nesting order.
 */
export function rebuildWbs(tasks: Task[]): void {
  const counters = new Map<string | null, number>()

  function getNext(parentId: string | null): number {
    const n = (counters.get(parentId) ?? 0) + 1
    counters.set(parentId, n)
    return n
  }

  function assign(parentId: string | null, parentWbs: string): void {
    const children = tasks.filter(t => t.parentId === parentId)
    children.forEach(task => {
      const n = getNext(parentId)
      task.wbs = parentWbs ? `${parentWbs}.${n}` : String(n)
      assign(task.id, task.wbs)
    })
  }

  assign(null, '')
}

/** Find a task by WBS string */
export function findByWbs(tasks: Task[], wbs: string): Task | undefined {
  return tasks.find(t => t.wbs === wbs)
}

/**
 * Parse predecessor string like "3", "2FS+1", "1SS-2", "4FF", "5SF"
 * Returns { wbs, type, lag } or null on parse failure.
 */
export function parsePredecessorToken(token: string): {
  wbs: string
  type: string
  lag: number
} | null {
  token = token.trim()
  if (!token) return null
  // e.g. "2FS+1" or "3" or "1SS-2"
  const match = token.match(/^([\d.]+)(FS|SS|FF|SF)?([+-]\d+)?$/i)
  if (!match) return null
  return {
    wbs: match[1],
    type: (match[2] ?? 'FS').toUpperCase(),
    lag: match[3] ? parseInt(match[3], 10) : 0,
  }
}

/** Serialize predecessors to display string like "2FS+1,3" */
export function serializePredecessors(
  preds: Task['predecessors'],
  tasks: Task[],
): string {
  return preds
    .map(p => {
      const t = tasks.find(t => t.id === p.taskId)
      if (!t) return null
      let s = t.wbs
      if (p.type !== 'FS') s += p.type
      if (p.lag > 0) s += `+${p.lag}`
      else if (p.lag < 0) s += `${p.lag}`
      return s
    })
    .filter(Boolean)
    .join(',')
}
