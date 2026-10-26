import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, BookOpenCheck, Check, Clock3, Coffee, Eye, Leaf, Moon, Music2, Plus, Sparkles } from 'lucide-react'
import TaskCard from './components/TaskCard'
import TaskModal from './components/TaskModal'
import { setStudySessionCompletion, setTaskCompletion } from './completion'
import { buildBasicPlan, formatDeadline, planTotals } from './scheduler'
import { loadAppState, saveAppState } from './storage'
import type { PlanBlock, SavedAppState, StudyPlan, Task } from './types'

const initial = loadAppState()

function formatMinutes(minutes: number): string {
  const safe = Math.max(0, minutes)
  const hours = Math.floor(safe / 60)
  const rest = Math.round((safe % 60) * 10) / 10
  const restLabel = Number.isInteger(rest) ? String(rest) : rest.toFixed(1)
  if (hours === 0) return `${restLabel} min`
  return rest === 0 ? `${hours} hr` : `${hours} hr ${restLabel} min`
}

function markPlanOutdated(state: SavedAppState): SavedAppState {
  return state.latestPlan && !state.latestPlan.outdated
    ? { ...state, latestPlan: { ...state.latestPlan, outdated: true } }
    : state
}

function plansHaveSameInputs(left: Task, right: Task): boolean {
  return left.title === right.title && left.description === right.description &&
    left.deadline === right.deadline && left.priority === right.priority &&
    left.estimatedMinutes === right.estimatedMinutes
}

