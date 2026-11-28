const PDFDocument = require('pdfkit');

const clean = (value) => String(value ?? '').trim();
const number = (value) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => {
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : clean(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso || '-';
};
const rut = (body, dv) => body ? `${number(body)}-${clean(dv)}` : '-';
const compare = (a, b) => clean(a).localeCompare(clean(b), 'es', { numeric: true });

function buildPackingReport({ header, details, tempCod, report }) {
  const species = new Map();
  const ordered = [...details].sort((a, b) => compare(a.speciesCode, b.speciesCode) || compare(a.folio, b.folio) || compare(a.correlation, b.correlation));
  for (const row of ordered) {
    const key = clean(row.speciesCode);
    if (!species.has(key)) species.set(key, { code: row.speciesCode, name: row.speciesName || key, rows: [], boxes: 0, folios: new Set(), varieties: new Map() });
    const group = species.get(key);
    const boxes = Number(row.boxes || 0);
    group.rows.push(row);
    group.boxes += boxes;
    group.folios.add(clean(row.folio));
    const varietyKey = clean(row.varietyCode);
    if (!group.varieties.has(varietyKey)) group.varieties.set(varietyKey, { code: row.varietyCode, name: row.varietyName || varietyKey, boxes: 0, groups: new Map() });
    const variety = group.varieties.get(varietyKey);
    variety.boxes += boxes;
    // GX agrupa por códigos, aunque dos catálogos compartan el mismo nombre.
    const summaryKey = JSON.stringify([row.containerCode, row.categoryCode, clean(row.caliber)]);
    if (!variety.groups.has(summaryKey)) variety.groups.set(summaryKey, { ...row, boxes: 0 });
    variety.groups.get(summaryKey).boxes += boxes;
  }
  const groups = [...species.values()].map((group) => ({
    code: group.code, name: group.name, rows: group.rows, boxes: group.boxes, pallets: group.folios.size,
    varieties: [...group.varieties.values()].sort((a, b) => compare(a.code, b.code)).map((variety) => ({
      code: variety.code, name: variety.name, boxes: variety.boxes,
      rows: [...variety.groups.values()].sort((a, b) => compare(a.containerCode, b.containerCode) || compare(a.categoryCode, b.categoryCode) || compare(a.caliber, b.caliber))
    }))
  }));
  // Packing01 cuenta cada folio dentro de su especie, incluso si aparece en otra especie.
  return { header, tempCod, report, groups, totals: groups.reduce((total, group) => ({ boxes: total.boxes + group.boxes, pallets: total.pallets + group.pallets }), { boxes: 0, pallets: 0 }) };
}

function renderPackingPdf(data) {
  return new Promise((resolve, reject) => {
    const detailed = data.report === 'packing01';
    const h = data.header;
    const doc = new PDFDocument({ size: 'LETTER', layout: detailed ? 'landscape' : 'portrait', margin: 28, bufferPages: true,
      info: { Title: `${detailed ? 'Packing List' : 'Resumen Packing List'} ${h.PackNumI}`, Author: clean(h.companyName) || 'CONEX' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const left = 28;
    const width = doc.page.width - 56;
    const bottom = doc.page.height - 50;
    const green = '#176047';
    const ink = '#243830';
    const muted = '#52675e';
    const printed = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    const cols = detailed
      ? [['Folio', 72], ['Fec. proc.', 57], ['Cajas', 43], ['Especie', 77], ['Variedad', 86], ['Envase', 92], ['Categoría', 74], ['Calibre', 49], ['Productor', width - 550]]
      : [['Especie', 95], ['Variedad', 103], ['Envase', 124], ['Categoría', 96], ['Calibre', 64], ['Total cajas', width - 482]];
    let y = 28;
    const font = (bold, size) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    const text = (value, x, top, w, { bold = false, size = 8, color = ink, align = 'left' } = {}) => {
      font(bold, size).fillColor(color).text(clean(value) || '-', x, top, { width: w, align, lineGap: 1 });
    };
    const height = (value, w, size = 8, bold = false) => font(bold, size).heightOfString(clean(value) || '-', { width: w, lineGap: 1 });
    function tableHeader() {
      doc.rect(left, y, width, 24).fill(green);
      let x = left;
      cols.forEach(([label, w]) => { text(label, x + 5, y + 7, w - 10, { bold: true, size: 8, color: '#ffffff' }); x += w; });
      y += 24;
    }
    function heading(first) {
      y = 28;
      const companyWidth = width * 0.57;
      text(h.companyName || 'CONEX', left, y, companyWidth, { bold: true, size: 12, color: green });
      const title = detailed ? 'Packing List' : 'Resumen Packing List';
      text(title, left + companyWidth + 10, y, width - companyWidth - 10, { bold: true, size: 14, align: 'right', color: green });
      y += Math.max(height(h.companyName || 'CONEX', companyWidth, 12, true), height(title, width - companyWidth - 10, 14, true)) + 6;
      if (first) {
        for (const value of [h.companyActivity, h.companyAddress, `RUT: ${rut(h.companyRut, h.companyDv)}`]) {
          text(value, left, y, width, { size: 8, color: muted });
          y += height(value, width) + 3;
        }
      }
      text(`Packing N° ${h.PackNumI}  |  Temporada ${data.tempCod}  |  Planilla N° ${h.PackNumG}`, left, y, width, { bold: true, size: 9 });
      y += 20;
      if (first && detailed) {
        const fields = [
          [['N° Planilla S.A.G.', h.PackNumG], ['Motonave', h.PackNave], ['Chofer', h.PackChofer]],
          [['N° Guía', h.PackGuia], ['País destino', h.destinationName], ['RUT chofer', h.PackRutChofer]],
          [['Fecha packing', date(h.PackFecha)], ['Puerto destino', h.destinationPortName], ['Camión', h.PackTipCamion]],
          [['Hora salida', h.PackHora], ['Agente', h.agentName], ['Patente', h.PackPatente]],
          [['Despachador', h.dispatcherName], ['RUT agente', rut(h.agentRut, h.agentDv)], ['N° Contenedor', h.PAckNContenedor]],
          [['Fecha embarque', date(h.PackFecZar)], ['N° Termógrafo', h.PackNTermografo], ['N° Pallets', h.PackNumPalTer1]],
          [['Puerto embarque', h.originPortName], ['N° Termógrafo 2', h.Packntermograf2], ['N° Pallets 2', h.PackNumPalTer2]],
          [['Exportador', h.exporterName], ['RUT exportador', rut(h.exporterRut, h.exporterDv)], ['Consignatario', h.consigneeName]]
        ];
        for (const row of fields) {
          const values = row.map(([label, value]) => `${label}: ${clean(value) || '-'}`);
          const rowHeight = Math.max(...values.map((value) => height(value, width / 3 - 12))) + 7;
          values.forEach((value, i) => text(value, left + i * width / 3, y, width / 3 - 12));
          y += rowHeight;
        }
        y += 8;
      } else if (first) {
        text(`N° Guía: ${h.PackGuia || '-'}     N° Planilla: ${h.PackNumG}     Fecha: ${date(h.PackFecha)}`, left, y, width, { size: 9 });
        y += 26;
      }
      tableHeader();
    }
    function ensure(space) {
      if (y + space > bottom) { doc.addPage(); heading(false); }
    }
    function row(values, shaded = false) {
      const rowHeight = Math.max(20, ...values.map((value, i) => height(value, cols[i][1] - 10) + 10));
      ensure(rowHeight);
      if (shaded) doc.rect(left, y, width, rowHeight).fill('#f3f7f4');
      let x = left;
      values.forEach((value, i) => {
        text(value, x + 5, y + 5, cols[i][1] - 10, { align: (detailed ? i === 2 : i === 5) ? 'right' : 'left' });
        x += cols[i][1];
      });
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).lineWidth(0.3).strokeColor('#d9e4dd').stroke();
      y += rowHeight;
    }
    function total(label, boxes, pallets, strong = false) {
      const value = `${number(boxes)} cajas${pallets === undefined ? '' : `   |   ${number(pallets)} pallets`}`;
      const valueWidth = detailed ? 190 : 100;
      const labelWidth = width - valueWidth - 28;
      const rowHeight = Math.max(27, height(label, labelWidth, 9, true) + 12);
      ensure(rowHeight);
      doc.rect(left, y, width, rowHeight).fill(strong ? green : '#e7f0e9');
      const color = strong ? '#ffffff' : green;
      text(label, left + 8, y + 7, labelWidth, { bold: true, size: 9, color });
      text(value, left + width - valueWidth - 8, y + 7, valueWidth, { bold: true, size: 9, align: 'right', color });
      y += rowHeight + 5;
    }
    heading(true);
    let index = 0;
    for (const species of data.groups) {
      if (detailed) {
        species.rows.forEach((r, i) => {
          if (i === species.rows.length - 1) ensure(Math.max(20, ...[r.folio, date(r.processDate), number(r.boxes), r.speciesName, r.varietyName, r.containerName, r.categoryName, r.caliber, r.producerName].map((v, j) => height(v, cols[j][1] - 10) + 10)) + 40);
          row([r.folio, date(r.processDate), number(r.boxes), r.speciesName, r.varietyName, r.containerName, r.categoryName, r.caliber, r.producerName], index++ % 2 === 1);
        });
        total(`Total especie: ${species.name}`, species.boxes, species.pallets);
      } else {
        for (const variety of species.varieties) {
          variety.rows.forEach((r) => row([r.speciesName, r.varietyName, r.containerName, r.categoryName, r.caliber, number(r.boxes)], index++ % 2 === 1));
          total(`Total variedad: ${variety.name}`, variety.boxes);
        }
        total(`Total especie: ${species.name}`, species.boxes);
      }
    }
    if (!detailed || data.groups.length > 1) total('Total general', data.totals.boxes, detailed ? data.totals.pallets : undefined, true);
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      text(`${detailed ? 'Packing01' : 'Packing02'}  |  Impresión: ${printed}`, left, doc.page.height - 38, width - 90, { size: 7, color: muted });
      text(`Página ${i + 1} de ${range.count}`, left + width - 85, doc.page.height - 38, 85, { size: 7, align: 'right', color: muted });
    }
    doc.end();
  });
}

module.exports = { buildPackingReport, renderPackingPdf };
