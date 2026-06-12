import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Use local worker module provided by pdfjs-dist via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export const parsePDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
};

export const parseImage = async (file: File): Promise<string> => {
  // Use object URL to prevent file reading issues in some browsers
  const objectUrl = URL.createObjectURL(file);
  try {
    const result = await Tesseract.recognize(objectUrl, 'eng');
    return result.data.text.trim();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
