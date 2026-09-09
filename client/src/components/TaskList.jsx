import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

export default function TaskList({ refreshKey, search, onTaskClick, showToast }) {
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ status: '', category_id: '', priority: '' })
  const [runningTimers, setRunningTimers] = useState({})
  const [now, setNow] = useState(Date.now())

  const load = useCallback(() => {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.category_id) params.category_id = filters.category_id
    if (filters.priority) params.priority = filters.priority
    if (search) params.search = search
    params.sort = 'updated_at'
    params.order = 'desc'
    api.getTasks(params).then(setTasks).catch(() => {})
  }, [filters, search, refreshKey])

  useEffect(() => { api.getCategories().then(setCategories).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  const loadTimers = useCallback(() => {
    api.getTasks({ status: 'in_progress' }).then(inProgress => {
      const active = {}
      inProgress.forEach(t => {
        if (t.active_timer) active[t.id] = t.active_timer
      })
      setRunningTimers(active)
    }).catch(() => {})
  }, [refreshKey])

  useEffect(() => {
    loadTimers()
  }, [loadTimers])

  const timerCount = Object.keys(runningTimers).length

  useEffect(() => {
    if (timerCount > 0) {
      const iv = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(iv)
    }
  }, [timerCount])

  const getElapsed = (startTime) => {
    const start = new Date(startTime + 'Z').getTime()
    const diff = Math.max(Math.floor((Date.now() - start) / 1000), 0)
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const toggleComplete = async (e, task) => {
    e.stopPropagation()
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    await api.updateTask(task.id, { status: newStatus })
    load()
    showToast(newStatus === 'completed' ? 'Task completed!' : 'Task reopened', 'success')
  }

  const quickStatusChange = async (e, task, status) => {
    e.stopPropagation()
    await api.updateTask(task.id, { status })
    load()
    loadTimers()
  }

  const toggleTimer = async (e, task) => {
    e.stopPropagation()
    if (runningTimers[task.id]) {
      await api.stopTime(runningTimers[task.id].id)
      showToast('Timer stopped', 'info')
    } else {
      await api.startTime(task.id)
      showToast('Timer started', 'info')
    }
    load()
    loadTimers()
  }

  const deleteTask = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this task?')) return
    await api.deleteTask(id)
    load()
    showToast('Task deleted', 'info')
  }

  const priorityLabel = (p) => p.charAt(0).toUpperCase() + p.slice(1)

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Tasks</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>{tasks.length} tasks</div>
        </div>
      </div>

      <div className="filter-bar">
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📝</div>
          <h3>No tasks found</h3>
          <p>Create a new task to get started, or use Brain Dump to plan your day in seconds</p>
        </div>
      ) : (
        tasks.map(task => (
          <div
            key={task.id}
            className={`task-item ${task.status === 'completed' ? 'completed' : ''} ${runningTimers[task.id] ? 'timer-running' : ''}`}
            onClick={() => onTaskClick(task.id)}
          >
            <div
              className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
              onClick={e => toggleComplete(e, task)}
            >
              {task.status === 'completed' ? '✓' : ''}
            </div>

            <div className="task-info">
              <div className="title">
                {task.title}
                <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
              </div>
              <div className="meta">
                {task.category_name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="category-dot" style={{ background: task.category_color }} />
                    {task.category_name}
                  </span>
                )}
                <span className={`priority-${task.priority}`}>{priorityLabel(task.priority)}</span>
                {task.time_estimate_min > 0 && <span>⏱ {task.time_estimate_min}m est.</span>}
                {task.time_spent_min > 0 && <span>✓ {task.time_spent_min}m spent</span>}
                {task.subtasks_total > 0 && (
                  <span>📋 {task.subtasks_done}/{task.subtasks_total}</span>
                )}
                {task.deadline && (
                  <span style={{ color: new Date(task.deadline) < new Date() ? 'var(--red)' : undefined }}>
                    📅 {new Date(task.deadline).toLocaleDateString()}
                  </span>
                )}
                {runningTimers[task.id] && (
                  <span className="mini-timer">● {getElapsed(runningTimers[task.id].start_time)}</span>
                )}
              </div>
              {task.subtasks_total > 0 && (
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${task.subtasks_done === task.subtasks_total ? 'complete' : ''}`}
                    style={{ width: `${(task.subtasks_done / task.subtasks_total) * 100}%` }}
                  />
                </div>
              )}
            </div>

            <div className="task-actions">
              {task.status !== 'in_progress' && task.status !== 'completed' && (
                <button className="btn btn-xs btn-ghost" onClick={e => quickStatusChange(e, task, 'in_progress')} title="Start">▶</button>
              )}
              <button
                className={`btn btn-xs ${runningTimers[task.id] ? 'btn-danger' : 'btn-ghost'}`}
                onClick={e => toggleTimer(e, task)}
                title={runningTimers[task.id] ? 'Stop timer' : 'Start timer'}
              >
                {runningTimers[task.id] ? '⏹' : '⏱'}
              </button>
              <button className="btn btn-xs btn-danger" onClick={e => deleteTask(e, task.id)} title="Delete">🗑</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}