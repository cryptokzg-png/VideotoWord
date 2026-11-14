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
  lastPage: number;
};

export type BookRow = Omit<Book, 'chapters' | 'pages'> & { pageCount: number };
