import * as SQLite from 'expo-sqlite';
import type { QuestionSet } from '@/core/domain/models';

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
  `);
  return database;
}

export function persistQuestionSet(questionSet: QuestionSet): void {
  const db = getLocalDatabase();
  db.withTransactionSync(() => {
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
    db.runSync(
      'INSERT INTO sync_queue (entity, entity_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      'question_sets', questionSet.id, 'upsert', JSON.stringify({ id: questionSet.id }), new Date().toISOString(),
    );
  });
}
