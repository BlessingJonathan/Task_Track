import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function Reports({ refreshKey }) {
  const [summary, setSummary] = useState(null)
  const [days, setDays] = useState(7)

  useEffect(() => {
    api.getReportSummary(days).then(setSummary).catch(() => {})
  }, [days, refreshKey])

  if (!summary) return <div className="empty"><p>Loading reports...</p></div>

  const maxCategory = Math.max(...summary.by_category.map(c => c.count), 1)
  const maxPriority = Math.max(...summary.by_priority.map(p => p.count), 1)

  const priorityColors = { urgent: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--text-muted)' }
  const statusColors = { pending: 'var(--yellow)', in_progress: 'var(--accent)', completed: 'var(--green)', cancelled: 'var(--red)', on_hold: 'var(--text-muted)' }

  return (
    <div>
      <div className="section-header">
        <h2>Reports</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>Last</span>
          <select
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
            style={{
              padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)', color: 'var(--text-primary)', fontFamily: 'var(--font)',
              fontSize: '0.88rem', outline: 'none'
            }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-4 mb-2">
        <div className="stat-card blue">
          <div className="stat-value">{summary.total_tasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{summary.completed_recently}</div>
          <div className="stat-label">Completed ({days}d)</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-value">{Math.round(summary.total_time_estimated / 60 * 10) / 10}h</div>
          <div className="stat-label">Time Estimated</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">{Math.round(summary.total_time_spent / 60 * 10) / 10}h</div>
          <div className="stat-label">Time Spent</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3>By Category</h3>
          </div>
          {summary.by_category.filter(c => c.count > 0).map(c => (
            <div key={c.name} className="chart-row">
              <div className="chart-label">{c.name}</div>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${(c.count / maxCategory) * 100}%`, background: c.color || 'var(--accent)' }}>
                  {c.count}
                </div>
              </div>
            </div>
          ))}
          {summary.by_category.filter(c => c.count > 0).length === 0 && (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>No tasks in any category</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>By Priority</h3>
          </div>
          {summary.by_priority.map(p => (
            <div key={p.priority} className="chart-row">
              <div className="chart-label" style={{ textTransform: 'capitalize' }}>{p.priority}</div>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${(p.count / maxPriority) * 100}%`, background: priorityColors[p.priority] || 'var(--accent)' }}>
                  {p.count}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>By Status</h3>
          </div>
          {summary.by_status.map(s => (
            <div key={s.status} className="chart-row">
              <div className="chart-label" style={{ textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</div>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${(s.count / Math.max(summary.total_tasks, 1)) * 100}%`, background: statusColors[s.status] || 'var(--accent)' }}>
                  {s.count}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Daily Completion</h3>
          </div>
          {summary.daily_completed.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>No completions in this period</p>
          ) : (
            summary.daily_completed.map(d => (
              <div key={d.day} className="chart-row">
                <div className="chart-label">{new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div className="chart-track">
                  <div className="chart-fill" style={{ width: `${(d.count / Math.max(...summary.daily_completed.map(x => x.count), 1)) * 100}%`, background: 'var(--green)' }}>
                    {d.count}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card mt-2">
        <div className="card-header">
          <h3>⏱ Time Efficiency</h3>
        </div>
        <div className="grid grid-3" style={{ gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.total_time_estimated > 0 ? (summary.total_time_spent <= summary.total_time_estimated ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>
              {summary.total_time_estimated > 0 ? Math.round((summary.total_time_spent / summary.total_time_estimated) * 100) : 0}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Time Used vs Estimated</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {summary.total_tasks > 0 ? Math.round((summary.completed_recently / Math.max(summary.total_tasks, 1)) * 100) : 0}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Completion Rate</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.overdue > 0 ? 'var(--red)' : 'var(--green)' }}>
              {summary.overdue}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Overdue Tasks</div>
          </div>
        </div>
      </div>
    </div>
  )
}
