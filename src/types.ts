// ─── Core Domain Types ────────────────────────────────────────────────────────

export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'cancelled' | 'on_hold'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter'

export interface TaskDependency {
  taskId: string
  type: DependencyType
  lag: number // calendar days, negative = lead
}

export interface Task {
  id: string
  wbs: string          // auto-generated e.g. "1.2.3"
  title: string
  assignee: string
  status: TaskStatus
  priority: Priority
  startDate: string    // YYYY-MM-DD
  endDate: string      // YYYY-MM-DD
  duration: number     // calendar days (endDate - startDate + 1)
  progress: number     // 0-100
  predecessors: TaskDependency[]
  parentId: string | null
  collapsed: boolean
  color: string | null
  notes: string
  isMilestone: boolean
}

export interface Milestone {
  id: string
  title: string
  date: string         // YYYY-MM-DD
  color: string
  taskIds: string[]
}

export interface ProjectSettings {
  workingDays: boolean[] // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  holidays: string[]     // YYYY-MM-DD
  defaultZoom: ZoomLevel
  githubPat?: string     // PAT for sync, stored in localStorage only
}

export interface ProjectData {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  tasks: Task[]
  milestones: Milestone[]
  settings: ProjectSettings
}

// ─── CPM ─────────────────────────────────────────────────────────────────────

export interface TaskCPM {
  earlyStart: number   // days from project start
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
}

export type CPMResult = Map<string, TaskCPM>

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface AppState {
  selectedTaskId: string | null
  zoom: ZoomLevel
  viewStartDate: string   // ISO date of left edge of gantt
  showCriticalPath: boolean
}

// ─── Store Events ─────────────────────────────────────────────────────────────

export type StoreEvent =
  | { type: 'task:add';    payload: Task }
  | { type: 'task:update'; payload: Task }
  | { type: 'task:delete'; payload: string }
  | { type: 'task:reorder'; payload: Task[] }
  | { type: 'project:update'; payload: Partial<ProjectData> }
  | { type: 'data:load' }
