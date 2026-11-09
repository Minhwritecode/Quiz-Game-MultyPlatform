import * as SQLite from 'expo-sqlite';
import type { Attempt, QuestionSet, SyncItem } from '@/core/domain/models';

let database: SQLite.SQLiteDatabase | null = null;

export function getLocalDatabase(): SQLite.SQLiteDatabase {
  database ??= SQLite.openDatabaseSync('papyrus.db');
  database.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY NOT NULL,
      set_id TEXT NOT NULL,
      content TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY NOT NULL,
      question_set_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      total INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempt_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      chosen_index INTEGER,
      is_correct INTEGER NOT NULL,
      time_ms INTEGER NOT NULL
    );
  `);
  return database;
}

type QuestionSetRow = { id: string; title: string; subject: string; updated_at: string; sync_status: QuestionSet['syncStatus'] };
type QuestionRow = { id: string; set_id: string; content: string; options_json: string; correct_index: number; explanation: string; position: number };

export async function loadQuestionSets(): Promise<QuestionSet[]> {
  const db = getLocalDatabase();
  const sets = db.getAllSync<QuestionSetRow>('SELECT id, title, subject, updated_at, sync_status FROM question_sets WHERE is_deleted = 0 ORDER BY updated_at DESC');
  return sets.map((set) => ({
    id: set.id,
    title: set.title,
    subject: set.subject,
    updatedAt: set.updated_at,
    syncStatus: set.sync_status,
    questions: db.getAllSync<QuestionRow>('SELECT id, set_id, content, options_json, correct_index, explanation, position FROM questions WHERE set_id = ? ORDER BY position ASC', set.id).map((question) => ({
      id: question.id,
      content: question.content,
      options: JSON.parse(question.options_json) as string[],
      correctIndex: question.correct_index,
      explanation: question.explanation,
      position: question.position,
    })),
  }));
}

export async function persistQuestionSet(questionSet: QuestionSet): Promise<void> {
  const db = getLocalDatabase();
  db.withTransactionSync(() => {
    const existing = db.getFirstSync<{ id: string }>('SELECT id FROM question_sets WHERE id = ? LIMIT 1', questionSet.id);
    const operation = existing ? 'update' : 'insert';
    db.runSync(
      'INSERT OR REPLACE INTO question_sets (id, title, subject, updated_at, sync_status, is_deleted) VALUES (?, ?, ?, ?, ?, 0)',
      questionSet.id, questionSet.title, questionSet.subject, questionSet.updatedAt, questionSet.syncStatus,
    );
    db.runSync('DELETE FROM questions WHERE set_id = ?', questionSet.id);
    for (const question of questionSet.questions) {
      db.runSync(
        'INSERT INTO questions (id, set_id, content, options_json, correct_index, explanation, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        question.id, questionSet.id, question.content, JSON.stringify(question.options), question.correctIndex, question.explanation, question.position,
      );
    }
    db.runSync('DELETE FROM sync_queue WHERE entity = ? AND entity_id = ?', 'question_sets', questionSet.id);
    db.runSync(
      'INSERT INTO sync_queue (entity, entity_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      'question_sets', questionSet.id, operation, JSON.stringify(questionSet), new Date().toISOString(),
    );
  });
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const db = getLocalDatabase();
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT OR REPLACE INTO attempts (id, question_set_id, score, correct_count, total, started_at, finished_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      attempt.id, attempt.questionSetId, attempt.score, attempt.correctCount, attempt.total, attempt.startedAt, attempt.finishedAt, attempt.status,
    );
    db.runSync('DELETE FROM attempt_answers WHERE attempt_id = ?', attempt.id);
    for (const answer of attempt.answers) {
      db.runSync(
        'INSERT INTO attempt_answers (attempt_id, question_id, chosen_index, is_correct, time_ms) VALUES (?, ?, ?, ?, ?)',
        attempt.id, answer.questionId, answer.chosenIndex, answer.isCorrect ? 1 : 0, answer.timeMs,
      );
    }
    db.runSync('DELETE FROM sync_queue WHERE entity = ? AND entity_id = ?', 'attempts', attempt.id);
    db.runSync(
      'INSERT INTO sync_queue (entity, entity_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      'attempts', attempt.id, 'insert', JSON.stringify(attempt), new Date().toISOString(),
    );
  });
}

export async function getLatestAttempt(questionSetId: string): Promise<Attempt | null> {
  const db = getLocalDatabase();
  const rows = db.getAllSync<{ id: string; question_set_id: string; score: number; correct_count: number; total: number; started_at: string; finished_at: string; status: 'completed' }>(
    'SELECT id, question_set_id, score, correct_count, total, started_at, finished_at, status FROM attempts WHERE question_set_id = ? ORDER BY finished_at DESC LIMIT 1',
    questionSetId,
  );
  const row = rows[0];
  if (!row) return null;
  const answers = db.getAllSync<{ question_id: string; chosen_index: number | null; is_correct: number; time_ms: number }>(
    'SELECT question_id, chosen_index, is_correct, time_ms FROM attempt_answers WHERE attempt_id = ? ORDER BY id ASC',
    row.id,
  );
  return {
    id: row.id,
    questionSetId: row.question_set_id,
    score: row.score,
    correctCount: row.correct_count,
    total: row.total,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    answers: answers.map((answer) => ({ questionId: answer.question_id, chosenIndex: answer.chosen_index, isCorrect: answer.is_correct === 1, timeMs: answer.time_ms })),
  };
}

type SyncItemRow = { id: number; entity: string; entity_id: string; operation: SyncItem['operation']; payload: string; created_at: string; retry_count: number };

export async function loadSyncItems(): Promise<SyncItem[]> {
  const db = getLocalDatabase();
  return db.getAllSync<SyncItemRow>('SELECT id, entity, entity_id, operation, payload, created_at, retry_count FROM sync_queue ORDER BY created_at ASC, id ASC').map((item) => ({
    id: item.id,
    entity: item.entity,
    entityId: item.entity_id,
    operation: item.operation,
    payload: JSON.parse(item.payload) as Record<string, unknown>,
    createdAt: item.created_at,
    retryCount: item.retry_count,
  }));
}

export async function acknowledgeSyncItem(id: number): Promise<void> {
  getLocalDatabase().runSync('DELETE FROM sync_queue WHERE id = ?', id);
}

export async function markSyncItemRetry(id: number): Promise<void> {
  getLocalDatabase().runSync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', id);
}