export default function App() {
  const [appState, setAppState] = useState<SavedAppState>(initial.state)
  const [hoursInput, setHoursInput] = useState(initial.state.availableMinutes === null ? '' : String(initial.state.availableMinutes / 60))
  const [storageNotice, setStorageNotice] = useState(initial.notice)
  const [modalTask, setModalTask] = useState<Task | null | undefined>(undefined)
  const [taskMessage, setTaskMessage] = useState('')
  const [planMessage, setPlanMessage] = useState('')
  const [planError, setPlanError] = useState('')

  useEffect(() => { saveAppState(appState) }, [appState])

  function saveTask(task: Task) {
    const existed = appState.tasks.some(item => item.id === task.id)
    setAppState(current => {
      const previous = current.tasks.find(item => item.id === task.id)
      const next = { ...current, tasks: previous
        ? current.tasks.map(item => item.id === task.id ? task : item)
        : [task, ...current.tasks] }
      return previous && plansHaveSameInputs(previous, task) ? next : markPlanOutdated(next)
    })
    setTaskMessage(existed ? 'Your task details are updated.' : 'Task added to your list.')
    setPlanMessage('')
    setModalTask(undefined)
  }

  function deleteTask(id: string) {
    const task = appState.tasks.find(item => item.id === id)
    if (!task || !window.confirm(`Remove “${task.title}” from your list?`)) return
    setAppState(current => markPlanOutdated({ ...current, tasks: current.tasks.filter(item => item.id !== id) }))
    setTaskMessage('Task removed from your list.')
    setPlanMessage('')
  }

  function toggleTaskComplete(id: string, completed: boolean) {
    setAppState(current => setTaskCompletion(current, id, completed))
  }

  function changeHours(value: string) {
    setHoursInput(value)
    let availableMinutes: number | null = null
    if (value.trim()) {
      const hours = Number(value)
      availableMinutes = Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 60) : null
    }
    setAppState(current => {
      if (current.availableMinutes === availableMinutes) return current
      return markPlanOutdated({ ...current, availableMinutes })
    })
    setPlanMessage('')
  }

  function generatePlan() {
    setPlanError('')
    setPlanMessage('')
    const result = buildBasicPlan(appState.tasks, appState.availableMinutes, appState.latestPlan)
    if (result.kind === 'invalid') {
      setPlanError(result.error)
      return
    }
    setAppState(current => ({ ...current, latestPlan: result.plan }))
    const hasStudyTime = result.plan.blocks.some(block => block.type === 'study')
    setPlanMessage(hasStudyTime
      ? result.plan.unscheduled.length > 0
        ? 'Your Basic Plan is ready. Unscheduled tasks and next steps are listed below.'
        : result.plan.comingUp.length > 0
          ? 'Your plan for today is ready. Later-deadline tasks are saved for another day.'
          : 'Your Basic Plan is ready for today.'
      : result.plan.unscheduled.length > 0
        ? 'No complete task fits in today’s available time. See the unscheduled tasks below.'
        : result.plan.comingUp.length > 0
          ? 'No tasks are due soon. Your later tasks are saved below for another day.'
          : 'There is no unfinished study work to schedule today.')
  }

  function togglePlannedSession(blockId: string, completed: boolean) {
    setAppState(current => setStudySessionCompletion(current, blockId, completed))
  }

  const activeTasks = useMemo(() => appState.tasks.filter(task => !task.completed), [appState.tasks])
  const taskMinutes = activeTasks.reduce((total, task) => total + task.estimatedMinutes, 0)
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  const plan = appState.latestPlan
  const totals = plan ? planTotals(plan) : { studyMinutes: 0, breakMinutes: 0, freeMinutes: 0 }
  const canGenerate = appState.tasks.some(task => !task.completed) && appState.availableMinutes !== null
  const invalidHours = hoursInput.trim() !== '' && (!Number.isFinite(Number(hoursInput)) || Number(hoursInput) < 0)
  const topButtonLabel = plan ? 'Regenerate Basic Plan' : 'Use Basic Plan'

  return (
    <div className="app-shell" id="home">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="PlanWise home">
          <span className="brand__mark"><BookOpenCheck size={20} /></span>
          <span>planwise<span className="brand__ai">.ai</span></span>
        </a>
        <div className="topbar__note"><span className="topbar__dot" /> Your little corner of productivity</div>
      </header>

      <main className="dashboard">
        <section className="welcome-card">
          <div className="welcome-card__copy">
            <p className="welcome-date">{today} <span>✳</span></p>
            <h1>Heyyy, what's the vibe today? ✨</h1>
            <p className="welcome-subtitle">Got things to do? Let's make a plan that actually works for you.</p>
            <div className="welcome-actions">
              <button className="button button--primary" type="button" onClick={generatePlan} disabled={!canGenerate}>
                <Sparkles size={16} /> {topButtonLabel}
              </button>
              <button className="button button--paper" type="button" onClick={() => setModalTask(null)}><Plus size={16} /> Add a task</button>
            </div>
            {!canGenerate && <p className="welcome-hint">{activeTasks.length === 0 ? 'Your list is clear. Add a task whenever you are ready.' : "Set today's study hours to make a plan."}</p>}
          </div>
          <div className="hero-art" aria-hidden="true">
            <svg className="hero-art__scribble" viewBox="0 0 420 300" fill="none">
              <path d="M39 226c17-12 20-30 36-37 9-4 16 2 10 10-4 6-12 6-17 3 7-20 25-39 40-50 6-4 13 1 8 7-5 5-15 4-20 1 12-15 22-31 26-49" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M333 42c8 0 8 12 0 12s-8-12 0-12Zm30 40c8 0 8 12 0 12s-8-12 0-12Zm-283-9 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <div className="hero-art__halo" />
            <div className="journal-book"><div className="journal-book__spine"/><div className="journal-book__title">little steps<br/><span>big dreams</span></div><div className="journal-book__doodle">✿</div></div>
            <div className="sticky-note"><span>today's note</span><i>one thing<br/>at a time ♡</i></div>
            <div className="pencil" />
            <div className="paper-clip" />
            <div className="hero-star hero-star--one">✦</div><div className="hero-star hero-star--two">✧</div>
          </div>
        </section>

        {storageNotice && <div className="storage-notice" role="status">{storageNotice}<button type="button" onClick={() => setStorageNotice(null)} aria-label="Dismiss notice">×</button></div>}
        {taskMessage && <div className="task-message" role="status"><Check size={14}/>{taskMessage}<button type="button" onClick={() => setTaskMessage('')} aria-label="Dismiss message">×</button></div>}

        <section className="overview-grid" aria-label="Today's study details">
          <article className="overview-card overview-card--time">
            <div className="overview-card__top"><span className="overview-icon"><Clock3 size={17} /></span><span className="overview-kicker">Your time, your pace</span></div>
            <label className="hours-entry"><input aria-label="Available study hours today" type="number" min="0" step="0.25" value={hoursInput} onChange={event => changeHours(event.target.value)} placeholder="0" /><span>hours to study today</span></label>
            <p className={invalidHours ? 'overview-hint overview-hint--error' : 'overview-hint'}>{invalidHours ? 'Enter zero or more hours.' : 'Breaks count in your available time.'}</p>
          </article>
          <article className="overview-card overview-card--tasks">
            <div className="overview-card__top"><span className="overview-icon overview-icon--pink"><BookOpenCheck size={17} /></span><span className="overview-kicker">What's on your mind?</span></div>
            <div className="overview-number">{activeTasks.length}<span> {activeTasks.length === 1 ? 'task' : 'tasks'} to plan</span></div>
            <p className="overview-hint">{taskMinutes ? `${formatMinutes(taskMinutes)} across your saved tasks` : 'Start with whatever is on your list.'}</p>
          </article>
          <aside className="scribble-note"><Sparkles size={17}/><p>A little progress is still progress.</p><span>PlanWise note to self</span></aside>
        </section>

        <section className="workspace-grid">
          <section className="tasks-section paper-panel" aria-labelledby="tasks-title">
            <div className="section-heading">
              <div><p className="eyebrow">What's on your mind today?</p><h2 id="tasks-title">My task list <span className="count-badge">{activeTasks.length}</span></h2></div>
              <button className="button button--outline" type="button" onClick={() => setModalTask(null)}><Plus size={15} /> Add task</button>
            </div>
            {appState.tasks.length ? <div className="task-list">{appState.tasks.map(task => <TaskCard key={task.id} task={task} onEdit={setModalTask} onDelete={deleteTask} onToggleComplete={toggleTaskComplete} />)}</div> : (
              <div className="empty-state"><div className="empty-state__illustration"><BookOpenCheck size={22}/><span>✳</span></div><h3>Your list is a fresh page</h3><p>Add a task to your list and we'll help you find a good place to start.</p><button className="button button--soft" type="button" onClick={() => setModalTask(null)}><Plus size={15}/> Add your first task</button></div>
            )}
          </section>

          <aside className="time-panel paper-panel">
            <div className="time-panel__tape" />
            <p className="eyebrow">A plan that feels doable</p>
            <h2>Let's make a<br/>realistic plan</h2>
            <div className="time-panel__doodle"><Leaf size={18}/><span>✎</span></div>
            <p className="time-panel__copy">We'll fit whole tasks into the hours you have, with a little breathing room between focus sessions.</p>
            <div className="time-panel__art" aria-hidden="true">
              <svg viewBox="0 0 260 150" role="presentation">
                <rect x="24" y="26" width="145" height="104" rx="10" fill="#fff" stroke="#ddd2ef" strokeWidth="2" transform="rotate(-5 24 26)" />
                <path d="m50 55 7 7 13-15M78 57h58M49 79l7 7 13-15M78 81h67M49 103l7 7 13-15M78 105h48" fill="none" stroke="#9b83c2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M178 34 228 19l21 83-50 14z" fill="#f7e6ef" stroke="#d8b8ca" strokeWidth="2" />
                <path d="m186 44 34-10M192 62l34-10M197 80l34-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <path d="m194 113 5-7 50-14-5 10z" fill="#8a70b7" />
                <path d="m210 27 8-3 3 10" fill="#d6c4ee" />
                <path d="M29 127c28 11 59 13 93 7" fill="none" stroke="#c48eaa" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 7" />
                <path d="m216 122 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#c48eaa" />
              </svg>
              <span>one thing at a time ✦</span>
            </div>
            <div className="time-panel__promise"><Check size={14}/> Made right here on your device</div>
          </aside>
        </section>

        <section className="plan-section" id="today-plan" aria-labelledby="plan-title">
          <div className="section-heading plan-section__heading">
            <div><p className="eyebrow">A gentle rhythm for the day</p><h2 id="plan-title">Today's Study Plan</h2></div>
          </div>
          {planError && <div className="plan-message plan-message--error" role="alert">{planError}</div>}
          {planMessage && <div className="plan-message plan-message--success" role="status"><Check size={16}/>{planMessage}</div>}
          {!plan && <div className="plan-empty"><div className="plan-empty__icon"><ArrowDown size={19}/></div><div><strong>Your plan will show up here</strong><p>Add a task and your available hours, then choose “Generate My Study Plan.”</p></div></div>}
          {plan && plan.outdated && <div className="outdated-plan" role="status"><div className="outdated-plan__art" aria-hidden="true">✎</div><div><strong>This saved plan is out of date</strong><p>Your tasks or study hours changed, so this timeline is hidden until you make a fresh plan with the button above.</p></div></div>}
          {plan && !plan.outdated && <PlanView plan={plan} totals={totals} tasks={appState.tasks} onToggleSession={togglePlannedSession} />}
        </section>

        <footer className="privacy-note">Your tasks, study hours and latest plan stay in this browser on this device.</footer>
      </main>
      {modalTask !== undefined && <TaskModal task={modalTask ?? undefined} onClose={() => setModalTask(undefined)} onSave={saveTask} />}
    </div>
  )
}

