export type Priority = 'High' | 'Medium' | 'Low'
export const MAX_FREE_MINUTES = 15

export type Task = {
  id: string
  title: string
  description: string
  deadline: string
  priority: Priority
  estimatedMinutes: number
  completed: boolean
}

export type StudyBlock = {
  id: string
  type: 'study'
  taskId: string
  task: Task
  durationMinutes: number
  sessionNumber: number
  totalSessions: number
  completed: boolean
}

export type BreakBlock = {
  id: string
  type: 'break'
  kind: 'tea' | 'freshAir' | 'powerNap' | 'eyeRest' | 'music'
  durationMinutes: number
}

export type FreeTimeBlock = {
  id: string
  type: 'free'
  durationMinutes: number
}

export type PlanBlock = StudyBlock | BreakBlock | FreeTimeBlock

export type UnscheduledTask = {
  task: Task
  reason: string
  completedWorkMinutesBefore: number
  plannedMinutesToday: number
  remainingMinutesAfterToday: number
}

export type ComingUpTask = {
  task: Task
  completedWorkMinutes: number
  remainingMinutes: number
}

export type StudyPlan = {
  id: string
  source: 'Basic'
  generatedAt: string
  availableMinutes: number
  outdated: boolean
  blocks: PlanBlock[]
  unscheduled: UnscheduledTask[]
  comingUp: ComingUpTask[]
  completedWorkMinutesBefore: Record<string, number>
}

export type SavedAppState = {
  schemaVersion: 2
  tasks: Task[]
  availableMinutes: number | null
  latestPlan: StudyPlan | null
}

export const EMPTY_APP_STATE: SavedAppState = {
  schemaVersion: 2,
  tasks: [],
  availableMinutes: null,
  latestPlan: null,
}
