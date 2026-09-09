import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import TaskList from './components/TaskList'
import TaskDetail from './components/TaskDetail'
import Schedule from './components/Schedule'
import Reports from './components/Reports'
import Categories from './components/Categories'
import TaskForm from './components/TaskForm'
import KanbanBoard from './components/KanbanBoard'
import BrainDump from './components/BrainDump'

export default function App() {
  const [view, setView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [modal, setModal] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState([])
  const [stats, setStats] = useState(null)
  const [reminders, setReminders] = useState([])
  const sseRef = useRef(null)

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToast(prev => [...prev, { id, message, type }])
    setTimeout(() => setToast(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    api.getDashboard().then(d => {
      setStats(d.stats)
      setReminders(d.upcoming_reminders || [])
    }).catch(() => {})
  }, [refreshKey])

  useEffect(() => {
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    sseRef.current = api.connectSSE({
      reminder: (data) => {
        showToast(`${data.title}: ${data.message}`, 'info')
        if (Notification && Notification.permission === 'granted') {
          new Notification('TaskTracker Reminder', {
            body: `${data.title}: ${data.message}`,
            icon: '/favicon.ico',
            tag: `reminder-${data.id}`,
            requireInteraction: true
          })
        }
      }
    })

    return () => {
      if (sseRef.current) sseRef.current.close()
    }
  }, [showToast])

  const openTask = (id) => setModal({ type: 'taskDetail', taskId: id })
  const openNewTask = () => setModal({ type: 'newTask' })
  const openBrainDump = () => setModal({ type: 'brainDump' })
  const closeModal = () => setModal(null)

  const requestNotificationPermission = async () => {
    if (Notification && Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        showToast('Notifications enabled! You will receive reminders.', 'success')
      }
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        view={view}
        setView={v => { setView(v); setModal(null); }}
        open={sidebarOpen}
        stats={stats}
        onBrainDump={openBrainDump}
      />

      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="search">
            <input
              type="text"
              placeholder="Search tasks, goals, categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="actions">
            <button className="btn btn-secondary btn-sm" onClick={openBrainDump}>
              <span style={{ fontSize: '1.1rem' }}>🧠</span> <span>Brain Dump</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={openNewTask}>
              + <span>New Task</span>
            </button>
          </div>
        </header>

        <div className="content">
          {view === 'dashboard' && <Dashboard refreshKey={refreshKey} onTaskClick={openTask} showToast={showToast} />}
          {view === 'tasks' && <TaskList refreshKey={refreshKey} search={search} onTaskClick={openTask} showToast={showToast} />}
          {view === 'kanban' && <KanbanBoard refreshKey={refreshKey} onTaskClick={openTask} showToast={showToast} />}
          {view === 'schedule' && <Schedule refreshKey={refreshKey} onTaskClick={openTask} showToast={showToast} />}
          {view === 'reports' && <Reports refreshKey={refreshKey} />}
          {view === 'categories' && <Categories refreshKey={refreshKey} showToast={showToast} />}
        </div>
      </main>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {modal.type === 'newTask' && (
              <TaskForm
                onClose={closeModal}
                onSaved={() => { refresh(); closeModal(); showToast('Task created', 'success'); }}
              />
            )}
            {modal.type === 'taskDetail' && (
              <TaskDetail
                taskId={modal.taskId}
                onClose={closeModal}
                onUpdated={() => { refresh(); }}
                showToast={showToast}
              />
            )}
            {modal.type === 'brainDump' && (
              <BrainDump
                onClose={closeModal}
                onCreated={() => { refresh(); closeModal(); showToast('Tasks created from brain dump!', 'success'); }}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      )}

      <div className="toast-container">
        {toast.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  )
}
