import { EMPTY_APP_STATE, MAX_FREE_MINUTES, type Priority, type SavedAppState, type StudyPlan, type Task } from './types'

const STORAGE_KEY = 'planwise-ai:app-state'
const priorities: Priority[] = ['High', 'Medium', 'Low']

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Record<string, unknown>
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' && task.title.trim().length > 0 &&
    typeof task.description === 'string' &&
    typeof task.deadline === 'string' && !Number.isNaN(Date.parse(task.deadline)) &&
    priorities.includes(task.priority as Priority) &&
    typeof task.estimatedMinutes === 'number' && Number.isFinite(task.estimatedMinutes) && task.estimatedMinutes > 0 &&
    (task.completed === undefined || typeof task.completed === 'boolean')
  )
}

function isStudyPlan(value: unknown): value is StudyPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as Record<string, unknown>
  if (
    typeof plan.id !== 'string' ||
    plan.source !== 'Basic' ||
    typeof plan.generatedAt !== 'string' || Number.isNaN(Date.parse(plan.generatedAt)) ||
    typeof plan.availableMinutes !== 'number' || !Number.isFinite(plan.availableMinutes) || plan.availableMinutes < 0 ||
    typeof plan.outdated !== 'boolean' ||
    !Array.isArray(plan.blocks) ||
    !Array.isArray(plan.unscheduled)
  ) return false

  let timelineMinutes = 0
  for (const item of plan.blocks) {
    if (!item || typeof item !== 'object') return false
    const block = item as Record<string, unknown>
    if (typeof block.id !== 'string' || typeof block.durationMinutes !== 'number' || !Number.isFinite(block.durationMinutes) || block.durationMinutes <= 0) return false
    timelineMinutes += block.durationMinutes
    if (block.type === 'study') {
      if (
        typeof block.taskId !== 'string' ||
        !isTask(block.task) || block.task.id !== block.taskId ||
        !Number.isInteger(block.sessionNumber) || Number(block.sessionNumber) < 1 ||
        !Number.isInteger(block.totalSessions) || Number(block.totalSessions) < Number(block.sessionNumber) ||
        typeof block.completed !== 'boolean'
      ) return false
    } else if (block.type === 'break') {
      if (block.kind !== undefined && !['tea', 'freshAir', 'powerNap', 'eyeRest', 'music'].includes(String(block.kind))) return false
    } else if (block.type === 'free') {
      // Free time is an explicit part of the student's available study window.
    } else return false
  }

  if (timelineMinutes > plan.availableMinutes) return false
  const validUnscheduled = plan.unscheduled.every(item => {
    if (!item || typeof item !== 'object') return false
    const unscheduled = item as Record<string, unknown>
    return isTask(unscheduled.task) && typeof unscheduled.reason === 'string' &&
      ['remainingMinutesAfterToday', 'plannedMinutesToday', 'completedWorkMinutesBefore'].every(key =>
        unscheduled[key] === undefined || (typeof unscheduled[key] === 'number' && Number.isFinite(unscheduled[key]) && Number(unscheduled[key]) >= 0))
  })
  if (!validUnscheduled) return false

  if (plan.comingUp !== undefined && (!Array.isArray(plan.comingUp) || !plan.comingUp.every(item => {
    if (!item || typeof item !== 'object') return false
    const comingUp = item as Record<string, unknown>
    return isTask(comingUp.task) && ['remainingMinutes', 'completedWorkMinutes'].every(key =>
      comingUp[key] === undefined || (typeof comingUp[key] === 'number' && Number.isFinite(comingUp[key]) && Number(comingUp[key]) >= 0))
  }))) return false

  if (plan.completedWorkMinutesBefore !== undefined) {
    if (!plan.completedWorkMinutesBefore || typeof plan.completedWorkMinutesBefore !== 'object' || Array.isArray(plan.completedWorkMinutesBefore)) return false
    if (!Object.values(plan.completedWorkMinutesBefore as Record<string, unknown>).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) return false
  }
  return true
}

function normalizeStudyPlan(plan: StudyPlan): StudyPlan {
  const kinds: NonNullable<Extract<StudyPlan['blocks'][number], { type: 'break' }>['kind']>[] = ['tea', 'freshAir', 'powerNap', 'eyeRest', 'music']
  let breakNumber = 0
  const normalizedBlocks = plan.blocks.filter(block => block.type !== 'free').map(block => {
    if (block.type !== 'break') return block
    const kind = block.kind ?? kinds[breakNumber % kinds.length]
    breakNumber += 1
    return { ...block, kind }
  })
  const timelineMinutes = normalizedBlocks.reduce((sum, block) => sum + block.durationMinutes, 0)
  const freeMinutes = Math.min(MAX_FREE_MINUTES, Math.max(0, plan.availableMinutes - timelineMinutes))
  const blocks = freeMinutes > 0
    ? [...normalizedBlocks, { id: crypto.randomUUID(), type: 'free' as const, durationMinutes: freeMinutes }]
    : normalizedBlocks
  const unscheduled = plan.unscheduled.map(item => ({
    ...item,
    completedWorkMinutesBefore: item.completedWorkMinutesBefore ?? 0,
    plannedMinutesToday: item.plannedMinutesToday ?? 0,
    remainingMinutesAfterToday: item.remainingMinutesAfterToday ?? item.task.estimatedMinutes,
  }))
  const comingUp = plan.comingUp?.map(item => ({
    ...item,
    completedWorkMinutes: item.completedWorkMinutes ?? 0,
    remainingMinutes: item.remainingMinutes ?? item.task.estimatedMinutes,
  })) ?? []
  const oldEmptyPlan = plan.availableMinutes > 0 && blocks.every(block => block.type === 'free') && comingUp.length > 0
  return { ...plan, outdated: plan.outdated || oldEmptyPlan, blocks, unscheduled, comingUp, completedWorkMinutesBefore: plan.completedWorkMinutesBefore ?? {} }
}

export function loadAppState(): { state: SavedAppState; notice: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { state: EMPTY_APP_STATE, notice: null }

    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') throw new Error('Saved data was not an object')
    const value = parsed as Record<string, unknown>
    if (![1, 2].includes(Number(value.schemaVersion)) || !Array.isArray(value.tasks)) throw new Error('Saved data has an unsupported format')

    const tasks = value.tasks.filter(isTask).map(task => ({ ...task, completed: task.completed ?? false }))
    const availableMinutes = value.availableMinutes
    const validMinutes = availableMinutes === null || (
      typeof availableMinutes === 'number' && Number.isFinite(availableMinutes) && availableMinutes >= 0
    )
    if (!validMinutes) throw new Error('Saved study time is invalid')

    const latestPlan = value.schemaVersion === 2 && value.latestPlan !== null && value.latestPlan !== undefined
      ? isStudyPlan(value.latestPlan) ? normalizeStudyPlan(value.latestPlan) : null
      : null
    const planWasSkipped = value.schemaVersion === 2 && value.latestPlan !== null && value.latestPlan !== undefined && latestPlan === null

    return {
      state: { schemaVersion: 2, tasks, availableMinutes: availableMinutes as number | null, latestPlan },
      notice: tasks.length !== value.tasks.length
        ? 'Some saved tasks could not be restored and were skipped.'
        : planWasSkipped ? 'The saved study plan could not be restored. Your tasks and hours are safe; make a fresh plan.' : null,
    }
  } catch {
    return {
      state: EMPTY_APP_STATE,
      notice: 'Saved information could not be read. You can continue with a fresh plan.',
    }
  }
}

export function saveAppState(state: SavedAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // The dashboard remains usable if browser storage is full or unavailable.
  }
}
