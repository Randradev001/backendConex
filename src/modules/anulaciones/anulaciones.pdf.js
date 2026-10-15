const path = require('path');
const PDFDocument = require('pdfkit');

const clean = (value) => String(value ?? '').trim();
const date = (value) => {
  const text = clean(value).slice(0, 10);
  const [year, month, day] = text.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '-';
};

const reportTitle = 'ANULACIÓN DE PRODUCTOS APROBADOS Y DEVOLUCIÓN DE CERTIFICADOS DE INSPECCIÓN / TRATAMIENTO';
const sagLogoPath = path.join(__dirname, '../../img/sag-logo.png');

const renderAnulacionPdf = ({ header, details }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'LETTER', margin: 36, bufferPages: true, info: { Title: 'AnuFolios14' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));

  // The XPZ report is monochrome: white paper, black text and black rules.
  const black = '#000000';
  const white = '#ffffff';
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const pageTop = 28;
  const pageBottom = doc.page.height - 34;
  const signatureTop = pageBottom - 112;
  const rowHeight = 18;
  const tableHeaderHeight = 31;
  // Column boundaries follow the AnuFolios14 XPZ layout.
  const columns = [
    ['TIPO DE ACTIVIDAD', 113 / 767],
    ['N° ACTIVIDAD', 83 / 767],
    ['FOLIO', 84 / 767],
    ['ESPECIE', 84 / 767],
    ['CONDICION', 64 / 767],
    ['PRODUCTO', 65 / 767],
    ['CANTIDAD\nENVASES', 68 / 767],
    ['TIPO\nENVASES', 92 / 767],
    ['CAUSAL\nANULACION', 114 / 767]
  ];
  let y = pageTop;

  const drawFrame = () => {
    doc.fillColor(white).rect(left - 5, pageTop - 4, width + 10, pageBottom - pageTop + 8).fill();
  };

  const drawLogo = () => {
    const logoX = left + 4;
    const logoY = y + 3;
    doc.image(sagLogoPath, logoX, logoY, { fit: [58, 54], align: 'left', valign: 'top' });
  };

  const drawHeader = (continuation = false) => {
    drawFrame();
    drawLogo();
    const metadataX = left + width - 150;
    doc.fillColor(black).font('Helvetica').fontSize(7.5);
    doc.text('Código: F-PA-EA-011', metadataX, y + 4, { width: 145, lineBreak: false });
    doc.text('Versión: 08', metadataX, y + 18, { width: 145, lineBreak: false });
    doc.text('Fecha de Vigencia: 02-11-2013', metadataX, y + 32, { width: 145, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8.6).text(reportTitle, left + 2, y + 68, { width: width - 4, align: 'center', lineBreak: false, underline: true });

    if (continuation) {
      y += 88;
      return;
    }

    const label = (text, x, top, labelWidth) => doc.fillColor(black).font('Helvetica-Bold').fontSize(8).text(text, x, top, { width: labelWidth, lineBreak: false });
    const value = (text, x, top, valueWidth, align = 'left') => doc.fillColor(black).font('Helvetica').fontSize(8.5).text(clean(text) || '-', x, top, { width: valueWidth, align, lineBreak: false });
    const infoY = y + 96;
    label('N° INFORME', left + 42, infoY, 150);
    value(header.folio, left + 195, infoY - 1, 74);
    label('NOMBRE ESTABLECIMIENTO', left + 42, infoY + 20, 150);
    value(header.companyName, left + 195, infoY + 19, 255);
    label('FECHA ENTREGA', left + 365, infoY + 20, 92);
    value(date(header.date), left + 455, infoY + 19, 80);
    label('CANTIDAD DE CERTIFICADOS', left + 42, infoY + 51, 150);
    value(header.totalFolios ?? details.length, left + 195, infoY + 50, 74);
    label('QUE ANULA O DEVUELVE', left + 55, infoY + 68, 170);
    y = infoY + 91;
  };

  const drawTableHeader = () => {
    let x = left;
    doc.fillColor(white).strokeColor(black).lineWidth(0.8).rect(left, y, width, tableHeaderHeight).fillAndStroke();
    doc.fillColor(black).font('Helvetica-Bold').fontSize(7.1);
    columns.forEach(([title, ratio]) => {
      const columnWidth = width * ratio;
      doc.text(title, x + 2, y + 5, { width: columnWidth - 4, height: tableHeaderHeight - 7, align: 'center', lineGap: 0 });
      x += columnWidth;
      if (x < left + width - 0.5) doc.moveTo(x, y).lineTo(x, y + tableHeaderHeight).stroke();
    });
    y += tableHeaderHeight;
  };

  const drawDetailRow = (row) => {
    let x = left;
    const values = [row.activityType || 'INSPECCION', row.requestNumber, row.folio, row.speciesName, 'FRESCO', 'FRUTA', row.boxes, 'CAJAS', header.causeName];
    doc.fillColor(white).strokeColor(black).lineWidth(0.55).rect(left, y, width, rowHeight).fillAndStroke();
    doc.fillColor(black).font('Helvetica').fontSize(7.5);
    values.forEach((item, index) => {
      const columnWidth = width * columns[index][1];
      doc.text(clean(item) || '-', x + 3, y + 5, { width: columnWidth - 6, height: rowHeight - 5, ellipsis: true, lineGap: 0 });
      x += columnWidth;
      if (x < left + width - 0.5) doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
    });
    y += rowHeight;
  };

  const drawObservation = () => {
    const separatorY = y + 8;
    const boxY = separatorY + 36;
    const boxHeight = 88;
    doc.strokeColor(black).lineWidth(0.7).moveTo(left, separatorY).lineTo(left + width, separatorY).stroke();
    doc.fillColor(black).font('Helvetica-Bold').fontSize(8.5).text('OBSERVACIONES:', left + 4, separatorY + 21, { width: width - 8, lineBreak: false });
    doc.strokeColor(black).lineWidth(0.7).rect(left + 3, boxY, width - 6, boxHeight).stroke();
    doc.fillColor(black).font('Helvetica').fontSize(8).text(clean(header.observation) || '-', left + 11, boxY + 9, { width: width - 22, height: boxHeight - 18, ellipsis: true });
    y = boxY + boxHeight;
  };

  const drawSignatures = () => {
    const lineY = signatureTop + 25;
    // Dos columnas de igual ancho, centradas dentro del pie de página.
    const signatureWidth = 190;
    const signatureGap = 48;
    const groupWidth = signatureWidth * 2 + signatureGap;
    const groupX = left + (width - groupWidth) / 2;
    const leftX = groupX;
    const leftWidth = signatureWidth;
    const rightX = groupX + signatureWidth + signatureGap;
    const rightWidth = signatureWidth;
    doc.fillColor(black).font('Helvetica').fontSize(8).text(clean(header.authorizedBy) || '-', leftX, lineY - 17, { width: leftWidth, align: 'center', lineBreak: false });
    doc.strokeColor(black).lineWidth(0.8).moveTo(leftX, lineY).lineTo(leftX + leftWidth, lineY).stroke();
    doc.moveTo(rightX, lineY).lineTo(rightX + rightWidth, lineY).stroke();
    doc.fillColor(black).font('Helvetica-Bold').fontSize(7.2).text('NOMBRE Y FIRMA CONTRAPARTE PROFESIONAL', leftX, lineY + 8, { width: leftWidth, align: 'center', lineBreak: false });
    doc.text('O CONTRAPARTE TECNICA', leftX, lineY + 20, { width: leftWidth, align: 'center', lineBreak: false });
    doc.text('NOMBRE, CARGO Y FIRMA', rightX, lineY + 8, { width: rightWidth, align: 'center', lineBreak: false });
    doc.text('DE QUIEN RECIBE', rightX, lineY + 20, { width: rightWidth, align: 'center', lineBreak: false });
  };

  const drawPageNumbers = () => {
    const pages = doc.bufferedPageRange();
    if (pages.count <= 1) return;
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(index);
      doc.fillColor(black).font('Helvetica').fontSize(7).text(`Página: ${index + 1}`, left + width - 80, pageTop + 46, { width: 75, align: 'left', lineBreak: false });
    }
  };

  drawHeader();
  drawTableHeader();
  details.forEach((row) => {
    if (y + rowHeight > signatureTop - 12) {
      doc.addPage();
      y = pageTop;
      drawHeader(true);
      drawTableHeader();
    }
    drawDetailRow(row);
  });
  if (y + 150 > pageBottom) {
    doc.addPage();
    y = pageTop;
    drawHeader(true);
    y += 12;
  }
  drawObservation();
  drawSignatures();
  drawPageNumbers();
  doc.end();
});

module.exports = { renderAnulacionPdf };
