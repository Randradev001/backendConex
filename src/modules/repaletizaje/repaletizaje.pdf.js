const path = require('path');
const PDFDocument = require('pdfkit');

const clean = (value) => String(value ?? '').trim();
const date = (value) => {
  const raw = clean(value).slice(0, 10);
  const [year, month, day] = raw.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '-';
};
const num = (value) => Number(value || 0).toLocaleString('es-CL');
const sagLogoPath = path.join(__dirname, '../../img/sag-logo.png');

// RepaV2 is a monochrome, letter-sized portrait report.  The coordinates keep
// the legacy order and labels while allowing the web backend to generate it
// without relying on the browser print dialog.
const renderRepaletizajePdf = ({ header, folios, movements }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: 'LETTER',
    layout: 'portrait',
    margins: { top: 0, bottom: 0, left: 8, right: 20 },
    bufferPages: true,
    info: { Title: 'Repaletizaje' }
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  const black = '#000000';
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const right = left + width;
  const pageBottom = doc.page.height - 34;
  const signatureLineY = pageBottom - 62;
  const speciesName = (folios || []).map((item) => item.speciesName || item.speciesCode).filter(Boolean).join(', ');
  let y = 16;

  const line = (x1, y1, x2, y2, weight = 0.6) => doc.strokeColor(black).lineWidth(weight).moveTo(x1, y1).lineTo(x2, y2).stroke();
  const text = (value, x, top, size = 8, options = {}) => doc.fillColor(black).font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).text(clean(value) || '-', x, top, { lineBreak: false, ...options });
  const headerBlock = (continuation = false) => {
    doc.image(sagLogoPath, left, y + 2, { fit: [63, 58], align: 'left', valign: 'top' });
    text(`REPALETIZAJE N° ${clean(header.repNumF || header.repNum)}`, left + 75, y + 4, 13, { bold: true });
    text('NOMBRE PLANTA O CENTRO:', left + 75, y + 26, 8, { bold: true });
    text(header.companyName || header.authorizedBy, left + 210, y + 26, 9, { width: 175 });
    text('FECHA:', left + 75, y + 43, 8, { bold: true });
    text(date(header.date), left + 115, y + 43, 9);
    // Keep the values aligned with the date while reserving a wider area to
    // the right for long species and country names.
    const headerValueX = left + 115;
    const headerValueWidth = right - headerValueX - 112;
    text('ESPECIE:', left + 75, y + 60, 8, { bold: true });
    text(speciesName, headerValueX, y + 60, 8, { width: headerValueWidth });
    text('PAIS:', left + 75, y + 77, 8, { bold: true });
    text(header.countryName || '-', headerValueX, y + 77, 8, { width: headerValueWidth });
    const metadataX = right - 102;
    text('Código: F-PA-EA-010', metadataX, y, 7);
    text('Versión: 06', metadataX, y + 12, 7);
    text('Fecha de Vigencia: 02-11-2013', metadataX, y + 24, 7);
    line(left, y + 88, right, y + 88, 0.9);
    y += continuation ? 96 : 104;
  };
  const columns = [
    ['TIPO DE ACTIVIDAD', 113], ['N° DE ACTIVIDAD', 83], ['FOLIO', 76], ['N° DE ENVASES', 89],
    ['FOLIO', 75], ['N° DE ENVASES', 82]
  ];
  const drawTableHeader = () => {
    let x = left;
    const height = 32;
    doc.rect(left, y, width, height).stroke(black);
    columns.forEach(([label, nominal], index) => {
      const w = index === columns.length - 1 ? right - x : nominal;
      text(label, x + 2, y + 8, 6.2, { bold: true, width: w - 4, align: 'center' });
      x += w;
      if (x < right - 0.5) line(x, y, x, y + height);
    });
    y += height;
  };
  const drawRow = (folio) => {
    const rows = movements.filter((row) => clean(row.folio) === clean(folio.folio));
    const activity = Number(folio.actionType) === 1 ? 'REPALETIZAJE' : 'INSPECCION';
    const rowValues = [activity, folio.requestNumber, folio.originalBoxes ? folio.folio : '0', num(folio.originalBoxes), folio.folio, num(folio.discountedBoxes || folio.repalletizedBoxes)];
    const height = 19;
    if (y + height > pageBottom - 110) {
      doc.addPage(); y = 36; headerBlock(true); drawTableHeader();
    }
    let x = left;
    doc.rect(left, y, width, height).stroke(black);
    rowValues.forEach((value, index) => {
      const w = index === columns.length - 1 ? right - x : columns[index][1];
      text(value, x + 2, y + 5, 6.6, { width: w - 4, align: 'center', ellipsis: true });
      x += w;
      if (x < right - 0.5) line(x, y, x, y + height);
    });
    y += height;
    if (!rows.length) return;
  };

  headerBlock();
  drawTableHeader();
  (folios || []).forEach(drawRow);
  if (y + 136 > signatureLineY - 18) {
    doc.addPage();
    y = 36;
    headerBlock(true);
  }
  y += 20;
  line(left, y, right, y, 0.9);
  const originalTotal = (folios || []).reduce((sum, item) => sum + Number(item.originalBoxes || 0), 0);
  const destinationTotal = (folios || []).reduce((sum, item) => sum + Number(item.discountedBoxes || item.repalletizedBoxes || 0), 0);
  const statusY = y + 16;
  text('APROBADO', left + 144, statusY, 8, { bold: true });
  doc.rect(left + 207, statusY - 4, 24, 16).stroke(black);
  text('RECHAZADO', left + 265, statusY, 8, { bold: true });
  doc.rect(left + 352, statusY - 4, 24, 16).stroke(black);
  text('OBSERVACIONES:', left, y + 45, 8, { bold: true });
  doc.rect(left, y + 61, width, 58).stroke(black);
  text('Cajas que pierden Condicion', left + 8, y + 67, 8, { bold: true });
  text(num(Math.max(0, originalTotal - destinationTotal)), left + 120, y + 67, 8);
  line(left + 40, signatureLineY, left + 220, signatureLineY);
  line(right - 220, signatureLineY, right - 40, signatureLineY);
  text(header.authorizedBy, left + 40, signatureLineY - 18, 7, { width: 180, align: 'center' });
  text('NOMBRE Y FIRMA', left + 40, signatureLineY + 7, 7, { bold: true, width: 180, align: 'center' });
  text('CONTRAPARTE PROFESIONAL O', left + 40, signatureLineY + 15, 7, { bold: true, width: 180, align: 'center' });
  text('CONTRAPARTE TECNICA', left + 40, signatureLineY + 23, 7, { bold: true, width: 180, align: 'center' });
  text('NOMBRE, FIRMA Y CARGO', right - 220, signatureLineY + 7, 7, { bold: true, width: 180, align: 'center' });
  text('DE QUIEN RESUELVE', right - 220, signatureLineY + 15, 7, { bold: true, width: 180, align: 'center' });
  const footerTotalsY = signatureLineY + 43;
  text('TOTAL CAJAS ORIGINAL', right - 230, footerTotalsY, 7.5, { bold: true, width: 180, align: 'right' });
  text(num(originalTotal), right - 42, footerTotalsY, 7.5, { bold: true, width: 42, align: 'right' });
  text('TOTAL CAJAS REPALETIZADAS', right - 230, footerTotalsY + 10, 7.5, { bold: true, width: 180, align: 'right' });
  text(num(destinationTotal), right - 42, footerTotalsY + 10, 7.5, { bold: true, width: 42, align: 'right' });
  const pages = doc.bufferedPageRange();
  if (pages.count > 1) {
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(index);
      text(`Página: ${index + 1}`, right - 62, pageBottom + 10, 7);
    }
  }
  doc.end();
});

module.exports = { renderRepaletizajePdf };
