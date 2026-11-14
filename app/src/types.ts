export type Chapter = { title: string; text: string };

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
};

export type BookRow = Omit<Book, 'chapters' | 'pages'> & { pageCount: number };
