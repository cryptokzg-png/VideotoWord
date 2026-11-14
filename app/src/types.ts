export type Chapter = { title: string; text: string; custom?: boolean }; // custom: renamed by the user

export type Book = {
  id: string; // YouTube video id
  title: string;
  author: string;
  url: string;
  thumbnail: string;
  durationSec: number;
  chapters: Chapter[];
  pages: string[]; // paginated plain text, one entry per page
  createdAt: number;
  pageCount?: number; // page count as laid out on the phone (set by the reader)
  lastPage: number; // legacy page index
  lastPos: number; // reading position (non-space chars), independent of font size
  totalChars: number;
  favorite?: number; // 1 = favorite
};

export type BookRow = Omit<Book, 'chapters' | 'pages'> & { pageCount: number };

export type Note = {
  id: number;
  bookId: string;
  pos: number; // reading position where the quote starts
  quote: string;
  note: string; // user's own comment, may be empty
  favorite: number; // 1 = favorite quote
  createdAt: number;
  bookTitle?: string; // only when listing across books
};
