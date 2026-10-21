const PDFDocument = require("pdfkit");

const clean = (value) => String(value ?? "").trim();
const oneLine = (value) => clean(value).replace(/\s+/g, " ");
const number = (value, decimals = 0) =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));

const date = (value) => {
  const raw = clean(value);
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }
  return raw || "-";
};

const renderProcesoUSDAPdf = (data) =>
  new Promise((resolve, reject) => {
    const header = data.header || {};
    const detailRows = Array.isArray(data.details) ? data.details : [];
    const document = new PDFDocument({
      size: "LETTER",
      layout: "portrait",
      margin: 24,
      bufferPages: true,
      info: {
        Title: `Detalle USDA ${clean(header.processNumber)}`,
        Author: clean(header.companyName),
      },
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const colors = {
      ink: "#173326",
      muted: "#526e61",
      line: "#c4d9ca",
      green: "#07512f",
      greenLight: "#e5f1e8",
      greenAccent: "#008040",
      white: "#ffffff",
      tableHeader: "#d7ebdc",
      tableStripe: "#f3f4f4",
    };
    const pageWidth = document.page.width;
    const pageHeight = document.page.height;
    const left = document.page.margins.left;
    const right = pageWidth - document.page.margins.right;
    const contentWidth = right - left;
    const bottom = pageHeight - document.page.margins.bottom;

    const fit = (value, width, font, size) => {
      let result = oneLine(value) || "-";
      document.font(font).fontSize(size);
      if (document.widthOfString(result) <= width) return result;
      while (result.length > 1 && document.widthOfString(`${result}...`) > width) result = result.slice(0, -1);
      return `${result}...`;
    };

    const text = (value, x, y, width, options = {}) => {
      const size = options.size || 7;
      const font = options.bold ? "Helvetica-Bold" : "Helvetica";
      const color = options.color || colors.ink;
      const content = fit(value, width, font, size);
      document.font(font).fontSize(size).fillColor(color).text(content, x, y, {
        width,
        height: options.height || size + 4,
        align: options.align || "left",
        lineBreak: false,
        ellipsis: false,
      });
    };

    const line = (x1, y1, x2, y2, width = 0.5, color = colors.line) => {
      document.strokeColor(color).lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke();
    };

    const metaField = (label, value, x, y, width) => {
      text(label, x, y, width, { size: 6.3, color: colors.muted, bold: true });
      text(value, x, y + 11, width, { size: 8, bold: true });
      line(x, y + 28, x + width, y + 28, 0.55, colors.line);
    };

    const sectionHeading = (label, y) => {
      text(label, left, y, contentWidth, { size: 9.5, color: colors.greenAccent, bold: true });
      line(left, y + 17, right, y + 17, 0.55, colors.line);
    };

    const columns = [
      { label: "Folio", width: 45, key: "folio" },
      {
        label: "Productor",
        width: 54,
        value: (row) => clean(row.producerName),
      },
      { label: "Comuna", width: 60, key: "producerCommune" },
      { label: "Provincia", width: 46, key: "producerProvince" },
      { label: "Packing", width: 58, key: "packingName" },
      { label: "Comuna", width: 38, key: "packingCommune" },
      { label: "Provincia", width: 40, key: "packingProvince" },
      { label: "Especie", width: 44, key: "speciesName" },
      { label: "Variedad", width: 39, key: "varietyName" },
      { label: "Nro Cajas", width: 34, key: "detailBoxes", align: "right" },
      { label: "Cajas\nPallet", width: 32, key: "folioBoxes", align: "right" },
      { label: "Fecha\nEmb.", width: 45, key: "detailDate" },
      { label: "SDP/SAG", width: 45, key: "producerSagCode" },
    ];

    const drawReportHeader = () => {
      const bandY = 22;
      const bandHeight = 48;
      const cardWidth = 104;
      const cardHeight = 34;
      const cardX = right - cardWidth - 8;
      document.roundedRect(left, bandY, contentWidth, bandHeight, 8).fill(colors.green);
      const companySeason = [clean(header.companyName), header.tempCod ? `Temporada ${clean(header.tempCod)}` : ""]
        .filter(Boolean)
        .join(" - ");
      text(companySeason, left + 14, bandY + 6, contentWidth - cardWidth - 38, { size: 6.2, bold: true, color: "#d8eee0" });
      text("DETALLE DEL LOTE POR PALLET", left + 14, bandY + 20, contentWidth - cardWidth - 38, { size: 13.5, bold: true, color: colors.white });
      const rut = [clean(header.companyRut), clean(header.companyDv)].filter(Boolean).join("-");
      text(`${header.companyBusiness || ""}${header.companyAddress ? ` - ${header.companyAddress}` : ""}${rut ? ` - RUT ${rut}` : ""}`, left + 14, bandY + 36, contentWidth - cardWidth - 38, { size: 5.7, color: "#d8eee0" });
      document.roundedRect(cardX, bandY + 7, cardWidth, cardHeight, 7).fillAndStroke("#f4faf5", "#d6eadb");
      text("Numero Inspeccion:", cardX + 7, bandY + 11, cardWidth - 14, { size: 5.2, color: colors.muted, bold: true, align: "center" });
      text(header.processNumber, cardX + 7, bandY + 20, cardWidth - 14, { size: 9.5, color: colors.green, bold: true, align: "center" });

      line(left, bandY + bandHeight + 27, right, bandY + bandHeight + 27, 0.6, colors.line);

      const metaY = bandY + bandHeight + 39;
      const gap = 12;
      const metaWidth = (contentWidth - gap * 2) / 3;
      metaField("Numero Inspeccion:", header.processNumber, left, metaY, metaWidth);
      metaField("Fecha:", date(header.processDate), left + metaWidth + gap, metaY, metaWidth);
      metaField("Estado:", "A Inspeccion", left + (metaWidth + gap) * 2, metaY, metaWidth);
      const tableHeadingY = metaY + 43;
      sectionHeading("Detalle por pallet", tableHeadingY);
      return tableHeadingY + 25;
    };

    const drawTable = (rows, y, rowOffset = 0, rowFills = []) => {
      const tableWidth = contentWidth;
      const nominalWidth = columns.reduce((sum, column) => sum + column.width, 0);
      const scale = tableWidth / nominalWidth;
      const scaled = columns.map((column) => ({ ...column, width: column.width * scale }));
      const headerHeight = 20;
      const rowHeight = 18;
      document.rect(left, y, tableWidth, headerHeight).fillAndStroke(colors.tableHeader, colors.line);
      let x = left;
      scaled.forEach((column) => {
        const labels = column.label.split("\n");
        labels.forEach((label, index) => text(label, x + 3, y + 3 + index * 6.5, column.width - 6, { size: 5.3, bold: true, align: "center" }));
        x += column.width;
        if (x < right - 0.5) line(x, y, x, y + headerHeight, 0.35);
      });

      rows.forEach((row, rowIndex) => {
        const rowY = y + headerHeight + rowIndex * rowHeight;
        document.rect(left, rowY, tableWidth, rowHeight).fillAndStroke(rowFills[rowOffset + rowIndex] || colors.white, colors.line);
        let cellX = left;
        scaled.forEach((column) => {
          const raw = typeof column.value === "function" ? column.value(row, rowIndex) : row[column.key];
          const value = column.key === "detailBoxes" || column.key === "folioBoxes" ? number(raw) : column.key === "detailDate" ? date(raw) : raw;
          text(value, cellX + 3, rowY + 5, column.width - 6, { size: 5.3, align: "center" });
          cellX += column.width;
          if (cellX < right - 0.5) line(cellX, rowY, cellX, rowY + rowHeight, 0.3);
        });
      });
      return y + headerHeight + rows.length * rowHeight;
    };

    const fallbackRows = (data.folios || []).map((folio) => ({
      folio: folio.folio,
      speciesName: folio.speciesName,
      folioBoxes: folio.boxes,
      detailBoxes: folio.boxes,
    }));
    const rows = detailRows.length ? detailRows : fallbackRows;
    const rowFills = [];
    let folioGroup = -1;
    let previousFolio = null;
    rows.forEach((row) => {
      const currentFolio = clean(row.folio);
      if (currentFolio !== previousFolio) folioGroup += 1;
      rowFills.push(folioGroup % 2 ? colors.tableStripe : colors.white);
      previousFolio = currentFolio;
    });
    const tableScale = contentWidth / columns.reduce((sum, column) => sum + column.width, 0);
    const boxesColumnIndex = columns.findIndex((column) => column.key === "detailBoxes");
    const boxesColumnX = left + columns
      .slice(0, boxesColumnIndex)
      .reduce((sum, column) => sum + column.width * tableScale, 0);
    const boxesColumnWidth = columns[boxesColumnIndex].width * tableScale;
    const rowsPerPage = 27;
    let offset = 0;
    do {
      const tableY = drawReportHeader();
      const pageRows = rows.slice(offset, offset + rowsPerPage);
      const tableBottom = drawTable(pageRows, tableY, offset, rowFills);
      const totalY = Math.min(tableBottom, bottom - 18);
      const totalRowHeight = 18;
      document.rect(left, totalY, contentWidth, totalRowHeight).fillAndStroke(colors.greenLight, colors.line);
      text("Total Folios:", left + 10, totalY + 5, 62, { size: 7, bold: true, color: colors.green });
      text(number(header.totalFolios), left + 68, totalY + 4, 40, { size: 8, bold: true, color: colors.green });
      text("Total Cajas:", boxesColumnX - 74, totalY + 5, 68, { size: 7, bold: true, color: colors.green, align: "right" });
      text(number(header.totalBoxes), boxesColumnX, totalY + 4, boxesColumnWidth, { size: 8, bold: true, color: colors.green, align: "center" });
      offset += pageRows.length;
      if (offset < rows.length) document.addPage({ size: "LETTER", layout: "portrait", margin: 24 });
    } while (offset < rows.length || offset === 0);

    const pages = document.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      document.switchToPage(index);
      text(`Página ${index + 1} de ${pages.count}`, right - 100, bottom + 6, 100, { size: 6.5, color: colors.muted, align: "right" });
    }
    document.end();
  });

module.exports = { renderProcesoUSDAPdf };