function PlanView({
  plan,
  totals,
  tasks,
  onToggleSession,
}: {
  plan: StudyPlan
  totals: { studyMinutes: number; breakMinutes: number; freeMinutes: number }
  tasks: Task[]
  onToggleSession: (blockId: string, completed: boolean) => void
}) {
  const studyBlocks = plan.blocks.filter((block): block is Extract<PlanBlock, { type: 'study' }> => block.type === 'study')
  const completedSessions = studyBlocks.filter(block => block.completed).length
  const completedTasks = tasks.filter(task => task.completed).length
  const workRemaining = plan.unscheduled.map(item => {
    const completedInPlan = studyBlocks.filter(block => block.taskId === item.task.id && block.completed).reduce((sum, block) => sum + block.durationMinutes, 0)
    return { ...item, remainingNow: Math.max(0, item.task.estimatedMinutes - item.completedWorkMinutesBefore - completedInPlan) }
  })

  return (
    <div className="plan-view">
      <div className="plan-label"><span className="plan-label__dot"/><div><strong>Today's Study Plan</strong><span>Basic Plan · made right here on your device</span></div><time>{new Date(plan.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time><PlanHeaderArt/></div>
      <div className="plan-stats">
        <div><span>Study time</span><strong>{formatMinutes(totals.studyMinutes)}</strong></div>
        <div><span>Planned breaks</span><strong>{formatMinutes(totals.breakMinutes)}</strong></div>
        <div><span>Free time</span><strong>{formatMinutes(totals.freeMinutes)}</strong></div>
        <div><span>Coming up</span><strong>{plan.comingUp.length} {plan.comingUp.length === 1 ? 'task' : 'tasks'}</strong></div>
      </div>
      <div className="progress-pair"><span>Study sessions <strong>{completedSessions} of {studyBlocks.length} done</strong></span><span>Tasks completed <strong>{completedTasks} of {tasks.length} done</strong></span></div>
      {plan.blocks.length > 0 ? <div className="timeline" aria-label="Study timeline">
        {plan.blocks.map((block: PlanBlock, index) => {
          if (block.type === 'break') return <BreakCard block={block} key={block.id}/>
          if (block.type === 'free') return <FreeTimeCard block={block} key={block.id}/>
          return <article className={`timeline-study${block.completed ? ' timeline-study--completed' : ''}`} key={block.id}>
            <div className="timeline-study__rail"><span>{String(index + 1).padStart(2, '0')}</span></div>
            <div className="timeline-study__body">
              <div className="timeline-study__meta"><span className="session-label">Focus session {block.totalSessions > 1 ? `${block.sessionNumber} of ${block.totalSessions}` : ''}</span><span className={`priority-pill priority-pill--${block.task.priority.toLowerCase()}`}>{block.task.priority}</span></div>
              <h3>{block.task.title}</h3>
              {block.task.description && <p className="timeline-study__description">{block.task.description}</p>}
              <div className="timeline-study__footer"><span className="session-time"><Clock3 size={14}/>{formatMinutes(block.durationMinutes)}</span>{block.sessionNumber === block.totalSessions && block.totalSessions > 1 && <span className="session-note">Full estimate: {formatMinutes(block.task.estimatedMinutes)}</span>}</div>
            </div>
            <label className="complete-control"><input type="checkbox" aria-label={`Mark focus session ${block.sessionNumber} for ${block.task.title} ${block.completed ? 'not complete' : 'complete'}`} checked={block.completed} onChange={event => onToggleSession(block.id, event.target.checked)}/><span>{block.completed ? 'Done' : 'Complete session'}</span></label>
          </article>
        })}
      </div> : <div className="plan-empty plan-empty--ready"><div className="plan-empty__icon"><Check size={18}/></div><div><strong>{plan.unscheduled.length ? 'No complete task fits today' : plan.comingUp.length ? 'Your later work is saved' : 'Your list is clear'}</strong><p>{plan.unscheduled.length ? 'Tasks stay whole: nothing was shortened or partly scheduled.' : plan.comingUp.length ? 'Tasks with more time before their deadlines are saved for another day.' : 'There is no unfinished study work to schedule today.'}</p></div></div>}
      {workRemaining.length > 0 && <section className="unscheduled-section" aria-labelledby="remaining-title"><div className="unscheduled-section__heading"><div><p className="eyebrow">Keep your next steps in view</p><h3 id="remaining-title">Unscheduled tasks <span className="count-badge">{workRemaining.length}</span></h3></div><span className="section-doodle" aria-hidden="true">✳</span></div><div className="unscheduled-list">{workRemaining.map(({ task, reason, remainingNow }) => <article className="unscheduled-card" key={task.id}><div className="unscheduled-card__title"><strong>{task.title}</strong><span>{formatDeadline(task.deadline)}</span></div><p className="work-remaining__numbers">Estimated work remaining: {formatMinutes(remainingNow)}</p><p>{reason}</p></article>)}</div><p className="unscheduled-help">You can increase your available study hours, remove a task, or plan it for another day. Each task keeps its original estimate.</p></section>}
      {plan.comingUp.length > 0 && <section className="coming-up-section" aria-labelledby="coming-up-title"><div className="coming-up-section__heading"><div><p className="eyebrow">There is time before these</p><h3 id="coming-up-title">Save for another day <span className="count-badge">{plan.comingUp.length}</span></h3></div><div className="coming-up-art" aria-hidden="true"><span>✦</span><i>little by little</i></div></div><div className="coming-up-list">{plan.comingUp.map(({ task, remainingMinutes }) => <article className="coming-up-card" key={task.id}><div className="coming-up-card__title"><span className="coming-up-card__icon" aria-hidden="true">✎</span><strong>{task.title}</strong><span className={`priority-pill priority-pill--${task.priority.toLowerCase()}`}>{task.priority}</span></div><p>{formatMinutes(remainingMinutes)} remaining <span>·</span> {formatDeadline(task.deadline)}</p></article>)}</div></section>}
    </div>
  )
}

