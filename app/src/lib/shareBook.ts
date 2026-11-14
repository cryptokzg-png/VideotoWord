import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { Book } from '../types';
import { buildPdfHtml } from './export';

async function shareFile(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım kullanılamıyor.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
}

export async function exportPdf(book: Book) {
  const { uri } = await Print.printToFileAsync({ html: buildPdfHtml(book) });
  await shareFile(uri, 'application/pdf', 'PDF dışa aktar');
}

/** Share what is on screen right now (one page) as a PNG image. */
export async function sharePageImage(view: Parameters<typeof captureRef>[0]) {
  const uri = await captureRef(view, { format: 'png', quality: 1 });
  await shareFile(uri, 'image/png', 'Sayfayı paylaş');
}
