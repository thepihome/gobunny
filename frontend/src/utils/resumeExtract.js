/**
 * Client-side resume text extraction — parsed text is sent to D1 (R2 optional).
 */

export async function extractTextFromFile(file) {
  if (!file) return '';
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return extractPdfText(file);
  if (name.endsWith('.docx')) return extractDocxText(file);
  if (name.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not parsed in-browser. Save as .docx or paste content in Resume Studio.');
  }
  return readAsText(file);
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    parts.push(pageText);
  }
  return parts.join('\n\n').trim();
}

async function extractDocxText(file) {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || '').trim();
}

export function emptyStructuredContent() {
  return {
    contact: { name: '', email: '', phone: '', linkedin: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
  };
}

export function newExperienceId() {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newEducationId() {
  return `edu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
