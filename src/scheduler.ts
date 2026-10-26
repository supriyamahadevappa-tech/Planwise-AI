import { MAX_FREE_MINUTES, type BreakBlock, type PlanBlock, type StudyPlan, type Task, type UnscheduledTask, type ComingUpTask } from './types'

export const FOCUS_MINUTES = 45
export const BREAK_MINUTES = 10
export const URGENT_WINDOW_DAYS = 7

const priorityRank: Record<Task['priority'], number> = { High: 0, Medium: 1, Low: 2 }
const breakKinds: BreakBlock['kind'][] = ['tea', 'freshAir', 'powerNap', 'eyeRest', 'music']

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const dateOrder = left.deadline.localeCompare(right.deadline)
    if (dateOrder) return dateOrder
    const priorityOrder = priorityRank[left.priority] - priorityRank[right.priority]
    if (priorityOrder) return priorityOrder
    return left.estimatedMinutes - right.estimatedMinutes || left.id.localeCompare(right.id)
  })
}

export function daysUntilDeadline(deadline: string, now = new Date()): number {
  const [year, month, day] = deadline.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  const deadlineDay = Date.UTC(year, month - 1, day)
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay)
  return Math.floor((deadlineDay - today) / 86_400_000)
}

export function formatDeadline(deadline: string, now = new Date()): string {
  const days = daysUntilDeadline(deadline, now)
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7) return `Due in ${days} days`
  return `Due ${new Date(`${deadline}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function taskIsUsable(task: Task): boolean {
  return Boolean(task && typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim() &&
    typeof task.deadline === 'string' && !Number.isNaN(Date.parse(`${task.deadline}T00:00:00`)) &&
    ['High', 'Medium', 'Low'].includes(task.priority) && Number.isFinite(task.estimatedMinutes) && task.estimatedMinutes > 0)
}

export type PlanResult = { kind: 'ready'; plan: StudyPlan } | { kind: 'invalid'; error: string }

function getPriorCompletedWork(previousPlan?: StudyPlan | null): Record<string, number> {
  const completed = { ...(previousPlan?.completedWorkMinutesBefore ?? {}) }
  previousPlan?.blocks.forEach(block => {
    if (block.type === 'study' && block.completed) completed[block.taskId] = (completed[block.taskId] ?? 0) + block.durationMinutes
  })
  return completed
}

export function buildBasicPlan(
  tasks: Task[],
  availableMinutes: number | null,
  previousPlan?: StudyPlan | null,
  now = new Date(),
): PlanResult {
  if (availableMinutes === null || !Number.isFinite(availableMinutes) || availableMinutes < 0) {
    return { kind: 'invalid', error: "Add today's available study time before making a plan." }
  }
  const activeTasks = tasks.filter(task => !task.completed)
  if (activeTasks.length === 0) return { kind: 'invalid', error: 'Your task list is clear. Add a task when you are ready to plan.' }
  const invalidTask = activeTasks.find(task => !taskIsUsable(task))
  if (invalidTask) return { kind: 'invalid', error: `“${invalidTask.title || 'This task'}” has a missing or invalid deadline, priority, or duration. Please review its details.` }

  const completedWorkMinutesBefore = getPriorCompletedWork(previousPlan)
  const orderedTasks = sortTasks(activeTasks)
  const blocks: PlanBlock[] = []
  const unscheduled: UnscheduledTask[] = []
  const sessionCounts = new Map<string, number>()
  let usedMinutes = 0
  let focusMinutes = 0
  let breakNumber = 0

  for (const task of orderedTasks) {
    const completedBefore = Math.min(task.estimatedMinutes, completedWorkMinutesBefore[task.id] ?? 0)
    completedWorkMinutesBefore[task.id] = completedBefore
    const remaining = task.estimatedMinutes - completedBefore
    const breaksNeeded = Math.floor((focusMinutes + remaining - 1) / FOCUS_MINUTES)
    const requiredMinutes = remaining + breaksNeeded * BREAK_MINUTES

    if (requiredMinutes <= availableMinutes - usedMinutes) {
      let workLeft = remaining
      while (workLeft > 0) {
        if (focusMinutes === FOCUS_MINUTES) {
          blocks.push({ id: crypto.randomUUID(), type: 'break', kind: breakKinds[breakNumber++ % breakKinds.length], durationMinutes: BREAK_MINUTES })
          usedMinutes += BREAK_MINUTES
          focusMinutes = 0
        }

        const sessionMinutes = Math.min(workLeft, FOCUS_MINUTES - focusMinutes)
        const sessionNumber = (sessionCounts.get(task.id) ?? 0) + 1
        sessionCounts.set(task.id, sessionNumber)
        blocks.push({
          id: crypto.randomUUID(), type: 'study', taskId: task.id, task,
          durationMinutes: sessionMinutes, sessionNumber, totalSessions: 0, completed: false,
        })
        usedMinutes += sessionMinutes
        focusMinutes += sessionMinutes
        workLeft -= sessionMinutes
      }
    } else {
      const availableLeft = Math.max(0, availableMinutes - usedMinutes)
      const reason = `The full ${remaining}-minute task and its required breaks do not fit in today's remaining ${availableLeft} minutes. Increase your study time, remove a task, or plan it for another day.`
      unscheduled.push({ task, reason, completedWorkMinutesBefore: completedBefore, plannedMinutesToday: 0, remainingMinutesAfterToday: remaining })
    }
  }

  for (const block of blocks) {
    if (block.type !== 'study') continue
    block.totalSessions = sessionCounts.get(block.taskId) ?? 1
  }

  const freeMinutes = Math.min(MAX_FREE_MINUTES, availableMinutes - usedMinutes)
  if (freeMinutes > 0) blocks.push({ id: crypto.randomUUID(), type: 'free', durationMinutes: freeMinutes })

  const unscheduledIds = new Set(unscheduled.map(item => item.task.id))
  const comingUp: ComingUpTask[] = orderedTasks
    .filter(task => daysUntilDeadline(task.deadline, now) > URGENT_WINDOW_DAYS && !sessionCounts.has(task.id) && !unscheduledIds.has(task.id))
    .map(task => {
    const completedWorkMinutes = Math.min(task.estimatedMinutes, completedWorkMinutesBefore[task.id] ?? 0)
    completedWorkMinutesBefore[task.id] = completedWorkMinutes
    return { task, completedWorkMinutes, remainingMinutes: task.estimatedMinutes - completedWorkMinutes }
    })
    .filter(item => item.remainingMinutes > 0)

  return {
    kind: 'ready',
    plan: {
      id: crypto.randomUUID(), source: 'Basic', generatedAt: new Date().toISOString(), availableMinutes,
      outdated: false, blocks, unscheduled, comingUp, completedWorkMinutesBefore,
    },
  }
}

export function planTotals(plan: StudyPlan) {
  return plan.blocks.reduce((totals, block) => {
    if (block.type === 'study') totals.studyMinutes += block.durationMinutes
    else if (block.type === 'break') totals.breakMinutes += block.durationMinutes
    else totals.freeMinutes += block.durationMinutes
    return totals
  }, { studyMinutes: 0, breakMinutes: 0, freeMinutes: 0 })
}
