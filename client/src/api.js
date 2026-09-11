const BASE = 'https://taskbutler.onrender.com/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getDashboard: () => request('/dashboard'),

  getCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: data }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  getTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  getKanbanTasks: () => request('/tasks/kanban'),
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  createBulkTasks: (tasks, goal_id) => request('/tasks/bulk', { method: 'POST', body: { tasks, goal_id } }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  createSubtask: (taskId, data) => request(`/tasks/${taskId}/subtasks`, { method: 'POST', body: data }),
  updateSubtask: (id, data) => request(`/subtasks/${id}`, { method: 'PUT', body: data }),
  deleteSubtask: (id) => request(`/subtasks/${id}`, { method: 'DELETE' }),

  getComments: (taskId) => request(`/tasks/${taskId}/comments`),
  createComment: (taskId, data) => request(`/tasks/${taskId}/comments`, { method: 'POST', body: data }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),

  getReminders: (upcoming = true) => request(`/reminders?upcoming=${upcoming}`),
  createReminder: (taskId, data) => request(`/tasks/${taskId}/reminders`, { method: 'POST', body: data }),
  deleteReminder: (id) => request(`/reminders/${id}`, { method: 'DELETE' }),

  createResource: (taskId, data) => request(`/tasks/${taskId}/resources`, { method: 'POST', body: data }),
  deleteResource: (id) => request(`/resources/${id}`, { method: 'DELETE' }),

  getActiveTimer: (taskId) => request(`/tasks/${taskId}/time/active`),
  startTime: (taskId) => request(`/tasks/${taskId}/time/start`, { method: 'POST' }),
  stopTime: (logId) => request(`/time-logs/${logId}/stop`, { method: 'POST' }),

  getSchedule: (date) => request(`/schedule?date=${date}`),
  createSchedule: (data) => request('/schedule', { method: 'POST', body: data }),
  updateSchedule: (id, data) => request(`/schedule/${id}`, { method: 'PUT', body: data }),
  deleteSchedule: (id) => request(`/schedule/${id}`, { method: 'DELETE' }),
  generateSchedule: (data) => request('/schedule/generate', { method: 'POST', body: data }),

  getGoals: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/goals${qs ? `?${qs}` : ''}`);
  },
  createGoal: (data) => request('/goals', { method: 'POST', body: data }),
  updateGoal: (id, data) => request(`/goals/${id}`, { method: 'PUT', body: data }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),

  getReportSummary: (days = 7) => request(`/reports/summary?days=${days}`),
  getReportTasks: () => request('/reports/tasks'),

  connectSSE: (handlers) => {
    const es = new EventSource(`${BASE}/events`);
    es.addEventListener('connected', () => {});
    if (handlers.reminder) es.addEventListener('reminder', (e) => handlers.reminder(JSON.parse(e.data)));
    if (handlers.timer) es.addEventListener('timer', (e) => handlers.timer(JSON.parse(e.data)));
    es.onerror = () => {};
    return es;
  }
};
