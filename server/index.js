const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, queryAll, queryOne, runInsert, runExec, save } = require('./database');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let dbReady = false;
const sseClients = [];

function broadcast(event, data) {
  for (const res of sseClients) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

async function start() {
  await initDatabase();
  dbReady = true;
  console.log('Database ready');

  // ─── SSE ENDPOINT ────────────────────────────────────────
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.push(res);
    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // ─── CATEGORIES ───────────────────────────────────────
  app.get('/api/categories', (req, res) => {
    res.json(queryAll('SELECT * FROM categories ORDER BY name'));
  });

  app.post('/api/categories', (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    try {
      const id = runInsert('INSERT INTO categories (name, color) VALUES (?, ?)', [name, color || '#6366f1']);
      res.json({ id, name, color: color || '#6366f1' });
    } catch (e) {
      res.status(400).json({ error: 'Category already exists' });
    }
  });

app.delete('/api/categories/:id', (req, res) => {
    runExec('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── TASKS ────────────────────────────────────────────
  app.get('/api/tasks', (req, res) => {
    const { status, category_id, priority, parent_task_id, search, sort, order } = req.query;
    let sql = 'SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE 1=1';
    const p = [];
    if (status) { sql += ' AND t.status = ?'; p.push(status); }
    if (category_id) { sql += ' AND t.category_id = ?'; p.push(category_id); }
    if (priority) { sql += ' AND t.priority = ?'; p.push(priority); }
    if (parent_task_id === 'null') sql += ' AND t.parent_task_id IS NULL';
    else if (parent_task_id) { sql += ' AND t.parent_task_id = ?'; p.push(parent_task_id); }
    if (search) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    const validSort = ['created_at','updated_at','deadline','priority','time_estimate_min','status','title'];
    const col = validSort.includes(sort) ? sort : 'created_at';
    sql += ` ORDER BY t.${col} ${order === 'asc' ? 'ASC' : 'DESC'}`;
    const tasks = queryAll(sql, p);
    for (const t of tasks) {
      const s = queryOne('SELECT COUNT(*) as total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as done FROM subtasks WHERE task_id = ?', [t.id]);
      t.subtasks_total = s.total || 0;
      t.subtasks_done = s.done || 0;
    }
    res.json(tasks);
  });

  app.get('/api/tasks/kanban', (req, res) => {
    const tasks = queryAll(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.status NOT IN ('cancelled')
      ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.updated_at DESC
    `);
    for (const t of tasks) {
      const s = queryOne('SELECT COUNT(*) as total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as done FROM subtasks WHERE task_id = ?', [t.id]);
      t.subtasks_total = s.total || 0;
      t.subtasks_done = s.done || 0;
      const activeLog = queryOne('SELECT * FROM time_logs WHERE task_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [t.id]);
      t.active_timer = activeLog ? { id: activeLog.id, start_time: activeLog.start_time } : null;
    }
    res.json(tasks);
  });

  app.get('/api/tasks/:id', (req, res) => {
    const task = queryOne('SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Not found' });
    task.subtasks = queryAll('SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order', [req.params.id]);
    task.comments = queryAll('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]);
    task.reminders = queryAll('SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at', [req.params.id]);
    task.resources = queryAll('SELECT * FROM resources WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]);
    task.time_logs = queryAll('SELECT * FROM time_logs WHERE task_id = ? ORDER BY start_time DESC', [req.params.id]);
    task.children = queryAll('SELECT id, title, status, priority, time_estimate_min, time_spent_min FROM tasks WHERE parent_task_id = ?', [req.params.id]);
    task.active_timer = queryOne('SELECT * FROM time_logs WHERE task_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [req.params.id]);
    res.json(task);
  });

  app.post('/api/tasks', (req, res) => {
    const { title, description, category_id, priority, time_estimate_min, deadline, recurrence, tags, parent_task_id, goal_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const id = runInsert(
      'INSERT INTO tasks (title, description, category_id, priority, time_estimate_min, deadline, recurrence, tags, parent_task_id, goal_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [title, description||'', category_id||null, priority||'medium', time_estimate_min||0, deadline||null, recurrence||null, JSON.stringify(tags||[]), parent_task_id||null, goal_id||null]
    );
    res.json({ id, title, description, category_id, priority, time_estimate_min, deadline });
  });

  app.post('/api/tasks/bulk', (req, res) => {
    const { tasks, goal_id } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required' });
    const created = [];
    for (const t of tasks) {
      if (!t.title) continue;
      const id = runInsert(
        'INSERT INTO tasks (title, description, category_id, priority, time_estimate_min, deadline, goal_id) VALUES (?,?,?,?,?,?,?)',
        [t.title, t.description||'', t.category_id||null, t.priority||'medium', t.time_estimate_min||0, t.deadline||null, goal_id||null]
      );
      created.push({ id, title: t.title });
    }
    res.json({ created, count: created.length });
  });

  app.put('/api/tasks/:id', (req, res) => {
    const fields = ['title','description','category_id','status','priority','time_estimate_min','time_spent_min','deadline','recurrence','tags','parent_task_id','goal_id'];
    const sets = [], p = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); p.push(f === 'tags' ? JSON.stringify(req.body[f]) : req.body[f]); }
    }
    if (req.body.status === 'in_progress') sets.push('started_at = COALESCE(started_at, datetime("now"))');
    if (req.body.status === 'completed') sets.push('completed_at = datetime("now")');
    sets.push('updated_at = datetime("now")');
    p.push(req.params.id);
    runExec(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, p);
    res.json({ success: true });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    runExec('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── SUBTASKS ─────────────────────────────────────────
  app.post('/api/tasks/:id/subtasks', (req, res) => {
    const { title, time_estimate_min } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const max = queryOne('SELECT MAX(sort_order) as m FROM subtasks WHERE task_id = ?', [req.params.id]);
    const id = runInsert('INSERT INTO subtasks (task_id, title, time_estimate_min, sort_order) VALUES (?,?,?,?)',
      [req.params.id, title, time_estimate_min||0, (max.m||0)+1]);
    res.json({ id, title, completed: 0, time_estimate_min: time_estimate_min||0 });
  });

  app.put('/api/subtasks/:id', (req, res) => {
    const { title, completed, time_estimate_min, sort_order } = req.body;
    const u = [], p = [];
    if (title !== undefined) { u.push('title = ?'); p.push(title); }
    if (completed !== undefined) { u.push('completed = ?'); p.push(completed ? 1 : 0); }
    if (time_estimate_min !== undefined) { u.push('time_estimate_min = ?'); p.push(time_estimate_min); }
    if (sort_order !== undefined) { u.push('sort_order = ?'); p.push(sort_order); }
    if (u.length) { p.push(req.params.id); runExec(`UPDATE subtasks SET ${u.join(', ')} WHERE id = ?`, p); }
    res.json({ success: true });
  });

  app.delete('/api/subtasks/:id', (req, res) => {
    runExec('DELETE FROM subtasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── COMMENTS ─────────────────────────────────────────
  app.get('/api/tasks/:id/comments', (req, res) => {
    res.json(queryAll('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]));
  });

  app.post('/api/tasks/:id/comments', (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const id = runInsert('INSERT INTO comments (task_id, content) VALUES (?,?)', [req.params.id, content]);
    res.json({ id, task_id: +req.params.id, content, created_at: new Date().toISOString() });
  });

  app.delete('/api/comments/:id', (req, res) => {
    runExec('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── REMINDERS ────────────────────────────────────────
  app.get('/api/reminders', (req, res) => {
    let sql = 'SELECT r.*, t.title as task_title FROM reminders r JOIN tasks t ON r.task_id = t.id WHERE r.sent = 0';
    if (req.query.upcoming === 'true') sql += ' AND r.remind_at > datetime("now")';
    sql += ' ORDER BY r.remind_at';
    res.json(queryAll(sql));
  });

  app.post('/api/tasks/:id/reminders', (req, res) => {
    const { remind_at, message } = req.body;
    if (!remind_at) return res.status(400).json({ error: 'remind_at required' });
    const id = runInsert('INSERT INTO reminders (task_id, remind_at, message) VALUES (?,?,?)', [req.params.id, remind_at, message||'']);
    res.json({ id, remind_at, message, sent: 0 });
  });

  app.delete('/api/reminders/:id', (req, res) => {
    runExec('DELETE FROM reminders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── RESOURCES ────────────────────────────────────────
  app.post('/api/tasks/:id/resources', (req, res) => {
    const { title, url, type, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const id = runInsert('INSERT INTO resources (task_id, title, url, type, notes) VALUES (?,?,?,?,?)',
      [req.params.id, title, url||null, type||'link', notes||'']);
    res.json({ id, title, url, type: type||'link', notes });
  });

  app.delete('/api/resources/:id', (req, res) => {
    runExec('DELETE FROM resources WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── TIME TRACKING ────────────────────────────────────
  app.get('/api/tasks/:id/time/active', (req, res) => {
    const log = queryOne('SELECT * FROM time_logs WHERE task_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [req.params.id]);
    res.json(log || null);
  });

  app.post('/api/tasks/:id/time/start', (req, res) => {
    const existing = queryOne('SELECT * FROM time_logs WHERE task_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [req.params.id]);
    if (existing) {
      return res.json({ log_id: existing.id, start_time: existing.start_time, already_running: true });
    }
    const id = runInsert('INSERT INTO time_logs (task_id, start_time) VALUES (?, datetime("now"))', [req.params.id]);
    runExec('UPDATE tasks SET status = "in_progress", started_at = COALESCE(started_at, datetime("now")), updated_at = datetime("now") WHERE id = ? AND status = "pending"', [req.params.id]);
    res.json({ log_id: id });
  });

  app.post('/api/time-logs/:id/stop', (req, res) => {
    const log = queryOne('SELECT * FROM time_logs WHERE id = ?', [req.params.id]);
    if (!log) return res.status(404).json({ error: 'Not found' });
    runExec('UPDATE time_logs SET end_time = datetime("now"), duration_min = CAST((julianday(datetime("now")) - julianday(start_time)) * 24 * 60 AS INTEGER) WHERE id = ?', [req.params.id]);
    const updated = queryOne('SELECT * FROM time_logs WHERE id = ?', [req.params.id]);
    runExec('UPDATE tasks SET time_spent_min = time_spent_min + ?, updated_at = datetime("now") WHERE id = ?', [updated.duration_min, log.task_id]);
    res.json(updated);
  });

  // ─── GOALS (BRAIN DUMP) ──────────────────────────────
  app.get('/api/goals', (req, res) => {
    const { date, period } = req.query;
    let sql = 'SELECT * FROM goals WHERE 1=1';
    const p = [];
    if (date) { sql += ' AND target_date = ?'; p.push(date); }
    if (period) { sql += ' AND period = ?'; p.push(period); }
    sql += ' ORDER BY created_at DESC';
    const goals = queryAll(sql, p);
    for (const g of goals) {
      const taskStats = queryOne('SELECT COUNT(*) as total, SUM(CASE WHEN status=\'completed\' THEN 1 ELSE 0 END) as done FROM tasks WHERE goal_id = ?', [g.id]);
      g.tasks_total = taskStats.total || 0;
      g.tasks_done = taskStats.done || 0;
    }
    res.json(goals);
  });

  app.post('/api/goals', (req, res) => {
    const { title, description, period, target_date } = req.body;
    if (!title || !target_date) return res.status(400).json({ error: 'title and target_date required' });
    const id = runInsert('INSERT INTO goals (title, description, period, target_date) VALUES (?,?,?,?)',
      [title, description||'', period||'daily', target_date]);
    res.json({ id, title, period, target_date, status: 'active' });
  });

  app.put('/api/goals/:id', (req, res) => {
    const { status } = req.body;
    if (status) runExec('UPDATE goals SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  });

  app.delete('/api/goals/:id', (req, res) => {
    runExec('DELETE FROM goals WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── REPORTS ──────────────────────────────────────────
  app.get('/api/reports/summary', (req, res) => {
    const d = parseInt(req.query.days) || 7;
    res.json({
      total_tasks: queryOne('SELECT COUNT(*) as c FROM tasks').c,
      pending: queryOne("SELECT COUNT(*) as c FROM tasks WHERE status='pending'").c,
      in_progress: queryOne("SELECT COUNT(*) as c FROM tasks WHERE status='in_progress'").c,
      completed: queryOne("SELECT COUNT(*) as c FROM tasks WHERE status='completed'").c,
      overdue: queryOne("SELECT COUNT(*) as c FROM tasks WHERE deadline < datetime('now') AND status NOT IN ('completed','cancelled')").c,
      completed_recently: queryOne(`SELECT COUNT(*) as c FROM tasks WHERE status='completed' AND completed_at >= datetime('now','-${d} days')`).c,
      total_time_estimated: queryOne(`SELECT COALESCE(SUM(time_estimate_min),0) as s FROM tasks WHERE created_at >= datetime('now','-${d} days')`).s,
      total_time_spent: queryOne(`SELECT COALESCE(SUM(time_spent_min),0) as s FROM tasks WHERE created_at >= datetime('now','-${d} days')`).s,
      by_category: queryAll('SELECT c.name, c.color, COUNT(t.id) as count FROM categories c LEFT JOIN tasks t ON t.category_id=c.id GROUP BY c.id ORDER BY count DESC'),
      by_priority: queryAll('SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority'),
      by_status: queryAll('SELECT status, COUNT(*) as count FROM tasks GROUP BY status'),
      daily_completed: queryAll(`SELECT date(completed_at) as day, COUNT(*) as count FROM tasks WHERE status='completed' AND completed_at >= datetime('now','-${d} days') GROUP BY day ORDER BY day`)
    });
  });

  app.get('/api/reports/tasks', (req, res) => {
    res.json(queryAll(`
      SELECT t.*, c.name as category_name, c.color as category_color,
      (SELECT COUNT(*) FROM subtasks WHERE task_id=t.id) as subtasks_total,
      (SELECT SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) FROM subtasks WHERE task_id=t.id) as subtasks_done
      FROM tasks t LEFT JOIN categories c ON t.category_id=c.id WHERE t.status!='cancelled' ORDER BY t.priority DESC, t.deadline ASC
    `));
  });

  // ─── SCHEDULE ─────────────────────────────────────────
  app.get('/api/schedule', (req, res) => {
    const target = req.query.date || new Date().toISOString().split('T')[0];
    res.json(queryAll('SELECT s.*, t.title as task_title, t.priority, t.time_estimate_min FROM schedule s LEFT JOIN tasks t ON s.task_id=t.id WHERE date(s.start_time)=date(?) ORDER BY s.start_time', [target]));
  });

  app.post('/api/schedule', (req, res) => {
    const { task_id, title, description, start_time, end_time, type } = req.body;
    if (!title || !start_time || !end_time) return res.status(400).json({ error: 'title, start_time, end_time required' });
    const id = runInsert('INSERT INTO schedule (task_id, title, description, start_time, end_time, type) VALUES (?,?,?,?,?,?)',
      [task_id||null, title, description||'', start_time, end_time, type||'task']);
    res.json({ id });
  });

  app.put('/api/schedule/:id', (req, res) => {
    const { completed, start_time, end_time } = req.body;
    const u = [], p = [];
    if (completed !== undefined) { u.push('completed = ?'); p.push(completed ? 1 : 0); }
    if (start_time) { u.push('start_time = ?'); p.push(start_time); }
    if (end_time) { u.push('end_time = ?'); p.push(end_time); }
    if (u.length) { p.push(req.params.id); runExec(`UPDATE schedule SET ${u.join(', ')} WHERE id = ?`, p); }
    res.json({ success: true });
  });

  app.delete('/api/schedule/:id', (req, res) => {
    runExec('DELETE FROM schedule WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/schedule/generate', (req, res) => {
    const { date, start_hour, end_hour, break_duration_min } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayStart = parseInt(start_hour) || 8;
    const dayEnd = parseInt(end_hour) || 17;
    const breakDur = parseInt(break_duration_min) || 15;

    const tasks = queryAll(`
      SELECT * FROM tasks WHERE status IN ('pending','in_progress')
      AND (deadline IS NULL OR date(deadline) >= date(?))
      ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, deadline ASC
      LIMIT 20
    `, [targetDate]);

    runExec("DELETE FROM schedule WHERE date(start_time) = date(?)", [targetDate]);

    let cur = new Date(`${targetDate}T${String(dayStart).padStart(2,'0')}:00:00`);
    const end = new Date(`${targetDate}T${String(dayEnd).padStart(2,'0')}:00:00`);
    let idx = 0, scheduled = [];

    while (cur < end && idx < tasks.length) {
      const task = tasks[idx];
      const avail = (end - cur) / 60000;
      const dur = Math.min(task.time_estimate_min || 30, avail - breakDur);
      if (dur <= 0) break;
      const slotEnd = new Date(cur.getTime() + dur * 60000);
      const id = runInsert('INSERT INTO schedule (task_id, title, description, start_time, end_time, type) VALUES (?,?,?,?,?,?)',
        [task.id, task.title, task.description||'', cur.toISOString(), slotEnd.toISOString(), 'task']);
      scheduled.push({ id, task_id: task.id, title: task.title });
      cur = new Date(slotEnd.getTime() + breakDur * 60000);
      if ((task.time_estimate_min || 30) <= dur) idx++;
    }

    res.json({ scheduled, message: `Generated ${scheduled.length} time blocks` });
  });

  // ─── DASHBOARD ────────────────────────────────────────
  app.get('/api/dashboard', (req, res) => {
    res.json({
      today_tasks: queryAll(`
        SELECT t.*, c.name as category_name, c.color as category_color
        FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
        WHERE t.status IN ('pending','in_progress') AND (t.deadline IS NULL OR date(t.deadline) <= date('now'))
        ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.deadline ASC LIMIT 10
      `),
      upcoming_reminders: queryAll(`
        SELECT r.*, t.title as task_title FROM reminders r JOIN tasks t ON r.task_id=t.id
        WHERE r.sent=0 AND r.remind_at > datetime('now') ORDER BY r.remind_at LIMIT 5
      `),
      overdue: queryAll(`
        SELECT * FROM tasks WHERE deadline < datetime('now') AND status NOT IN ('completed','cancelled') ORDER BY deadline ASC
      `),
      active_goals: queryAll(`
        SELECT g.*, COUNT(t.id) as tasks_total, SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as tasks_done
        FROM goals g LEFT JOIN tasks t ON t.goal_id = g.id
        WHERE g.status = 'active' AND g.target_date >= date('now','-1 day')
        GROUP BY g.id ORDER BY g.target_date ASC LIMIT 3
      `),
      stats: {
        pending: queryOne("SELECT COUNT(*) as c FROM tasks WHERE status='pending'").c,
        in_progress: queryOne("SELECT COUNT(*) as c FROM tasks WHERE status='in_progress'").c,
        completed_today: queryOne("SELECT COUNT(*) as c FROM tasks WHERE status='completed' AND date(completed_at)=date('now')").c,
        total_time_today: queryOne("SELECT COALESCE(SUM(duration_min),0) as s FROM time_logs WHERE date(start_time)=date('now')").s
      }
    });
  });

  // ─── REMINDER CRON (SSE push to browser) ──────────────
  cron.schedule('* * * * *', () => {
    const due = queryAll('SELECT r.*, t.title FROM reminders r JOIN tasks t ON r.task_id=t.id WHERE r.sent=0 AND r.remind_at <= datetime("now")');
    for (const r of due) {
      broadcast('reminder', { id: r.id, task_id: r.task_id, title: r.title, message: r.message || 'Time to work on this!' });
      console.log(`REMINDER: "${r.title}" - ${r.message || 'Time to work on this!'}`);
      runExec('UPDATE reminders SET sent=1 WHERE id=?', [r.id]);
    }
  });

  // ─── SERVE FRONTEND (production) ──────────────────────
  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(__dirname, '..', 'dist');
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(PORT, () => console.log(`TaskTracker PA running at http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
