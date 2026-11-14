import * as SQLite from 'expo-sqlite';
import type { Book, BookRow } from '../types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('videokitap.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          url TEXT NOT NULL,
          thumbnail TEXT NOT NULL,
          durationSec INTEGER NOT NULL,
          chapters TEXT NOT NULL,
          pages TEXT NOT NULL,
          pageCount INTEGER NOT NULL,
          createdAt INTEGER NOT NULL,
          lastPage INTEGER NOT NULL DEFAULT 0,
          lastPos INTEGER NOT NULL DEFAULT 0,
          totalChars INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS marks (
          bookId TEXT NOT NULL,
          pos INTEGER NOT NULL,
          PRIMARY KEY (bookId, pos)
        );
      `);
      // upgrade databases created by older versions
      for (const col of ['lastPos', 'totalChars']) {
        try {
          await db.execAsync(`ALTER TABLE books ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
        } catch {
          /* column already exists */
        }
      }
      return db;
    })();
  }
  return dbPromise;
}

export async function saveBook(b: Book) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO books
     (id,title,author,url,thumbnail,durationSec,chapters,pages,pageCount,createdAt,lastPage,lastPos,totalChars)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.id, b.title, b.author, b.url, b.thumbnail, b.durationSec,
    JSON.stringify(b.chapters), JSON.stringify(b.pages), b.pages.length, b.createdAt,
    b.lastPage, b.lastPos, b.totalChars,
  );
}

export async function listBooks(): Promise<BookRow[]> {
  const db = await getDb();
  return db.getAllAsync<BookRow>(
    `SELECT id,title,author,url,thumbnail,durationSec,pageCount,createdAt,lastPage,lastPos,totalChars
     FROM books ORDER BY createdAt DESC`,
  );
}

export async function getBook(id: string): Promise<Book | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT * FROM books WHERE id = ?', id);
  if (!r) return null;
  return { ...r, chapters: JSON.parse(r.chapters), pages: JSON.parse(r.pages) };
}

export async function deleteBook(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM books WHERE id = ?', id);
  await db.runAsync('DELETE FROM marks WHERE bookId = ?', id);
}

export async function setLastPos(id: string, pos: number) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET lastPos = ? WHERE id = ?', pos, id);
}

/** Page count as laid out on this phone (changes with screen size and font size). */
export async function setPageCount(id: string, count: number) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET pageCount = ? WHERE id = ?', count, id);
}

export async function getMarks(bookId: string): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ pos: number }>('SELECT pos FROM marks WHERE bookId = ? ORDER BY pos', bookId);
  return rows.map((r) => r.pos);
}

/** Toggle a bookmark for the page covering reading positions [from, to). */
export async function toggleMark(bookId: string, from: number, to: number): Promise<void> {
  const db = await getDb();
  const hit = await db.getFirstAsync('SELECT 1 FROM marks WHERE bookId = ? AND pos >= ? AND pos < ?', bookId, from, to);
  if (hit) await db.runAsync('DELETE FROM marks WHERE bookId = ? AND pos >= ? AND pos < ?', bookId, from, to);
  else await db.runAsync('INSERT INTO marks (bookId,pos) VALUES (?,?)', bookId, from);
}

/** Reading progress 0..1 (falls back to the old page index for books saved before lastPos existed). */
export function progressOf(b: Pick<BookRow, 'lastPos' | 'totalChars' | 'lastPage' | 'pageCount'>): number {
  if (b.totalChars > 0) return Math.min(1, b.lastPos / b.totalChars);
  return b.pageCount ? Math.min(1, b.lastPage / b.pageCount) : 0;
}
