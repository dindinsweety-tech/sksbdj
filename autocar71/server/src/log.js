/* Структурный лог: строка JSON в stdout и в файл. Персональные данные маскируются. */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const LOG_FILE = process.env.LOG_FILE || '';
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 20;

if (LOG_FILE) {
  try { mkdirSync(dirname(LOG_FILE), { recursive: true }); } catch {}
}

/** Телефон в логе — только последние 4 цифры. */
export const maskPhone = phone => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length < 4 ? '***' : `***${digits.slice(-4)}`;
};

const write = (level, event, fields = {}) => {
  if (LEVELS[level] < MIN) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  process.stdout.write(`${line}\n`);
  if (LOG_FILE) { try { appendFileSync(LOG_FILE, `${line}\n`); } catch {} }
};

export const log = {
  debug: (event, fields) => write('debug', event, fields),
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields)
};
