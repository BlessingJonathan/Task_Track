import React, { useState, useEffect } from 'react'
import { api } from '../api'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#64748b', '#14b8a6']

export default function Categories({ refreshKey, showToast }) {
  const [categories, setCategories] = useState([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])

  const load = () => api.getCategories().then(setCategories).catch(() => {})
  useEffect(() => { load() }, [refreshKey])

  const add = async () => {
    if (!newName.trim()) return
    try {
      await api.createCategory({ name: newName.trim(), color: newColor })
      setNewName('')
      setNewColor(COLORS[0])
      load()
      showToast('Category created', 'success')
    } catch (e) {
      showToast('Category already exists', 'error')
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this category? Tasks will become uncategorized.')) return
    await api.deleteCategory(id)
    load()
    showToast('Category deleted', 'info')
  }

  return (
    <div>
      <div className="section-header">
        <h2>Categories</h2>
      </div>

      <div className="card mb-2">
        <div className="card-header">
          <h3>Add Category</h3>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Category name"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Color</label>
            <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
              {COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    cursor: 'pointer', border: newColor === c ? '3px solid #fff' : '3px solid transparent',
                    transition: 'var(--transition)'
                  }}
                />
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
      </div>

      <div className="grid grid-3">
        {categories.map(cat => (
          <div key={cat.id} className="card" style={{ borderLeft: `4px solid ${cat.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{cat.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color }} />
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                    Created {new Date(cat.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button className="btn btn-xs btn-ghost" onClick={() => remove(cat.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏷️</div>
          <h3>No categories yet</h3>
          <p>Create categories to organize your tasks</p>
        </div>
      )}
    </div>
  )
}