function PlanHeaderArt() {
  return <svg className="plan-header-art" viewBox="0 0 128 76" role="img" aria-label="Illustration of a notebook, pen and sticky note">
    <path d="m6 58 17-8M109 13l8-7M105 65l14 3" stroke="#a88fc9" strokeWidth="2" strokeLinecap="round"/>
    <path d="M28 12h51a5 5 0 0 1 5 5v47H32a5 5 0 0 1-5-5V17a5 5 0 0 1 1-5Z" fill="#fffdf8" stroke="#d8cbe9" strokeWidth="2"/>
    <path d="M36 24h37M36 33h32M36 42h36M36 51h27" stroke="#c6b8dd" strokeWidth="2" strokeLinecap="round"/>
    <path d="m91 53 18-34 7 4-18 34-10 6 3-10Z" fill="#e7bfd1" stroke="#b886a4" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M93 55 101 59" stroke="#846bb3" strokeWidth="2"/>
    <path d="m91 8 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#c58da9"/>
  </svg>
}

const breakCopy = {
  tea: { title: 'A cozy tea break', note: 'Make a cup of tea and enjoy a few peaceful minutes.', Icon: Coffee },
  freshAir: { title: 'A little fresh air', note: 'Take a short walk and let your mind breathe.', Icon: Leaf },
  powerNap: { title: 'Rest and recharge', note: 'Feeling sleepy? Take a little rest and reset.', Icon: Moon },
  eyeRest: { title: 'Give your eyes a rest', note: 'Look away from your screen and stretch gently.', Icon: Eye },
  music: { title: 'A moment of music', note: 'Play a calming song and let your mind slow down.', Icon: Music2 },
} as const

