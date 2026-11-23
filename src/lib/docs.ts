export type DocKind = "materi" | "soal" | "laporan" | "lainnya";

export interface DocTable { head: string[]; rows: string[][] }
export interface GeneratedDoc {
  id: string;
  title: string;
  kind: DocKind;
  agentId: string;
  classId?: string;
  subject?: string;
  createdAt: number;
  content: string; // markdown sederhana: #, ##, -, paragraf
  table?: DocTable;
}

export const KIND_LABEL: Record<DocKind, string> = { materi: "Materi", soal: "Soal", laporan: "Laporan", lainnya: "Lainnya" };

type Block = { t: "h1" | "h2" | "li" | "p"; text: string };

const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`/g, "").replace(/^>\s?/, "");

export function parseBlocks(content: string): Block[] {
  const out: Block[] = [];
  for (const raw of content.split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) continue;
    if (/^#{3,}\s/.test(l)) out.push({ t: "h2", text: clean(l.replace(/^#+\s*/, "")) });
    else if (/^##\s/.test(l)) out.push({ t: "h2", text: clean(l.slice(3)) });
    else if (/^#\s/.test(l)) out.push({ t: "h1", text: clean(l.slice(2)) });
    else if (/^\s*[-*•]\s/.test(l)) out.push({ t: "li", text: clean(l.replace(/^\s*[-*•]\s/, "")) });
    else out.push({ t: "p", text: clean(l.trim()) });
  }
  return out;
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "dokumen";

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function exportPdf(doc: GeneratedDoc) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth() - 100;
  let y = 56;
  const ensure = (h: number) => { if (y + h > pdf.internal.pageSize.getHeight() - 50) { pdf.addPage(); y = 56; } };
  pdf.setFont("helvetica", "bold").setFontSize(17);
  pdf.splitTextToSize(doc.title, W).forEach((ln: string) => { pdf.text(ln, 50, y); y += 22; });
  y += 6;
  for (const b of parseBlocks(doc.content)) {
    if (b.t === "h1" || b.t === "h2") { pdf.setFont("helvetica", "bold").setFontSize(b.t === "h1" ? 14 : 12); y += 6; }
    else pdf.setFont("helvetica", "normal").setFontSize(10.5);
    const lines = pdf.splitTextToSize((b.t === "li" ? "• " : "") + b.text, b.t === "li" ? W - 14 : W) as string[];
    for (const ln of lines) { ensure(15); pdf.text(ln, b.t === "li" ? 64 : 50, y); y += 15; }
  }
  if (doc.table) {
    ensure(40);
    autoTable(pdf, { startY: y + 8, head: [doc.table.head], body: doc.table.rows, styles: { fontSize: 9 }, headStyles: { fillColor: [31, 107, 74] }, margin: { left: 50, right: 50 } });
  }
  pdf.save(`${safeName(doc.title)}.pdf`);
}

export async function exportDocx(doc: GeneratedDoc) {
  const d = await import("docx");
  const kids: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [
    new d.Paragraph({ text: doc.title, heading: d.HeadingLevel.TITLE }),
  ];
  for (const b of parseBlocks(doc.content)) {
    if (b.t === "h1") kids.push(new d.Paragraph({ text: b.text, heading: d.HeadingLevel.HEADING_1 }));
    else if (b.t === "h2") kids.push(new d.Paragraph({ text: b.text, heading: d.HeadingLevel.HEADING_2 }));
    else if (b.t === "li") kids.push(new d.Paragraph({ text: b.text, bullet: { level: 0 } }));
    else kids.push(new d.Paragraph({ text: b.text, spacing: { after: 100 } }));
  }
  if (doc.table) {
    const cell = (t: string, bold = false) => new d.TableCell({ children: [new d.Paragraph({ children: [new d.TextRun({ text: t, bold })] })] });
    kids.push(new d.Paragraph({ text: "" }));
    kids.push(new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      rows: [new d.TableRow({ children: doc.table.head.map((h) => cell(h, true)) }), ...doc.table.rows.map((r) => new d.TableRow({ children: r.map((c) => cell(c)) }))],
    }));
  }
  const blob = await d.Packer.toBlob(new d.Document({ sections: [{ children: kids }] }));
  download(blob, `${safeName(doc.title)}.docx`);
}

export async function exportXlsx(doc: GeneratedDoc) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Dokumen");
  ws.addRow([doc.title]).font = { bold: true, size: 14 };
  ws.addRow([]);
  if (doc.table) {
    const h = ws.addRow(doc.table.head);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6B4A" } }; });
    doc.table.rows.forEach((r) => ws.addRow(r.map((v) => (v !== "" && !isNaN(Number(v)) ? Number(v) : v))));
    ws.columns.forEach((c, i) => { c.width = Math.max(12, ...[doc.table!.head[i], ...doc.table!.rows.map((r) => r[i])].map((v) => String(v ?? "").length + 2)); });
    if (doc.content.trim()) { ws.addRow([]); parseBlocks(doc.content).forEach((b) => ws.addRow([b.text])); }
  } else {
    parseBlocks(doc.content).forEach((b) => { const r = ws.addRow([b.text]); if (b.t !== "p" && b.t !== "li") r.font = { bold: true }; });
    ws.getColumn(1).width = 110;
    ws.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  }
  download(new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeName(doc.title)}.xlsx`);
}
