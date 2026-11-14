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
          lastPage INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS bookmarks (
          bookId TEXT NOT NULL,
          page INTEGER NOT NULL,
          PRIMARY KEY (bookId, page)
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function saveBook(b: Book) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO books
     (id,title,author,url,thumbnail,durationSec,chapters,pages,pageCount,createdAt,lastPage)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    b.id, b.title, b.author, b.url, b.thumbnail, b.durationSec,
    JSON.stringify(b.chapters), JSON.stringify(b.pages), b.pages.length, b.createdAt, b.lastPage,
  );
}

export async function listBooks(): Promise<BookRow[]> {
  const db = await getDb();
  return db.getAllAsync<BookRow>(
    `SELECT id,title,author,url,thumbnail,durationSec,pageCount,createdAt,lastPage
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
  await db.runAsync('DELETE FROM bookmarks WHERE bookId = ?', id);
}

export async function setLastPage(id: string, page: number) {
  const db = await getDb();
  await db.runAsync('UPDATE books SET lastPage = ? WHERE id = ?', page, id);
}

export async function getBookmarks(bookId: string): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ page: number }>(
    'SELECT page FROM bookmarks WHERE bookId = ? ORDER BY page', bookId);
  return rows.map((r) => r.page);
}

export async function toggleBookmark(bookId: string, page: number): Promise<boolean> {
  const db = await getDb();
  const ex = await db.getFirstAsync('SELECT 1 FROM bookmarks WHERE bookId=? AND page=?', bookId, page);
  if (ex) {
    await db.runAsync('DELETE FROM bookmarks WHERE bookId=? AND page=?', bookId, page);
    return false;
  }
  await db.runAsync('INSERT INTO bookmarks (bookId,page) VALUES (?,?)', bookId, page);
  return true;
}
