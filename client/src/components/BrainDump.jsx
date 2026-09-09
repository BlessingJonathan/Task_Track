import React, { useState } from 'react'
import { api } from '../api'

const TIME_PATTERNS = [
  { regex: /(\d+)\s*min(?:ute)?s?/i, unit: 'min' },
  { regex: /(\d+)\s*h(?:ou)?rs?/i, unit: 'hour' },
  { regex: /half\s*(?:an?\s*)?hour/i, unit: 'min', value: 30 },
  { regex: /quarter\s*(?:of\s*(?:an?\s*)?)?hour/i, unit: 'min', value: 15 },
  { regex: /(\d+)\s*days?/i, unit: 'day' },
  { regex: /(\d+)\s*weeks?/i, unit: 'week' },
]

const PRIORITY_KEYWORDS = {
  urgent: ['urgent', 'asap', 'critical', 'immediately', 'right now', 'emergency'],
  high: ['important', 'high priority', 'first', 'top', 'do first'],
  low: ['low priority', 'whenever', 'eventually', 'sometime', 'nice to have']
}

function parseBrainDump(text) {
  if (!text.trim()) return []

  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const tasks = []

  for (let line of lines) {
    line = line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
    if (!line) continue

    let timeEstimate = 0
    let priority = 'medium'
    let title = line

    for (const pattern of TIME_PATTERNS) {
      const match = line.match(pattern.regex)
      if (match) {
        const val = pattern.value || parseInt(match[1])
        if (pattern.unit === 'min') timeEstimate = val
        else if (pattern.unit === 'hour') timeEstimate = val * 60
        else if (pattern.unit === 'day') timeEstimate = val * 480
        else if (pattern.unit === 'week') timeEstimate = val * 2400
        title = title.replace(match[0], '').trim()
        break
      }
    }

    for (const [pri, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      for (const kw of keywords) {
        if (title.toLowerCase().includes(kw)) {
          priority = pri
          title = title.replace(new RegExp(kw, 'gi'), '').trim()
          break
        }
      }
    }

    title = title.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '')

    if (!title) continue

    if (title.length > 2 && title[0] === title[0].toUpperCase()) {
      title = title
    } else {
      title = title.charAt(0).toUpperCase() + title.slice(1)
    }

    tasks.push({
      title,
      time_estimate_min: timeEstimate,
      priority,
      description: ''
    })
  }

  return tasks
}

export default function BrainDump({ onClose, onCreated, showToast }) {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState([])
  const [creating, setCreating] = useState(false)
  const [goalTitle, setGoalTitle] = useState('')
  const [period, setPeriod] = useState('daily')

  const handleParse = () => {
    const tasks = parseBrainDump(input)
    if (tasks.length === 0) {
      showToast('Could not parse any tasks. Try listing them on separate lines.', 'error')
      return
    }
    setParsed(tasks)
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    if (parsed.length > 0) {
      setParsed([])
    }
  }

  const removeTask = (idx) => {
    setParsed(prev => prev.filter((_, i) => i !== idx))
  }

  const updateParsedTask = (idx, field, value) => {
    setParsed(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const handleCreate = async () => {
    if (parsed.length === 0) return
    setCreating(true)
    try {
      let goalId = null
      if (goalTitle.trim()) {
        const today = new Date().toISOString().split('T')[0]
        const goal = await api.createGoal({
          title: goalTitle.trim(),
          period,
          target_date: today
        })
        goalId = goal.id
      }
      await api.createBulkTasks(parsed, goalId)
      onCreated()
    } catch (e) {
      showToast('Failed to create tasks', 'error')
    }
    setCreating(false)
  }

  const totalEstimate = parsed.reduce((sum, t) => sum + (t.time_estimate_min || 0), 0)

  return (
    <>
      <div className="modal-header">
        <div>
          <h2>Brain Dump</h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Type what you need to do - one task per line. I will break it down.
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>What do you want to accomplish?</label>
          <textarea
            className="brain-dump-input"
            value={input}
            onChange={handleInputChange}
            placeholder={`Example:\n- Finish project report 30 min\n- urgent: Call the dentist\n- Read chapter 5 of design book 1 hour\n- Workout at the gym 45 min\n- Review pull requests high priority 20 min\n- Plan next week's tasks 15 min`}
          />
        </div>

        {parsed.length === 0 ? (
          <button className="btn btn-primary w-full" onClick={handleParse} style={{ justifyContent: 'center' }}>
            Parse Tasks
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Group under goal (optional)</label>
                <input
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  placeholder="e.g. Finish Q4 Report, Weekly Routine"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
                <label>Period</label>
                <select value={period} onChange={e => setPeriod(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className="parsed-tasks">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {parsed.length} task{parsed.length !== 1 ? 's' : ''} found
                </span>
                {totalEstimate > 0 && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
                    Total: {totalEstimate >= 60 ? `${Math.floor(totalEstimate / 60)}h ${totalEstimate % 60}m` : `${totalEstimate}m`}
                  </span>
                )}
              </div>

              {parsed.map((task, idx) => (
                <div key={idx} className="parsed-task-item">
                  <div className="task-num">{idx + 1}</div>
                  <div className="task-content">
                    <div className="task-name">{task.title}</div>
                    <div className="task-details">
                      <select
                        value={task.priority}
                        onChange={e => updateParsedTask(idx, 'priority', e.target.value)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-xs)', color: 'var(--text-muted)',
                          fontSize: '0.78rem', padding: '2px 8px', fontFamily: 'var(--font)',
                          outline: 'none', cursor: 'pointer'
                        }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <span>
                        <input
                          type="number"
                          value={task.time_estimate_min}
                          onChange={e => updateParsedTask(idx, 'time_estimate_min', parseInt(e.target.value) || 0)}
                          style={{
                            width: 50, background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-xs)', color: 'var(--text-muted)',
                            fontSize: '0.78rem', padding: '2px 6px', fontFamily: 'var(--font)',
                            outline: 'none', textAlign: 'center'
                          }}
                          min="0"
                        /> min
                      </span>
                    </div>
                  </div>
                  <button className="task-remove" onClick={() => removeTask(idx)}>×</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setParsed([]); setInput('') }} style={{ flex: 1, justifyContent: 'center' }}>
                Clear
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating || parsed.length === 0}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {creating ? 'Creating...' : `Create ${parsed.length} Task${parsed.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
