import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'

export default function TaskDetail({ taskId, onClose, onUpdated, showToast }) {
  const [task, setTask] = useState(null)
  const [tab, setTab] = useState('subtasks')
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderMsg, setReminderMsg] = useState('')
  const [resource, setResource] = useState({ title: '', url: '', type: 'link', notes: '' })
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [activeTimer, setActiveTimer] = useState(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const tickRef = useRef(null)

  const load = useCallback(() => {
    api.getTask(taskId).then(t => {
      setTask(t)
      setActiveTimer(t.active_timer || null)
      setEditData({
        title: t.title, description: t.description || '',
        category_id: t.category_id || '', priority: t.priority,
        time_estimate_min: t.time_estimate_min || 0,
        deadline: t.deadline ? t.deadline.split('T')[0] : '',
        status: t.status
      })
    }).catch(() => {})
  }, [taskId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (activeTimer && activeTimer.start_time) {
      const start = new Date(activeTimer.start_time + 'Z').getTime()
      const compute = () => {
        const diff = Math.floor((Date.now() - start) / 1000)
        setElapsedSec(Math.max(diff, 0))
      }
      compute()
      tickRef.current = setInterval(compute, 1000)
      return () => {
        if (tickRef.current) clearInterval(tickRef.current)
      }
    } else {
      setElapsedSec(0)
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [activeTimer, activeTimer?.start_time])

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current)
  }, [])

  if (!task) return <div className="modal-body"><p>Loading...</p></div>

  const formatElapsed = (sec) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const updateField = async (field, value) => {
    await api.updateTask(taskId, { [field]: value })
    load()
    onUpdated()
  }

  const saveEdits = async () => {
    const data = { ...editData }
    data.category_id = data.category_id || null
    data.time_estimate_min = parseInt(data.time_estimate_min) || 0
    data.deadline = data.deadline || null
    await api.updateTask(taskId, data)
    setEditMode(false)
    load()
    onUpdated()
    showToast('Task updated', 'success')
  }

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    await api.createSubtask(taskId, { title: newSubtask.trim() })
    setNewSubtask('')
    load()
    onUpdated()
  }

  const toggleSubtask = async (st) => {
    await api.updateSubtask(st.id, { completed: !st.completed })
    load()
    onUpdated()
  }

  const deleteSubtask = async (id) => {
    await api.deleteSubtask(id)
    load()
    onUpdated()
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    await api.createComment(taskId, { content: newComment.trim() })
    setNewComment('')
    load()
  }

  const addReminder = async () => {
    if (!reminderDate) return
    await api.createReminder(taskId, { remind_at: reminderDate, message: reminderMsg })
    setReminderDate('')
    setReminderMsg('')
    load()
    showToast('Reminder set. Browser notification will pop when it fires.', 'success')
  }

  const addResource = async () => {
    if (!resource.title.trim()) return
    await api.createResource(taskId, resource)
    setResource({ title: '', url: '', type: 'link', notes: '' })
    load()
    showToast('Resource added', 'success')
  }

  const startTimer = async () => {
    try {
      const res = await api.startTime(taskId)
      setActiveTimer({ id: res.log_id, start_time: res.start_time || new Date().toISOString() })
      showToast(res.already_running ? 'Timer already running' : 'Timer started', 'info')
      load()
      onUpdated()
    } catch (e) {
      showToast('Failed to start timer', 'error')
    }
  }

  const stopTimer = async () => {
    if (!activeTimer) return
    try {
      await api.stopTime(activeTimer.id)
      setActiveTimer(null)
      setElapsedSec(0)
      showToast('Timer stopped', 'success')
      load()
      onUpdated()
    } catch (e) {
      showToast('Failed to stop timer', 'error')
    }
  }

  const deleteTask = async () => {
    if (!confirm('Delete this task and all subtasks?')) return
    await api.deleteTask(taskId)
    showToast('Task deleted', 'info')
    onClose()
    onUpdated()
  }

  const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0
  const subtasksTotal = task.subtasks?.length || 0
  const subtaskPct = subtasksTotal ? Math.round((subtasksDone / subtasksTotal) * 100) : 0

  return (
    <>
      <div className="modal-header">
        <div style={{ flex: 1 }}>
          {editMode ? (
            <input
              value={editData.title}
              onChange={e => setEditData(d => ({ ...d, title: e.target.value }))}
              style={{
                background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)', color: 'var(--text-primary)',
                padding: '8px 14px', fontSize: '1.1rem', fontWeight: 700,
                width: '100%', fontFamily: 'var(--font)', outline: 'none'
              }}
            />
          ) : (
            <h2>{task.title}</h2>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
            <span className={`priority-${task.priority}`}>{task.priority}</span>
            {task.category_name && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span className="category-dot" style={{ background: task.category_color }} />
                {task.category_name}
              </span>
            )}
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>

      <div className="modal-body">
        {editMode ? (
          <div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={editData.description} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select value={editData.priority} onChange={e => setEditData(d => ({ ...d, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Time Estimate (min)</label>
                <input type="number" value={editData.time_estimate_min} onChange={e => setEditData(d => ({ ...d, time_estimate_min: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Deadline</label>
                <input type="date" value={editData.deadline} onChange={e => setEditData(d => ({ ...d, deadline: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdits}>Save Changes</button>
            </div>
          </div>
        ) : (
          <>
            {task.description && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{task.description}</p>
              </div>
            )}

            {activeTimer && (
              <div className="timer-display">
                <span className="timer-dot" />
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Timer Running
                  </div>
                  <div className="timer-time">{formatElapsed(elapsedSec)}</div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={stopTimer} style={{ marginLeft: 'auto' }}>
                  ■ Stop Timer
                </button>
              </div>
            )}

            <div className="grid grid-3 mb-2" style={{ gap: 12 }}>
              <div style={{ padding: '14px 18px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Estimate</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>
                  {task.time_estimate_min >= 60 ? `${Math.floor(task.time_estimate_min / 60)}h ${task.time_estimate_min % 60}m` : `${task.time_estimate_min || 0} min`}
                </div>
              </div>
              <div style={{ padding: '14px 18px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Spent</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4, color: 'var(--green)' }}>
                  {task.time_spent_min >= 60 ? `${Math.floor(task.time_spent_min / 60)}h ${task.time_spent_min % 60}m` : `${task.time_spent_min || 0} min`}
                </div>
              </div>
              <div style={{ padding: '14px 18px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>
                  {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None'}
                </div>
              </div>
            </div>

            {subtasksTotal > 0 && (
              <div className="mb-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  <span>Subtasks</span><span>{subtasksDone}/{subtasksTotal} ({subtaskPct}%)</span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${subtaskPct === 100 ? 'complete' : ''}`} style={{ width: `${subtaskPct}%` }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {task.status !== 'completed' && task.status !== 'in_progress' && (
                <button className="btn btn-sm btn-primary" onClick={() => { updateField('status', 'in_progress'); showToast('Started!', 'info') }}>▶ Start</button>
              )}
              {task.status !== 'completed' && (
                <button className="btn btn-sm btn-success" onClick={() => { updateField('status', 'completed'); showToast('Completed!', 'success') }}>✓ Complete</button>
              )}
              {!activeTimer ? (
                <button className="btn btn-sm btn-secondary" onClick={startTimer}>⏱ Start Timer</button>
              ) : (
                <button className="btn btn-sm btn-danger" onClick={stopTimer}>■ Stop Timer</button>
              )}
              <button className="btn btn-sm btn-secondary" onClick={() => setEditMode(true)}>✏️ Edit</button>
              <button className="btn btn-sm btn-danger" onClick={deleteTask}>🗑</button>
            </div>
          </>
        )}

        <div className="tabs">
          {[
            { id: 'subtasks', label: `Subtasks (${subtasksTotal})` },
            { id: 'comments', label: `Comments (${task.comments?.length || 0})` },
            { id: 'resources', label: `Resources (${task.resources?.length || 0})` },
            { id: 'reminders', label: `Reminders (${task.reminders?.length || 0})` },
            { id: 'time', label: 'Time Log' },
          ].map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'subtasks' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                placeholder="Add a subtask..."
                style={{
                  flex: 1, padding: '10px 16px', background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font)', outline: 'none'
                }}
              />
              <button className="btn btn-sm btn-primary" onClick={addSubtask}>Add</button>
            </div>
            {task.subtasks?.length === 0 && <p className="text-muted" style={{ fontSize: '0.88rem' }}>No subtasks yet</p>}
            {task.subtasks?.map(st => (
              <div key={st.id} className={`subtask-item ${st.completed ? 'done' : ''}`}>
                <div
                  className={`subtask-check ${st.completed ? 'checked' : ''}`}
                  onClick={() => toggleSubtask(st)}
                >{st.completed ? '✓' : ''}</div>
                <span className="subtask-title" style={{ flex: 1, fontSize: '0.9rem' }}>{st.title}</span>
                <button className="btn btn-xs btn-ghost" onClick={() => deleteSubtask(st.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'comments' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()}
                placeholder="Add a comment..."
                style={{
                  flex: 1, padding: '10px 16px', background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font)', outline: 'none'
                }}
              />
              <button className="btn btn-sm btn-primary" onClick={addComment}>Post</button>
            </div>
            {task.comments?.length === 0 && <p className="text-muted" style={{ fontSize: '0.88rem' }}>No comments yet</p>}
            {task.comments?.map(c => (
              <div key={c.id} className="comment">
                <div className="comment-time">{new Date(c.created_at).toLocaleString()}</div>
                <div className="comment-text">{c.content}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'resources' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Title</label>
                  <input value={resource.title} onChange={e => setResource(r => ({ ...r, title: e.target.value }))} placeholder="Resource name" />
                </div>
                <div className="form-group" style={{ maxWidth: 130 }}>
                  <label>Type</label>
                  <select value={resource.type} onChange={e => setResource(r => ({ ...r, type: e.target.value }))}>
                    <option value="link">Link</option>
                    <option value="video">Video</option>
                    <option value="book">Book</option>
                    <option value="article">Article</option>
                    <option value="file">File</option>
                    <option value="note">Note</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>URL</label>
                <input value={resource.url} onChange={e => setResource(r => ({ ...r, url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input value={resource.notes} onChange={e => setResource(r => ({ ...r, notes: e.target.value }))} placeholder="Additional notes" />
              </div>
              <button className="btn btn-sm btn-primary" onClick={addResource}>Add Resource</button>
            </div>
            {task.resources?.length === 0 && <p className="text-muted" style={{ fontSize: '0.88rem' }}>No resources yet</p>}
            {task.resources?.map(r => (
              <div key={r.id} className="resource-item">
                <span className="resource-icon">
                  {r.type === 'link' ? '🔗' : r.type === 'video' ? '🎥' : r.type === 'book' ? '📖' : r.type === 'article' ? '📰' : r.type === 'file' ? '📁' : '📝'}
                </span>
                <div style={{ flex: 1 }}>
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> : <span style={{ fontSize: '0.9rem' }}>{r.title}</span>}
                  {r.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.notes}</div>}
                </div>
                <button className="btn btn-xs btn-ghost" onClick={() => api.deleteResource(r.id).then(load)}>×</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'reminders' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>When</label>
                <input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>Message</label>
                <input value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} placeholder="Optional message" />
              </div>
              <button className="btn btn-sm btn-primary" onClick={addReminder}>Set Reminder</button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
              Reminders pop up as browser notifications, like Google Calendar. Make sure notifications are allowed for this site.
            </p>
            {task.reminders?.length === 0 && <p className="text-muted" style={{ fontSize: '0.88rem' }}>No reminders set</p>}
            {task.reminders?.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{new Date(r.remind_at).toLocaleString()}</div>
                  {r.message && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.message}</div>}
                </div>
                <button className="btn btn-xs btn-ghost" onClick={() => api.deleteReminder(r.id).then(load)}>×</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'time' && (
          <div>
            {task.time_logs?.length === 0 && <p className="text-muted" style={{ fontSize: '0.88rem' }}>No time logs yet. Start the timer above.</p>}
            {task.time_logs?.map(log => {
              const isRunning = !log.end_time
              const logDuration = isRunning ? elapsedSec : Math.max(log.duration_min * 60, 0)
              return (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(log.start_time + 'Z').toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    {isRunning && <span className="timer-dot" style={{ width: 8, height: 8 }} />}
                    <span>{formatElapsed(logDuration)}</span>
                    {isRunning ? (
                      <button className="btn btn-xs btn-danger" onClick={stopTimer}>Stop</button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {new Date(log.end_time + 'Z').toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {task.children?.length > 0 && (
          <div className="mt-2">
            <hr className="divider" />
            <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Child Tasks</h4>
            {task.children.map(c => (
              <div key={c.id} style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: 'var(--radius-sm)', marginBottom: 8, fontSize: '0.9rem', border: '1px solid var(--border)' }}>
                <span className={`badge badge-${c.status}`} style={{ marginRight: 10 }}>{c.status}</span>
                {c.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}