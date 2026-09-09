import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

const COLUMNS = [
  { id: 'pending', label: 'To Do', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #F97316)' },
  { id: 'in_progress', label: 'In Progress', color: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #A855F7)' },
  { id: 'completed', label: 'Done', color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #06B6D4)' },
]

export default function KanbanBoard({ refreshKey, onTaskClick, showToast }) {
  const [tasks, setTasks] = useState([])
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [timers, setTimers] = useState({})
  const timerRefs = useRef({})

  const load = useCallback(() => {
    api.getKanbanTasks().then(data => {
      setTasks(data)
      const activeTimers = {}
      data.forEach(t => {
        if (t.active_timer) {
          activeTimers[t.id] = t.active_timer
        }
      })
      setTimers(activeTimers)
    }).catch(() => {})
  }, [refreshKey])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Object.keys(timerRefs.current).forEach(id => clearInterval(timerRefs.current[id])
    )
    Object.keys(timers).forEach(id => {
      const log = timers[id]
      if (log && log.start_time) {
        timerRefs.current[id] = setInterval(() => {
          setTimers(prev => ({ ...prev }))
        }, 1000)
      }
    })
    return () => {
      Object.keys(timerRefs.current).forEach(id => clearInterval(timerRefs.current[id]))
    }
  }, [Object.keys(timers).length])

  const getElapsed = (startTime) => {
    if (!startTime) return '0:00'
    const diff = Math.floor((Date.now() - new Date(startTime + 'Z').getTime()) / 1000)
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
    e.target.classList.add('dragging')
  }

  const handleDragEnd = (e) => {
    setDraggedTask(null)
    setDragOverCol(null)
    e.target.classList.remove('dragging')
  }

  const handleDragOver = (e, colId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    if (!draggedTask || draggedTask.status === targetStatus) return
    await api.updateTask(draggedTask.id, { status: targetStatus })
    showToast(`Task moved to ${targetStatus.replace('_', ' ')}`, 'success')
    load()
  }

  const toggleTimer = async (e, task) => {
    e.stopPropagation()
    if (timers[task.id]) {
      await api.stopTime(timers[task.id].id)
      showToast('Timer stopped', 'info')
    } else {
      await api.startTime(task.id)
      showToast('Timer started', 'info')
    }
    load()
  }

  return (
    <div>
      <div className="section-header">
        <h2>Board</h2>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          {tasks.length} tasks across {COLUMNS.length} columns
        </span>
      </div>

      <div className="kanban-board">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header" style={{ borderBottomColor: `${col.color}33` }}>
                <h3>
                  <span style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: col.gradient
                  }} />
                  {col.label}
                </h3>
                <span className="count">{colTasks.length}</span>
              </div>
              <div
                className={`kanban-column-body ${dragOverCol === col.id ? 'drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    className="kanban-card"
                    draggable
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task.id)}
                  >
                    <div className="card-title">{task.title}</div>
                    <div className="card-meta">
                      {task.category_name && (
                        <span className="badge" style={{
                          background: `${task.category_color}22`,
                          color: task.category_color,
                          border: `1px solid ${task.category_color}33`
                        }}>
                          {task.category_name}
                        </span>
                      )}
                      <span className={`badge badge-${task.priority === 'urgent' ? 'cancelled' : task.priority === 'high' ? 'in_progress' : 'pending'}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="card-footer">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {task.subtasks_total > 0 && (
                          <span>{task.subtasks_done}/{task.subtasks_total} subtasks</span>
                        )}
                        {task.time_estimate_min > 0 && (
                          <span>{task.time_estimate_min}m est.</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {timers[task.id] && (
                          <span className="timer-badge">
                            <span className="timer-dot" style={{ width: 6, height: 6, background: '#EF4444', borderRadius: '50%', animation: 'blink 1s ease-in-out infinite' }} />
                            {getElapsed(timers[task.id].start_time)}
                          </span>
                        )}
                        <button
                          className={`btn btn-xs ${timers[task.id] ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={e => toggleTimer(e, task)}
                          title={timers[task.id] ? 'Stop timer' : 'Start timer'}
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          {timers[task.id] ? '⏹' : '▶'}
                        </button>
                      </div>
                    </div>
                    {task.subtasks_total > 0 && (
                      <div className="progress-bar" style={{ marginTop: 10 }}>
                        <div
                          className={`progress-fill ${task.subtasks_done === task.subtasks_total ? 'complete' : ''}`}
                          style={{ width: `${(task.subtasks_done / task.subtasks_total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div style={{
                    padding: 40,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
