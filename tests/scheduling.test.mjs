import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

async function loadTypeScriptModule(path) {
  const entryPoint = fileURLToPath(new URL(path, import.meta.url))
  const { outputFiles } = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    target: 'es2022',
  })
  const code = outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const scheduler = await loadTypeScriptModule('../src/scheduler.ts')
const storage = await loadTypeScriptModule('../src/storage.ts')
const completion = await loadTypeScriptModule('../src/completion.ts')
const task = (estimatedMinutes, overrides = {}) => ({
  id: 'task-1',
  title: 'Prepare biology notes',
  description: '',
  deadline: '2026-10-27',
  priority: 'High',
  estimatedMinutes,
  completed: false,
  ...overrides,
})

function readyPlan(estimatedMinutes, availableMinutes, previousPlan = null) {
  const result = scheduler.buildBasicPlan(
    [task(estimatedMinutes)],
    availableMinutes,
    previousPlan,
    new Date('2026-10-26T12:00:00Z'),
  )
  assert.equal(result.kind, 'ready')
  return result.plan
}

const studyMinutes = plan => plan.blocks
  .filter(block => block.type === 'study')
  .reduce((sum, block) => sum + block.durationMinutes, 0)
const freeMinutes = plan => plan.blocks
  .filter(block => block.type === 'free')
  .reduce((sum, block) => sum + block.durationMinutes, 0)

test('45-minute task gets 45 minutes of study and 15 minutes of free time in 60 minutes', () => {
  const plan = readyPlan(45, 60)
  assert.equal(studyMinutes(plan), 45)
  assert.equal(freeMinutes(plan), 15)
})

test('tasks sort by deadline, then priority, then shorter estimate', () => {
  const tasks = [
    task(30, { id: 'high-long', deadline: '2026-10-27', priority: 'High' }),
    task(15, { id: 'high-short', deadline: '2026-10-27', priority: 'High' }),
    task(20, { id: 'medium', deadline: '2026-10-27', priority: 'Medium' }),
    task(5, { id: 'earlier-deadline', deadline: '2026-10-26', priority: 'Low' }),
    task(10, { id: 'low', deadline: '2026-10-27', priority: 'Low' }),
  ]
  assert.deepEqual(scheduler.sortTasks(tasks).map(item => item.id), [
    'earlier-deadline', 'high-short', 'high-long', 'medium', 'low',
  ])
})

test('90-minute task keeps both study sessions and counts the 10-minute break', () => {
  const plan = readyPlan(90, 120)
  assert.deepEqual(plan.blocks.filter(block => block.type === 'study').map(block => block.durationMinutes), [45, 45])
  assert.equal(plan.blocks.filter(block => block.type === 'break').reduce((sum, block) => sum + block.durationMinutes, 0), scheduler.BREAK_MINUTES)
  assert.equal(scheduler.BREAK_MINUTES, 10)
  assert.equal(studyMinutes(plan), 90)
  assert.equal(freeMinutes(plan), 15)
  assert.equal(plan.blocks.reduce((sum, block) => sum + block.durationMinutes, 0), 115)
  assert.ok(plan.blocks.reduce((sum, block) => sum + block.durationMinutes, 0) <= 120)
})

test('saved and restored plans preserve study sessions and cap only unused time', () => {
  const plan = readyPlan(90, 120)
  const appState = { schemaVersion: 2, tasks: [task(90)], availableMinutes: 120, latestPlan: plan }
  const saved = new Map()
  globalThis.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  }

  storage.saveAppState(appState)
  const restored = storage.loadAppState()
  assert.equal(restored.state.latestPlan.blocks.filter(block => block.type === 'study').length, 2)
  assert.equal(studyMinutes(restored.state.latestPlan), 90)
  assert.equal(freeMinutes(restored.state.latestPlan), 15)
  assert.equal(restored.notice, null)
})

test('a task that does not fully fit stays whole while later tasks are checked', () => {
  const largeTask = task(90, { id: 'large', deadline: '2026-10-27' })
  const laterTask = task(45, { id: 'later-short', deadline: '2026-10-28' })
  const result = scheduler.buildBasicPlan([largeTask, laterTask], 60, null, new Date('2026-10-26T12:00:00Z'))
  assert.equal(result.kind, 'ready')
  const plan = result.plan
  assert.deepEqual(plan.blocks.filter(block => block.type === 'study').map(block => block.taskId), ['later-short'])
  assert.equal(studyMinutes(plan), 45)
  assert.equal(plan.unscheduled.length, 1)
  assert.equal(plan.unscheduled[0].task.id, 'large')
  assert.equal(plan.unscheduled[0].plannedMinutesToday, 0)
  assert.equal(plan.unscheduled[0].remainingMinutesAfterToday, 90)
  assert.equal(plan.unscheduled[0].task.estimatedMinutes, 90)
  assert.match(plan.unscheduled[0].reason, /increase your study time, remove a task, or plan it for another day/i)
  assert.equal(freeMinutes(plan), 15)
})

test('restoring a legacy all-free plan does not create or drop task work', () => {
  const oldPlan = readyPlan(45, 60)
  oldPlan.blocks = oldPlan.blocks.filter(block => block.type === 'free')
  const saved = new Map([['planwise-ai:app-state', JSON.stringify({
    schemaVersion: 2,
    tasks: [task(45)],
    availableMinutes: 60,
    latestPlan: oldPlan,
  })]])
  globalThis.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  }

  const restored = storage.loadAppState()
  assert.equal(studyMinutes(restored.state.latestPlan), 0)
  assert.equal(freeMinutes(restored.state.latestPlan), 15)

  const regenerated = readyPlan(45, 60, restored.state.latestPlan)
  assert.equal(studyMinutes(regenerated), 45)
  assert.equal(freeMinutes(regenerated), 15)
})

test('reopening a completed task clears stale completed sessions before regeneration', () => {
  const taskRecord = task(45, { completed: true })
  const plan = readyPlan(45, 60)
  plan.blocks = plan.blocks.map(block => block.type === 'study' ? { ...block, completed: true } : block)
  const state = {
    schemaVersion: 2,
    tasks: [taskRecord],
    availableMinutes: 60,
    latestPlan: plan,
  }

  const reopened = completion.setTaskCompletion(state, taskRecord.id, false)
  const reopenedStudyBlock = reopened.latestPlan.blocks.find(block => block.type === 'study')
  assert.equal(reopenedStudyBlock.completed, false)
  assert.equal(reopened.latestPlan.completedWorkMinutesBefore[taskRecord.id], 0)
  assert.equal(reopened.tasks[0].completed, false)
  assert.equal(reopened.tasks[0].estimatedMinutes, 45)

  const regenerated = scheduler.buildBasicPlan(reopened.tasks, reopened.availableMinutes, reopened.latestPlan)
  assert.equal(regenerated.kind, 'ready')
  assert.equal(studyMinutes(regenerated.plan), 45)
  assert.equal(freeMinutes(regenerated.plan), 15)
})
