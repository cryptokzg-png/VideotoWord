import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { Book } from '../types';
import { buildEpub, buildPdfHtml } from './export';

const safeName = (t: string) => t.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'kitap';

async function shareFile(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım kullanılamıyor.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
}

export async function exportEpub(book: Book) {
  const bytes = await buildEpub(book);
  const file = new File(Paths.cache, `${safeName(book.title)}.epub`);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  await shareFile(file.uri, 'application/epub+zip', 'EPUB dışa aktar');
}

export async function exportPdf(book: Book) {
  const { uri } = await Print.printToFileAsync({ html: buildPdfHtml(book) });
  await shareFile(uri, 'application/pdf', 'PDF dışa aktar');
}
