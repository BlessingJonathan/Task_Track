import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function TaskForm({ onClose, onSaved, parentId = null }) {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    title: '', description: '', category_id: '', priority: 'medium',
    time_estimate_min: '', deadline: '', tags: []
  })

  useEffect(() => { api.getCategories().then(setCategories).catch(() => {}) }, [])

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const save = async () => {
    if (!form.title.trim()) return
    const data = {
      ...form,
      category_id: form.category_id || null,
      time_estimate_min: parseInt(form.time_estimate_min) || 0,
      deadline: form.deadline || null,
      parent_task_id: parentId
    }
    await api.createTask(data)
    onSaved()
  }

  const addSubtask = (title) => {
    if (title.trim()) {
      setForm(f => ({ ...f, title: f.title + (f.title ? '\n' : '') + '- ' + title }))
    }
  }

  return (
    <>
      <div className="modal-header">
        <h2>{parentId ? 'Add Subtask' : 'New Task'}</h2>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>Title *</label>
          <input
            autoFocus
            value={form.title}
            onChange={e => update('title', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && save()}
            placeholder="What needs to be done?"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="Add details, notes, links to resources..."
            rows={4}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Category</label>
            <select value={form.category_id} onChange={e => update('category_id', e.target.value)}>
              <option value="">None</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select value={form.priority} onChange={e => update('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Time Estimate (minutes)</label>
            <input
              type="number"
              value={form.time_estimate_min}
              onChange={e => update('time_estimate_min', e.target.value)}
              placeholder="e.g. 30"
              min="0"
            />
          </div>
          <div className="form-group">
            <label>Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => update('deadline', e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Create Task</button>
      </div>
    </>
  )
}
