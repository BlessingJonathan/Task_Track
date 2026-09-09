import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function Schedule({ refreshKey, onTaskClick, showToast }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [items, setItems] = useState([])
  const [generating, setGenerating] = useState(false)
  const [genSettings, setGenSettings] = useState({ start_hour: 8, end_hour: 17, break_duration_min: 15 })

  const load = () => api.getSchedule(date).then(setItems).catch(() => {})
  useEffect(() => { load() }, [date, refreshKey])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await api.generateSchedule({ date, ...genSettings })
      showToast(res.message, 'success')
      load()
    } catch (e) {
      showToast('Failed to generate schedule', 'error')
    }
    setGenerating(false)
  }

  const toggleComplete = async (item) => {
    await api.updateSchedule(item.id, { completed: !item.completed })
    load()
  }

  const deleteItem = async (id) => {
    await api.deleteSchedule(id)
    load()
  }

  const prevDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    setDate(d.toISOString().split('T')[0])
  }

  const nextDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    setDate(d.toISOString().split('T')[0])
  }

  const formatTime = (dt) => new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const totalEstimate = items.reduce((sum, i) => {
    if (!i.end_time || !i.start_time) return sum
    return sum + Math.round((new Date(i.end_time) - new Date(i.start_time)) / 60000)
  }, 0)

  return (
    <div>
      <div className="section-header">
        <h2>Schedule</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-sm btn-secondary" onClick={prevDay}>←</button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)', color: 'var(--text-primary)', fontFamily: 'var(--font)',
              fontSize: '0.88rem', outline: 'none'
            }}
          />
          <button className="btn btn-sm btn-secondary" onClick={nextDay}>→</button>
          <button className="btn btn-sm btn-primary" onClick={generate} disabled={generating}>
            {generating ? '⏳ Generating...' : '⚡ Auto-Generate'}
          </button>
        </div>
      </div>

      <div className="card mb-2">
        <div className="card-header">
          <h3>⚙️ Generation Settings</h3>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Hour</label>
            <select value={genSettings.start_hour} onChange={e => setGenSettings(s => ({ ...s, start_hour: parseInt(e.target.value) }))}>
              {Array.from({ length: 18 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>End Hour</label>
            <select value={genSettings.end_hour} onChange={e => setGenSettings(s => ({ ...s, end_hour: parseInt(e.target.value) }))}>
              {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Break (min)</label>
            <select value={genSettings.break_duration_min} onChange={e => setGenSettings(s => ({ ...s, break_duration_min: parseInt(e.target.value) }))}>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
            </select>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          Auto-generates a schedule from your pending tasks, prioritized by urgency and deadline. Total estimated time: {totalEstimate} min
        </p>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📅</div>
          <h3>No schedule for this day</h3>
          <p>Click "Auto-Generate" to create a schedule from your pending tasks</p>
        </div>
      ) : (
        <div>
          {items.map(item => (
            <div key={item.id} className={`schedule-block ${item.completed ? 'completed' : ''}`}>
              <div className="schedule-time">
                {formatTime(item.start_time)}<br />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {formatTime(item.end_time)}
                </span>
              </div>
              <div className="block-info">
                <h4 style={{ cursor: item.task_id ? 'pointer' : 'default' }} onClick={() => item.task_id && onTaskClick(item.task_id)}>
                  {item.title}
                </h4>
                {item.description && <p>{item.description}</p>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`btn btn-xs ${item.completed ? 'btn-secondary' : 'btn-success'}`}
                  onClick={() => toggleComplete(item)}
                >
                  {item.completed ? '↩' : '✓'}
                </button>
                <button className="btn btn-xs btn-ghost" onClick={() => deleteItem(item.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
