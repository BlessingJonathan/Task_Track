const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'tasktracker.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      time_estimate_min INTEGER DEFAULT 0,
      time_spent_min INTEGER DEFAULT 0,
      deadline DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      recurrence TEXT,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      parent_task_id INTEGER,
      goal_id INTEGER,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      time_estimate_min INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      remind_at DATETIME NOT NULL,
      message TEXT,
      sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      type TEXT DEFAULT 'link',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration_min INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      type TEXT DEFAULT 'task',
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      period TEXT DEFAULT 'daily',
      target_date DATE NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const cols = queryAll('PRAGMA table_info(tasks)');
  const hasGoalId = cols.some(c => c.name === 'goal_id');
  if (!hasGoalId) {
    db.run('ALTER TABLE tasks ADD COLUMN goal_id INTEGER');
    db.run('CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id)');
  }

  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_resources_task ON resources(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_time_logs_task ON time_logs(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_time_logs_active ON time_logs(task_id, end_time)');
  db.run('CREATE INDEX IF NOT EXISTS idx_schedule_time ON schedule(start_time, end_time)');
  db.run('CREATE INDEX IF NOT EXISTS idx_goals_date ON goals(target_date)');

  const catCheck = queryOne('SELECT COUNT(*) as count FROM categories');
  if (catCheck.count === 0) {
    const cats = [
      ['Work','#6366f1'],['Study','#10b981'],['Personal','#f59e0b'],['Health','#ef4444'],
      ['Projects','#8b5cf6'],['Learning','#06b6d4'],['Admin','#64748b'],['Creative','#ec4899']
    ];
    for (const [name, color] of cats) {
      db.run('INSERT INTO categories (name, color) VALUES (?, ?)', [name, color]);
    }
  }

  save();
  return db;
}

function save() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  const row = queryOne('SELECT last_insert_rowid() as id');
  save();
  return row.id;
}

function runExec(sql, params = []) {
  db.run(sql, params);
  save();
}

function getDb() { return db; }

module.exports = { initDatabase, queryAll, queryOne, runInsert, runExec, save, getDb };
