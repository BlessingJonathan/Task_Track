import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function Dashboard({ refreshKey, onTaskClick, showToast }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getDashboard().then(setData).catch(() => showToast('Failed to load dashboard', 'error'))
  }, [refreshKey])

  if (!data) return <div className="empty"><div className="empty-icon">⏳</div><p>Loading...</p></div>

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              if (Notification && Notification.permission !== 'granted') {
                Notification.requestPermission().then(p => {
                  showToast(p === 'granted' ? 'Notifications enabled! Reminders will pop up like Google Calendar.' : 'Notifications blocked', p === 'granted' ? 'success' : 'error')
                })
              } else {
                showToast('Notifications are already enabled', 'success')
              }
            }}
          >
            🔔 <span>Enable Notifications</span>
          </button>
        </div>
      </div>

      <div className="grid grid-4 mb-2">
        <div className="stat-card blue">
          <div className="stat-value">{data.stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">{data.stats.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{data.stats.completed_today}</div>
          <div className="stat-label">Done Today</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-value">{data.stats.total_time_today}m</div>
          <div className="stat-label">Time Tracked</div>
        </div>
      </div>

      {data.overdue.length > 0 && (
        <div className="card mb-2" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div className="card-header">
            <h3 style={{ color: 'var(--red)' }}>Overdue ({data.overdue.length})</h3>
          </div>
          {data.overdue.map(t => (
            <div key={t.id} className="task-item" onClick={() => onTaskClick(t.id)}>
              <div className="task-info">
                <div className="title">{t.title}</div>
                <div className="meta">
                  <span className="priority-urgent">Overdue</span>
                  <span>Due {new Date(t.deadline).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.active_goals?.length > 0 && (
        <div className="grid grid-3 mb-2">
          {data.active_goals.map(g => {
            const pct = g.tasks_total > 0 ? Math.round((g.tasks_done / g.tasks_total) * 100) : 0
            return (
              <div key={g.id} className="goal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{g.title}</h3>
                  <span className="badge badge-in_progress">{g.period}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {g.tasks_done}/{g.tasks_total} tasks done
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${pct === 100 ? 'complete' : ''}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Today's Tasks</h3>
          </div>
          {data.today_tasks.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>No pending tasks. Great job! Try a Brain Dump to plan your day.</p>
          ) : (
            data.today_tasks.map(t => (
              <div key={t.id} className="task-item" onClick={() => onTaskClick(t.id)}>
                <div className="task-info">
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    {t.category_name && (
                      <span><span className="category-dot" style={{ background: t.category_color }} /> {t.category_name}</span>
                    )}
                    <span className={`priority-${t.priority}`}>{t.priority}</span>
                    {t.time_estimate_min > 0 && <span>⏱ {t.time_estimate_min}m est.</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Upcoming Reminders</h3>
          </div>
          {data.upcoming_reminders.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>No upcoming reminders</p>
          ) : (
            data.upcoming_reminders.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{r.task_title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  🔔 {new Date(r.remind_at).toLocaleString()}
                  {r.message && ` — ${r.message}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}