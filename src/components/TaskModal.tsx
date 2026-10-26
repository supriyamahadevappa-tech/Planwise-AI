import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Priority, Task } from '../types'
import './TaskModal.css'

type Props = {
  task?: Task
  onClose: () => void
  onSave: (task: Task) => void
}

type FormValues = { title: string; description: string; deadline: string; priority: Priority; estimatedMinutes: string }
type Errors = Partial<Record<keyof FormValues, string>>

const blankForm: FormValues = { title: '', description: '', deadline: '', priority: 'Medium', estimatedMinutes: '' }

export default function TaskModal({ task, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormValues>(task ? {
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    priority: task.priority,
    estimatedMinutes: String(task.estimatedMinutes),
  } : blankForm)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Errors = {}
    const minutes = Number(form.estimatedMinutes)
    if (!form.title.trim()) nextErrors.title = 'Add a title for your task.'
    if (!form.deadline || Number.isNaN(Date.parse(`${form.deadline}T00:00:00`))) nextErrors.deadline = 'Choose a valid deadline.'
    if (!['High', 'Medium', 'Low'].includes(form.priority)) nextErrors.priority = 'Choose a priority.'
    if (!Number.isFinite(minutes) || minutes <= 0) nextErrors.estimatedMinutes = 'Enter a duration greater than 0 minutes.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSave({
      id: task?.id ?? crypto.randomUUID(),
      title: form.title.trim(),
      description: form.description.trim(),
      deadline: form.deadline,
      priority: form.priority,
      estimatedMinutes: minutes,
      completed: task?.completed ?? false,
    })
  }

  const pastDeadline = form.deadline !== '' && form.deadline < new Date().toISOString().slice(0, 10)

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="task-modal__top">
          <div><p className="eyebrow">A little progress adds up</p><h2 id="task-modal-title">{task ? 'Edit your task' : 'Add a task'}</h2></div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={submit} noValidate>
          <label className="form-field">Task title <span className="required-mark">*</span>
            <input autoFocus value={form.title} onChange={event => update('title', event.target.value)} placeholder="e.g. Read biology chapter 4" aria-invalid={Boolean(errors.title)} />
            {errors.title && <small className="field-error">{errors.title}</small>}
          </label>
          <label className="form-field">Description <span className="optional-label">Optional</span>
            <textarea value={form.description} onChange={event => update('description', event.target.value)} placeholder="Add a few details to help you remember" rows={3} />
          </label>
          <div className="form-row">
            <label className="form-field">Deadline <span className="required-mark">*</span>
              <input type="date" value={form.deadline} onChange={event => update('deadline', event.target.value)} aria-invalid={Boolean(errors.deadline)} />
              {errors.deadline && <small className="field-error">{errors.deadline}</small>}
              {pastDeadline && <small className="field-warning">This date has already passed. You can still save it.</small>}
            </label>
            <label className="form-field">Priority <span className="required-mark">*</span>
              <select value={form.priority} onChange={event => update('priority', event.target.value as Priority)}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
              {errors.priority && <small className="field-error">{errors.priority}</small>}
            </label>
          </div>
          <label className="form-field">Estimated duration <span className="required-mark">*</span>
            <div className="input-with-suffix"><input type="number" min="1" step="1" value={form.estimatedMinutes} onChange={event => update('estimatedMinutes', event.target.value)} placeholder="45" aria-invalid={Boolean(errors.estimatedMinutes)} /><span>minutes</span></div>
            {errors.estimatedMinutes && <small className="field-error">{errors.estimatedMinutes}</small>}
          </label>
          <div className="task-modal__buttons">
            <button className="button button--quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit">{task ? 'Save changes' : 'Save task'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