function FreeTimeCard({ block }: { block: Extract<PlanBlock, { type: 'free' }> }) {
  return <article className="timeline-free" aria-label={`Free time, ${block.durationMinutes} minutes`}>
    <svg className="timeline-free__art" viewBox="0 0 64 52" aria-hidden="true">
      <path d="M20 16h24v22a7 7 0 0 1-7 7h-10a7 7 0 0 1-7-7V16Z" fill="#fff" stroke="#9278b4" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M44 21h5a7 7 0 0 1 0 14h-5M25 10c-4-4 4-5 0-9M35 10c-4-4 4-5 0-9" fill="none" stroke="#c48eaa" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 25h16" stroke="#d8c8ed" strokeWidth="2" strokeLinecap="round" />
      <path d="m11 41 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#c48eaa" />
    </svg>
    <div><strong>Free time</strong><span>Enjoy some tea, stretch, or relax!</span></div>
    <b>{formatMinutes(block.durationMinutes)}</b>
  </article>
}

function BreakCard({ block }: { block: Extract<PlanBlock, { type: 'break' }> }) {
  const suggestion = breakCopy[block.kind]
  const Icon = suggestion.Icon
  return <article className={`timeline-break timeline-break--${block.kind}`} aria-label={`${suggestion.title}, ${block.durationMinutes} minutes`}>
    <div className="timeline-break__line"/><span className="timeline-break__icon" aria-hidden="true"><Icon size={19}/><i>✦</i></span><div><strong>{suggestion.title}</strong><span>{suggestion.note}</span></div><b>{formatMinutes(block.durationMinutes)}</b>
  </article>
}
