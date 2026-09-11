const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function convertParams(sql, params) {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return pool.query(converted, params);
}

async function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database tables ready');
}

async function queryAll(sql, params = []) {
  const result = await convertParams(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await convertParams(sql, params);
  return result.rows[0] || null;
}

async function runInsert(sql, params = []) {
  const result = await convertParams(sql + ' RETURNING id', params);
  return result.rows[0].id;
}

async function runExec(sql, params = []) {
  await convertParams(sql, params);
}

function save() {}

module.exports = { initDatabase, queryAll, queryOne, runInsert, runExec, save };
