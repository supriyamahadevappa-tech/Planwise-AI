import { BookOpen, CalendarDays, Clock3, Pencil, Trash2 } from 'lucide-react'
import type { Task } from '../types'
import './TaskCard.css'

type Props = {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onToggleComplete: (id: string, completed: boolean) => void
}

export default function TaskCard({ task, onEdit, onDelete, onToggleComplete }: Props) {
  const deadline = new Date(`${task.deadline}T00:00:00`)
  return (
    <article className={`task-card${task.completed ? ' task-card--completed' : ''}`}>
      <label className="task-card__check" aria-label={`Mark ${task.title} ${task.completed ? 'unfinished' : 'complete'}`}>
        <input type="checkbox" checked={task.completed} onChange={event => onToggleComplete(task.id, event.target.checked)} />
        <span />
      </label>
      <div className="task-card__icon" aria-hidden="true"><BookOpen size={19} /></div>
      <div className="task-card__main">
        <div className="task-card__heading">
          <h3>{task.title}</h3>
          <span className={`priority-pill priority-pill--${task.priority.toLowerCase()}`}>{task.priority}</span>
        </div>
        {task.description && <p className="task-card__description">{task.description}</p>}
        <div className="task-card__meta">
          <span><CalendarDays size={14} /> {deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span><Clock3 size={14} /> {task.estimatedMinutes} min</span>
        </div>
      </div>
      <div className="task-card__actions">
        <button className="icon-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}><Pencil size={17} /></button>
        <button className="icon-button icon-button--delete" type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}><Trash2 size={17} /></button>
      </div>
    </article>
  )
}
