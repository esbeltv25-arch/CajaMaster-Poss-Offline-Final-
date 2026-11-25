import jsPDF from "jspdf";
import { deliverPdfFile } from "./pdfExport";
import { MANUAL_CHAPTERS, MANUAL_EDITION, manualImageUrl, type ManualSection } from "../content/userManual";

/**
 * Detailed, step-by-step user manual as an A4 PDF (cover, table of contents with page
 * numbers, one chapter per function). Content comes from content/userManual.ts, the same
 * text shown inside the app.
 */

// The built-in PDF fonts only cover Latin-1/WinAnsi: replace symbols and drop emoji.
const SYMBOLS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "⇄": "<->",
  "−": "-",
  "✓": "",
  "✕": "x",
  "≥": ">=",
  "≤": "<=",
};
function pdfText(s: string): string {
  let out = "";
  for (const ch of s) {
    if (SYMBOLS[ch] !== undefined) out += SYMBOLS[ch];
    else if (ch.codePointAt(0)! <= 0xff || "—–•…‘’“”€".includes(ch)) out += ch;
    // anything else (emoji, variation selectors) is dropped
  }
  return out.replace(/ {2,}/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();
}

interface LoadedImage {
  data: string;
  w: number;
  h: number;
}

/** Loads a manual screenshot as a data URL with its size (null if it cannot be loaded). */
async function loadImage(file: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(manualImageUrl(file));
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = data;
    });
    return { data, ...size };
  } catch {
    return null;
  }
}

const DARK: [number, number, number] = [15, 23, 42];
const AMBER: [number, number, number] = [245, 158, 11];
const MUTED: [number, number, number] = [71, 85, 105];
const MAIN: [number, number, number] = [15, 23, 42];

