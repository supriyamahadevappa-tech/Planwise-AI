import type { SavedAppState } from './types'

export function setTaskCompletion(state: SavedAppState, taskId: string, completed: boolean): SavedAppState {
  const latestPlan = state.latestPlan
  const reopenedPlan = latestPlan && !completed
    ? {
      ...latestPlan,
      outdated: true,
      blocks: latestPlan.blocks.map(block => block.type === 'study' && block.taskId === taskId
        ? { ...block, completed: false }
        : block),
      completedWorkMinutesBefore: { ...latestPlan.completedWorkMinutesBefore, [taskId]: 0 },
    }
    : latestPlan ? { ...latestPlan, outdated: true } : null

  return {
    ...state,
    tasks: state.tasks.map(task => task.id === taskId ? { ...task, completed } : task),
    latestPlan: reopenedPlan,
  }
}

export function setStudySessionCompletion(state: SavedAppState, blockId: string, completed: boolean): SavedAppState {
  return {
    ...state,
    latestPlan: state.latestPlan ? {
      ...state.latestPlan,
      blocks: state.latestPlan.blocks.map(block => block.type === 'study' && block.id === blockId
        ? { ...block, completed }
        : block),
    } : null,
  }
}