export async function generateDetailedManualPdf(businessName = "CajaMaster POS", preferShare = false): Promise<boolean> {
  const images = new Map<string, LoadedImage>();
  await Promise.all(
    MANUAL_CHAPTERS.flatMap((c) => c.sections.flatMap((s) => s.images || [])).map(async (img) => {
      const loaded = await loadImage(img.file);
      if (loaded) images.set(img.file, loaded);
    })
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - M * 2;
  const BOTTOM = H - 16;
  let y = M;
  let chapterTitle = "";

  const header = () => {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(251, 191, 36);
    doc.text("CAJAMASTER POS", M, 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(pdfText(`|  MANUAL DETALLADO  |  ${chapterTitle.toUpperCase()}`), M + doc.getTextWidth("CAJAMASTER POS") + 2, 6);
  };

  const newPage = () => {
    doc.addPage();
    header();
    y = M + 2;
  };

  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  const wrap = (text: string, width: number, size: number, style: "normal" | "bold" = "normal"): string[] => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    return doc.splitTextToSize(pdfText(text), width) as string[];
  };

  const paragraph = (text: string, size = 9.5, color = MUTED, x = M, width = CW) => {
    const lines = wrap(text, width, size);
    const lh = size * 0.45;
    for (const line of lines) {
      ensure(lh + 1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(line, x, y + lh);
      y += lh;
    }
    y += 1.8;
  };

  const box = (label: string, text: string, fill: [number, number, number], border: [number, number, number], ink: [number, number, number]) => {
    const lines = wrap(`${label} ${text}`, CW - 8, 9);
    const h = lines.length * 4.1 + 5;
    ensure(h + 2);
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, h, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    lines.forEach((l, i) => doc.text(l, M + 4, y + 5.6 + i * 4.1));
    y += h + 2.5;
  };

  const section = (num: string, s: ManualSection) => {
    // keep the heading with at least the first lines
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...MAIN);
    const title = pdfText(`${num} ${s.title}${s.isNew ? "  (NUEVO)" : ""}`);
    doc.text(title, M, y + 5);
    doc.setDrawColor(...AMBER);
    doc.setLineWidth(0.6);
    doc.line(M, y + 7, M + Math.min(CW, doc.getTextWidth(title)), y + 7);
    y += 10.5;

    if (s.intro) paragraph(s.intro);

    s.steps?.forEach((st, k) => {
      const lines = wrap(st, CW - 11, 9.5);
      const h = lines.length * 4.3 + 2.2;
      ensure(h);
      doc.setFillColor(...DARK);
      doc.roundedRect(M, y + 0.3, 6.5, 6.5, 1.3, 1.3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(251, 191, 36);
      doc.text(String(k + 1), M + 3.25, y + 4.9, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MAIN);
      lines.forEach((l, i) => doc.text(l, M + 10, y + 4.7 + i * 4.3));
      y += h + 1;
    });

    s.bullets?.forEach((b) => {
      const lines = wrap(b, CW - 7, 9.5);
      const h = lines.length * 4.3 + 1.6;
      ensure(h);
      doc.setFillColor(...AMBER);
      doc.circle(M + 1.6, y + 3.2, 0.9, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MAIN);
      lines.forEach((l, i) => doc.text(l, M + 5, y + 4.4 + i * 4.3));
      y += h;
    });
    if (s.steps || s.bullets) y += 1.5;

    s.tips?.forEach((t) => box("CONSEJO:", t, [236, 253, 245], [167, 243, 208], [6, 95, 70]));
    if (s.warning) box("IMPORTANTE:", s.warning, [255, 251, 235], [253, 230, 138], [120, 53, 15]);
    s.images?.forEach((img) => {
      const loaded = images.get(img.file);
      if (!loaded) return;
      // phone screenshot: at most 60 mm wide and 105 mm tall, centred, caption below
      let w = 60;
      let h = (loaded.h / loaded.w) * w;
      if (h > 105) {
        h = 105;
        w = (loaded.w / loaded.h) * h;
      }
      const capLines = wrap(img.caption, 120, 8.5);
      ensure(h + capLines.length * 3.8 + 8);
      const x = (W - w) / 2;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.addImage(loaded.data, "JPEG", x, y + 1, w, h);
      doc.roundedRect(x - 0.4, y + 0.6, w + 0.8, h + 0.8, 2, 2, "S");
      y += h + 5;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      capLines.forEach((l) => {
        doc.text(l, W / 2, y, { align: "center" });
        y += 3.8;
      });
      y += 3;
    });
    y += 3;
  };

  // ---------------------------------------------------------------- cover
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 105, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 105, W, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text("CAJAMASTER POS", M, 45);
  doc.setFontSize(16);
  doc.setTextColor(251, 191, 36);
  doc.text("Manual de usuario detallado", M, 57);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text("Guía paso a paso de todas las funciones", M, 67);
  doc.setFontSize(9.5);
  doc.text(pdfText(MANUAL_EDITION), M, 92);
  doc.text(pdfText(`Negocio: ${businessName}`), M, 98);

  y = 122;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...MAIN);
  doc.text("Cómo usar este manual", M, y);
  y += 6;
  paragraph(
    "Cada capítulo explica una parte de la app con pasos numerados, en el mismo orden en que se hacen en la pantalla. Los nombres entre comillas «así» son los textos exactos de los botones y pantallas de la app."
  );
  paragraph(
    "Los recuadros verdes son consejos y los amarillos son avisos importantes. Las partes marcadas como (NUEVO) se añadieron en las últimas versiones."
  );
  paragraph(
    "Este mismo manual está dentro de la app, con buscador: Ajustes -> Manual de Usuario -> Abrir Guía -> «Manual completo». Si tienes una duda concreta, escribe una palabra en el buscador (por ejemplo «PIN», «Telegram» o «cierre»)."
  );

  // ------------------------------------------------- table of contents (filled later)
  chapterTitle = "Índice";
  newPage();
  const tocPage = doc.getNumberOfPages();

  // ---------------------------------------------------------------- chapters
  const chapterPages: number[] = [];
  MANUAL_CHAPTERS.forEach((ch, idx) => {
    chapterTitle = ch.title;
    newPage();
    chapterPages.push(doc.getNumberOfPages());
    // chapter banner
    doc.setFillColor(...DARK);
    doc.roundedRect(M, y, CW, 20, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(251, 191, 36);
    doc.text(pdfText(`CAPÍTULO ${idx + 1}${ch.isNew ? "  ·  NUEVO" : ""}`), M + 5, y + 7);
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfText(ch.title), M + 5, y + 15.5);
    y += 25;
    paragraph(ch.summary, 10, MUTED);
    y += 1;
    ch.sections.forEach((s, i) => section(`${idx + 1}.${i + 1}`, s));
  });

  // ---------------------------------------------------------------- TOC
  doc.setPage(tocPage);
  y = M + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...MAIN);
  doc.text("Índice", M, y + 6);
  y += 15;
  MANUAL_CHAPTERS.forEach((ch, idx) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...MAIN);
    const label = pdfText(`${idx + 1}. ${ch.title}${ch.isNew ? "  (NUEVO)" : ""}`);
    doc.text(label, M, y);
    doc.text(String(chapterPages[idx]), W - M, y, { align: "right" });
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([0.6, 1.2], 0);
    doc.line(M + doc.getTextWidth(label) + 2, y - 0.8, W - M - 8, y - 0.8);
    doc.setLineDashPattern([], 0);
    doc.link(M, y - 5, CW, 7, { pageNumber: chapterPages[idx] });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(ch.summary), M + 5, y + 4.3, { maxWidth: CW - 15 });
    y += 13;
  });

  // ---------------------------------------------------------------- footers
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfText(`CajaMaster POS · Manual detallado · ${businessName}`), M, H - 6.5);
    doc.text(`Página ${p} de ${total}`, W - M, H - 6.5, { align: "right" });
  }

  const filename = `Manual_Detallado_CajaMaster_${businessName.replace(/[^\w-]+/g, "_")}.pdf`;
  return (await deliverPdfFile(doc, filename, "Manual detallado de CajaMaster POS", preferShare)).success;
}
