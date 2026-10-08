const PDFDocument = require("pdfkit");

const clean = (value) => String(value ?? "").trim();
const number = (value, decimals = 0) =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));
const date = (value) => {
  const raw = clean(value);
  const iso = raw.slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
  return "-";
};
const valueOf = (row, ...keys) => {
  for (const key of keys) {
    if (row && row[key] !== null && row[key] !== undefined) return row[key];
  }
  return "";
};

const renderLegacySolicitudPdf = (data) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "LETTER",
      margin: 36,
      bufferPages: true,
      info: {
        Title: `Solicitud de inspección ${valueOf(data.header, "SolnumI", "requestNumber")}`,
        Author: clean(data.header?.companyName) || "CONEX",
      },
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const green = "#176B3A";
    const greenDark = "#0B4A2A";
    const pale = "#EAF5EE";
    const paleStrong = "#D8ECDD";
    const ink = "#172033";
    const muted = "#607080";
    const border = "#C9D8CF";
    const warning = "#A56200";
    const error = "#B42318";
    const width = document.page.width - document.page.margins.left - document.page.margins.right;
    const left = document.page.margins.left;
    const bottom = () => document.page.height - 52;
    let y = document.page.margins.top;

    const status = clean(valueOf(data.header, "statusLabel")) || "Sin estado";
    const statusNumber = Number(valueOf(data.header, "status", "SolEstado"));
    const statusColor = statusNumber === 1 ? green : statusNumber === 2 ? error : statusNumber === 0 ? warning : muted;
    const requestNumber = valueOf(data.header, "SolnumI", "requestNumber", "SolNum");
    const printableNumber = /^\d+$/.test(clean(requestNumber))
      ? clean(requestNumber).padStart(10, "0")
      : clean(requestNumber) || "-";
    const company = clean(data.header?.companyName) || "Empresa no configurada";
    const season = clean(data.header?.tempCod) || "Temporada activa";

    const addPageIfNeeded = (height) => {
      if (y + height <= bottom()) return;
      document.addPage();
      y = document.page.margins.top;
    };
    const sectionTitle = (title) => {
      addPageIfNeeded(24);
      document.font("Helvetica-Bold").fontSize(11).fillColor(green).text(title, left, y);
      y += 18;
    };
    const labelValue = (label, value, x, top, fieldWidth) => {
      document.font("Helvetica-Bold").fontSize(7).fillColor(muted).text(label.toUpperCase(), x, top, {
        width: fieldWidth,
        lineBreak: false,
      });
      document.font("Helvetica").fontSize(9.5).fillColor(ink).text(clean(value) || "-", x, top + 11, {
        width: fieldWidth,
        ellipsis: true,
        lineBreak: false,
      });
    };
    const drawCell = (text, x, top, cellWidth, cellHeight, options = {}) => {
      document
        .font(options.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(options.fontSize || 8)
        .fillColor(options.color || ink)
        .text(clean(text) || "-", x + 4, top + (cellHeight - (options.fontSize || 8)) / 2 - 1, {
          width: cellWidth - 8,
          align: options.align || "left",
          ellipsis: true,
          lineBreak: false,
        });
    };
    const drawTable = (title, rows, columns, mapRow) => {
      addPageIfNeeded(18 + 22 + 23);
      sectionTitle(title);
      const headerHeight = 22;
      const rowHeight = 23;
      const drawHeader = () => {
        document.rect(left, y, width, headerHeight).fill(paleStrong);
        let x = left;
        columns.forEach((column) => {
          drawCell(column.label, x, y, column.width, headerHeight, {
            bold: true,
            fontSize: 7,
            color: greenDark,
            align: column.align,
          });
          x += column.width;
        });
        y += headerHeight;
      };
      drawHeader();
      if (!rows.length) {
        document.roundedRect(left, y, width, rowHeight, 3).lineWidth(0.5).strokeColor(border).stroke();
        drawCell("Sin registros", left, y, width, rowHeight, { color: muted });
        y += rowHeight + 8;
        return;
      }
      rows.forEach((row, index) => {
        if (y + rowHeight > bottom()) {
          document.addPage();
          y = document.page.margins.top;
          drawHeader();
        }
        if (index % 2 === 0) document.rect(left, y, width, rowHeight).fill("#FBFDFC");
        document.rect(left, y, width, rowHeight).lineWidth(0.35).strokeColor(border).stroke();
        let x = left;
        const values = mapRow(row);
        columns.forEach((column, valueIndex) => {
          drawCell(values[valueIndex], x, y, column.width, rowHeight, {
            fontSize: column.fontSize,
            align: column.align,
          });
          x += column.width;
        });
        y += rowHeight;
      });
      y += 10;
    };

    document.roundedRect(left, y, width, 86, 8).fill(greenDark);
    document.font("Helvetica-Bold").fontSize(9).fillColor("#CDEBD5").text(company.toUpperCase(), left + 18, y + 13, {
      width: width - 170,
      ellipsis: true,
    });
    document.font("Helvetica-Bold").fontSize(19).fillColor("#FFFFFF").text("SOLICITUD DE INSPECCIÓN", left + 18, y + 31);
    document.font("Helvetica").fontSize(8.5).fillColor("#D8F0E0").text(`Temporada ${season}`, left + 18, y + 62);
    document.roundedRect(left + width - 128, y + 18, 110, 50, 7).fill("#F1F8E9");
    document.font("Helvetica-Bold").fontSize(7).fillColor(green).text("N° SOLICITUD", left + width - 120, y + 26, { width: 94, align: "center" });
    document.font("Helvetica-Bold");
    let requestNumberSize = 17;
    while (requestNumberSize > 10) {
      document.fontSize(requestNumberSize);
      if (document.widthOfString(printableNumber) <= 94) break;
      requestNumberSize -= 1;
    }
    document.fontSize(requestNumberSize).fillColor(greenDark).text(printableNumber, left + width - 120, y + 40, {
      width: 94,
      align: "center",
      lineBreak: false,
    });
    y += 103;

    sectionTitle("Datos de la solicitud");
    const informationHeight = 118;
    addPageIfNeeded(informationHeight);
    document.roundedRect(left, y, width, informationHeight, 6).fill(pale);
    const col = width / 3;
    const header = data.header || {};
    labelValue("Estado", status, left + 14, y + 13, col - 24);
    labelValue("Fecha", date(valueOf(header, "requestDate", "Solfecha")), left + col, y + 13, col - 24);
    labelValue("Especie", `${valueOf(header, "speciesCode", "solespe") || ""} · ${valueOf(header, "speciesName")}`, left + col * 2, y + 13, col - 24);
    labelValue("Destino", `${valueOf(header, "destinationCode", "SolDest") || ""} · ${valueOf(header, "destinationName")}`, left + 14, y + 53, col - 24);
    labelValue("Solicitante", valueOf(header, "applicant", "SolSolicita"), left + col, y + 53, col - 24);
    labelValue("Destinos aprobados", valueOf(header, "approvedDestinations", "solDestinos"), left + col * 2, y + 53, col - 24);
    document.roundedRect(left + 14, y + 91, 62, 14, 7).fill(statusColor);
    document.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF").text(status, left + 14, y + 95, { width: 62, align: "center", lineBreak: false });
    y += informationHeight + 17;

    const summary = [
      ["FOLIOS", data.folios?.length || 0],
      ["CAJAS", valueOf(header, "totalBoxes", "soltotcajas")],
      ["KILOS", valueOf(header, "totalKilos", "soltotkilos")],
    ];
    addPageIfNeeded(65);
    const summaryWidth = (width - 16) / 3;
    summary.forEach(([label, value], index) => {
      const x = left + index * (summaryWidth + 8);
      document.roundedRect(x, y, summaryWidth, 55, 5).fill(index === 0 ? greenDark : paleStrong);
      document.font("Helvetica-Bold").fontSize(7).fillColor(index === 0 ? "#CDEBD5" : muted).text(label, x + 10, y + 10);
      document.font("Helvetica-Bold").fontSize(17).fillColor(index === 0 ? "#FFFFFF" : greenDark).text(number(value), x + 10, y + 26);
    });
    y += 72;

    const folioColumns = [
      { label: "Folio", width: 116, fontSize: 8 },
      { label: "Especie", width: 164, fontSize: 8 },
      { label: "Cajas", width: 70, align: "right", fontSize: 8 },
      { label: "Kilos", width: 76, align: "right", fontSize: 8 },
      { label: "Despachado", width: width - 426, align: "center", fontSize: 8 },
    ];
    // Con más de 14 folios se separan las tablas para que ninguna página mezcle
    // el resumen de folios con sus líneas de detalle.
    const separateFolioPages = (data.folios || []).length > 14;
    if (separateFolioPages) {
      document.addPage();
      y = document.page.margins.top;
      drawTable("Folios resumidos", data.folios || [], folioColumns, (row) => [
        valueOf(row, "folio", "Sol2Folio"),
        valueOf(row, "speciesName"),
        number(valueOf(row, "totalBoxes", "Sol2Cajas")),
        number(valueOf(row, "totalKilos", "Sol2Kilos")),
        Number(valueOf(row, "dispatched", "Sol2Dispo")) ? "Sí" : "No",
      ]);
    } else {
      drawTable("Folios resumidos", data.folios || [], folioColumns, (row) => [
        valueOf(row, "folio", "Sol2Folio"),
        valueOf(row, "speciesName"),
        number(valueOf(row, "totalBoxes", "Sol2Cajas")),
        number(valueOf(row, "totalKilos", "Sol2Kilos")),
        Number(valueOf(row, "dispatched", "Sol2Dispo")) ? "Sí" : "No",
      ]);
    }

    const includeOrchard = Number(data.swCuartel) === 1;
    const detailColumns = includeOrchard
      ? [
          { label: "Folio", width: 58 },
          { label: "Fecha", width: 55 },
          { label: "Productor", width: 70 },
          { label: "Variedad", width: 57 },
          { label: "Envase", width: 50 },
          { label: "Categoría", width: 58 },
          { label: "Calibre", width: 43 },
          { label: "Cajas", width: 41, align: "right" },
          { label: "Kilos", width: 45, align: "right" },
          { label: "Cuartel", width: 46, align: "right" },
        ]
      : [
          { label: "Folio", width: 64 },
          { label: "Fecha", width: 65 },
          { label: "Productor", width: 78 },
          { label: "Variedad", width: 64 },
          { label: "Envase", width: 55 },
          { label: "Categoría", width: 65 },
          { label: "Calibre", width: 48 },
          { label: "Cajas", width: 42, align: "right" },
          { label: "Kilos", width: 42, align: "right" },
        ];
    if (separateFolioPages) {
      document.addPage();
      y = document.page.margins.top;
    }
    drawTable("Detalle de folios", data.details || [], detailColumns, (row) => {
      const values = [
        valueOf(row, "folio", "Sol2Folio"),
        date(valueOf(row, "movementDate", "sol3fecha")),
        valueOf(row, "producerName"),
        valueOf(row, "varietyName"),
        valueOf(row, "containerName"),
        valueOf(row, "categoryName"),
        valueOf(row, "caliber", "Sol3Cal"),
        number(valueOf(row, "boxes", "Sol3Cajas")),
        number(valueOf(row, "kilos", "Sol3Kilos"), 2),
      ];
      if (includeOrchard) values.push(valueOf(row, "orchard", "Sol3Cuar") || "0");
      return values;
    });

    const pages = document.bufferedPageRange();
    for (let page = 0; page < pages.count; page += 1) {
      document.switchToPage(page);
      document.page.margins.bottom = 0;
      const footerY = document.page.height - 25;
      document.font("Helvetica").fontSize(7).fillColor(muted).text(`${company} · Solicitud ${printableNumber}`, left, footerY, {
        width: width - 110,
        lineBreak: false,
        ellipsis: true,
      });
      document.font("Helvetica-Bold").fontSize(7).fillColor(muted).text(`Página ${page + 1} de ${pages.count}`, left, footerY, {
        width,
        align: "right",
        lineBreak: false,
      });
    }
    document.end();
  });

const reportValue = (data, headerKey, fallback = "") => {
  const header = data?.header || {};
  return valueOf(header, headerKey) || fallback;
};

const printableRequestNumber = (data) => {
  const raw = clean(reportValue(data, "SolnumI", reportValue(data, "requestNumber", reportValue(data, "SolNum"))));
  return /^\d+$/.test(raw) ? raw.padStart(10, "0") : raw || "-";
};

const reportCompany = (data) => clean(reportValue(data, "companyName")) || "CONEX";

const reportRows = (data, includeOrchard) => {
  const rows = data?.details || [];
  const groups = new Map();
  rows.forEach((row) => {
    const key = [
      clean(valueOf(row, "producerSagCode", "producerCode")),
      clean(valueOf(row, "producerName")),
      includeOrchard ? clean(valueOf(row, "orchardName", "orchard")) : "",
    ].join("|");
    const current = groups.get(key) || {
      producerSagCode: valueOf(row, "producerSagCode", "producerCode"),
      producerName: valueOf(row, "producerName"),
      orchardName: valueOf(row, "orchardName", "orchard"),
      reservedSagPalletSample: valueOf(row, "reservedSagPalletSample", "reservedPalletSample", "palletSample", "psSolCaja", "PSSolCaja"),
      boxes: 0,
      pallets: 0,
      speciesName: valueOf(row, "speciesName"),
    };
    current.boxes += Number(valueOf(row, "boxes", "Sol3Cajas")) || 0;
    current.pallets += 1;
    groups.set(key, current);
  });
  return [...groups.values()];
};

const addFolioTotals = (rows) => {
  const counts = new Map();
  const totals = new Map();
  rows.forEach((row) => {
    const folio = clean(valueOf(row, "folio", "Sol2Folio"));
    if (!folio) return;
    counts.set(folio, (counts.get(folio) || 0) + 1);
    const current = totals.get(folio) || { boxes: 0, kilos: 0 };
    current.boxes += Number(valueOf(row, "boxes", "Sol3Cajas")) || 0;
    current.kilos += Number(valueOf(row, "kilos", "Sol3Kilos")) || 0;
    totals.set(folio, current);
  });

  const seen = new Map();
  return rows.flatMap((row) => {
    const folio = clean(valueOf(row, "folio", "Sol2Folio"));
    if (!folio || counts.get(folio) <= 1) return [row];
    const occurrence = (seen.get(folio) || 0) + 1;
    seen.set(folio, occurrence);
    if (occurrence < counts.get(folio)) return [row];
    const total = totals.get(folio);
    return [
      row,
      {
        __totals: true,
        __folioTotals: true,
        folio,
        boxes: total.boxes,
        kilos: total.kilos,
      },
    ];
  });
};

const createReportDocument = ({ title, author, landscape = false }) =>
  new PDFDocument({
    size: "LETTER",
    layout: landscape ? "landscape" : "portrait",
    margin: 36,
    bufferPages: true,
    info: { Title: title, Author: author },
  });

const finishReportDocument = (document, company, requestNumber) => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    const pages = document.bufferedPageRange();
    const left = document.page.margins.left;
    const width = document.page.width - document.page.margins.left - document.page.margins.right;
    for (let page = 0; page < pages.count; page += 1) {
      document.switchToPage(page);
      document.page.margins.bottom = 0;
      const footerY = document.page.height - 25;
      document.font("Helvetica").fontSize(7).fillColor("#607080").text(`${company} · ${requestNumber}`, left, footerY, {
        width: width - 110,
        lineBreak: false,
        ellipsis: true,
      });
      document.font("Helvetica-Bold").fontSize(7).fillColor("#607080").text(`Página ${page + 1} de ${pages.count}`, left, footerY, {
        width,
        align: "right",
        lineBreak: false,
      });
    }
    document.end();
  });
};

const drawReportHeader = (document, data, subtitle) => {
  const left = document.page.margins.left;
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  const green = "#0B4A2A";
  const pale = "#EAF5EE";
  const request = printableRequestNumber(data);
  const company = reportCompany(data);
  const season = clean(reportValue(data, "tempCod")) || "-";
  const bannerTop = document.page.margins.top;
  const bannerHeight = 50;
  document.roundedRect(left, bannerTop, width, bannerHeight, 8).fill(green);
  document.font("Helvetica-Bold").fontSize(6.5).fillColor("#CDEBD5").text(`${company.toUpperCase()} · Temporada ${season}`, left + 14, bannerTop + 8, {
    width: width - 150,
    ellipsis: true,
  });
  document.font("Helvetica-Bold").fontSize(13).fillColor("#FFFFFF").text(subtitle, left + 14, bannerTop + 22, {
    width: width - 170,
    ellipsis: true,
  });
  const requestBoxX = left + width - 110;
  const requestBoxWidth = 96;
  const requestTextWidth = 82;
  document.roundedRect(requestBoxX, bannerTop + 8, requestBoxWidth, 34, 6).fill("#F1F8E9");
  document.font("Helvetica-Bold").fontSize(5.5).fillColor(green).text("N° de Solicitud:", requestBoxX + 7, bannerTop + 12, { width: requestTextWidth, align: "center" });
  let size = 12;
  while (size > 8) {
    document.font("Helvetica-Bold").fontSize(size);
    if (document.widthOfString(request) <= requestTextWidth) break;
    size -= 1;
  }
  document.fillColor(green).text(request, requestBoxX + 7, bannerTop + 21, { width: requestTextWidth, align: "center", lineBreak: false });
  return { left, width, y: bannerTop + 66, green, pale, company, request };
};

const drawReportSection = (document, title, x, y, width) => {
  document.font("Helvetica-Bold").fontSize(11).fillColor("#176B3A").text(title, x, y);
  document.moveTo(x, y + 16).lineTo(x + width, y + 16).lineWidth(0.5).strokeColor("#C9D8CF").stroke();
  return y + 26;
};

const drawReportField = (document, label, value, x, y, width) => {
  document.font("Helvetica-Bold").fontSize(7).fillColor("#607080").text(label, x, y, { width, lineBreak: false, ellipsis: true });
  document.font("Helvetica").fontSize(9).fillColor("#172033").text(clean(value) || "-", x, y + 11, { width, lineBreak: false, ellipsis: true });
};

const drawReportLineField = (document, label, x, y, width, { line = true } = {}) => {
  document.font("Helvetica-Bold").fontSize(7).fillColor("#607080").text(label, x, y, { width, lineBreak: false, ellipsis: true });
  if (line) document.moveTo(x, y + 22).lineTo(x + width, y + 22).lineWidth(0.5).strokeColor("#C9D8CF").stroke();
};

const drawReportTable = (document, rows, columns, x, y, width, rowMapper, options = {}) => {
  const headerHeight = options.headerHeight || 23;
  const baseRowHeight = options.rowHeight || 22;
  const folioTotalsRowHeight = options.folioTotalsRowHeight || baseRowHeight;
  const fontSize = options.fontSize || 7.5;
  const emptyValue = options.emptyValue ?? "-";
  let cursor = y;
  const drawHeader = () => {
    document.rect(x, cursor, width, headerHeight).fill("#D8ECDD");
    let cellX = x;
    columns.forEach((column) => {
      document.font("Helvetica-Bold").fontSize(column.headerFontSize || column.fontSize || fontSize).fillColor("#0B4A2A").text(column.label, cellX + 4, cursor + 7, {
        width: column.width - 8,
        align: column.align || "left",
        lineBreak: false,
        ellipsis: true,
      });
      cellX += column.width;
    });
    cursor += headerHeight;
  };
  drawHeader();
  const bottom = () => document.page.height - 48;
  (rows.length ? rows : [{}]).forEach((row, index) => {
    const rowHeight = row.__folioTotals ? folioTotalsRowHeight : baseRowHeight;
    if (cursor + rowHeight > bottom()) {
      document.addPage();
      cursor = document.page.margins.top;
      drawHeader();
    }
    const isTotalsRow = Boolean(row.__totals);
    if (isTotalsRow) document.rect(x, cursor, width, rowHeight).fill("#D8ECDD");
    else if (index % 2 === 0) document.rect(x, cursor, width, rowHeight).fill("#FBFDFC");
    document.rect(x, cursor, width, rowHeight).lineWidth(0.35).strokeColor("#C9D8CF").stroke();
    let cellX = x;
    const values = rowMapper(row);
    columns.forEach((column, valueIndex) => {
      const value = clean(values[valueIndex]) || emptyValue;
      const textWidth = column.width - 8;
      document.font(isTotalsRow ? "Helvetica-Bold" : "Helvetica").fontSize(column.fontSize || fontSize);
      const textHeight = document.heightOfString(value, { width: textWidth, lineGap: 0 });
      const textY = cursor + Math.max(2, (rowHeight - textHeight) / 2);
      document.fillColor(isTotalsRow ? "#0B4A2A" : "#172033").text(value, cellX + 4, textY, {
        width: textWidth,
        align: column.align || "left",
        lineBreak: false,
        ellipsis: true,
        lineGap: 0,
      });
      cellX += column.width;
    });
    cursor += rowHeight;
  });
  return cursor;
};

const renderFitosanitarioCover = (data, { includeOrchard = false, document: providedDocument = null, finish = true } = {}) =>
  new Promise((resolve, reject) => {
    const document = providedDocument || createReportDocument({
      title: `SOLICITUD DE INSPECCION FITOSANITARIA ${printableRequestNumber(data)}`,
      author: reportCompany(data),
    });
    const header = data.header || {};
    const cover = drawReportHeader(document, data, "SOLICITUD DE INSPECCION FITOSANITARIA");
    // Reducir el espacio superior permite mantener el bloque reservado del SAG
    // en la primera página junto con la carátula.
    let y = cover.y - 8;
    const width = cover.width;
    const left = cover.left;
    const companyRegion = clean(valueOf(header, "companyRegion", "Empreg"));
    const regionTitle = companyRegion ? `${companyRegion} Region` : "&Empreg Region";
    const originTitle = `SERVICIO AGRICOLA Y GANADERO - INSPECCION EN ORIGEN - ${regionTitle}`;
    y = drawReportSection(document, originTitle, left, y, width);
    y += 4;
    const groups = reportRows(data, includeOrchard);
    const totalBoxes = valueOf(header, "totalBoxes", "soltotcajas") || groups.reduce((sum, row) => sum + row.boxes, 0);
    const totalPallets = valueOf(header, "totalPallets", "soltotpal") || groups.reduce((sum, row) => sum + row.pallets, 0);
    const mainMetrics = [
      ["Total Lote", number(totalBoxes)],
      ["Kilos Netos", number(valueOf(header, "totalKilos", "soltotkilos"), 2)],
    ];
    const drawSummaryMetric = ({ label, value, x, rowY, cellWidth, valueSize = 9 }) => {
      const safeValue = clean(value) || "-";
      const textX = x + 8;
      let labelSize = 7;
      document.font("Helvetica-Bold").fontSize(labelSize);
      while (labelSize > 5.8 && document.widthOfString(label) > cellWidth - 10) {
        labelSize -= 0.2;
        document.font("Helvetica-Bold").fontSize(labelSize);
      }
      document.fillColor("#607080").text(label, textX, rowY + 8, {
        width: cellWidth - 10,
        lineBreak: false,
        ellipsis: true,
      });
      document.font("Helvetica").fontSize(valueSize).fillColor(safeValue === "-" ? "#81918A" : "#172033").text(safeValue, textX, rowY + 19, {
        width: cellWidth - 10,
        lineBreak: false,
        ellipsis: true,
      });
    };
    const blockGap = 8;
    const blockWidth = (width - blockGap * 2) / 3;
    const infoBlockWidth = blockWidth;
    const summaryBlockWidth = blockWidth;
    const categoryBlockWidth = blockWidth;
    const infoColumnWidth = infoBlockWidth / 2;
    const summaryX = left + infoBlockWidth + blockGap;
    const categoryX = summaryX + summaryBlockWidth + blockGap;
    const topBlockHeight = 62;
    document.roundedRect(left, y, infoBlockWidth, topBlockHeight, 6).fill(cover.pale);
    drawReportField(document, "Fecha de Solicitud:", date(valueOf(header, "requestDate", "Solfecha")), left + 8, y + 8, infoColumnWidth - 12);
    drawReportField(document, "N° de Solicitud:", cover.request, left + infoColumnWidth + 8, y + 8, infoColumnWidth - 12);
    drawReportField(document, "Solicitante", valueOf(header, "applicant", "SolSolicita"), left + 8, y + 35, infoColumnWidth - 12);
    drawReportField(document, "Nombre Planta", reportCompany(data), left + infoColumnWidth + 8, y + 35, infoColumnWidth - 12);
    document.roundedRect(summaryX, y, summaryBlockWidth, topBlockHeight, 6).fill(cover.pale);
    const mainMetricWidth = summaryBlockWidth / mainMetrics.length;
    mainMetrics.forEach(([label, value], index) => {
      const metricX = summaryX + mainMetricWidth * index;
      drawSummaryMetric({ label, value, x: metricX, rowY: y, cellWidth: mainMetricWidth });
    });
    document.roundedRect(categoryX, y, categoryBlockWidth, topBlockHeight, 6).fill(cover.pale);
    document.font("Helvetica-Bold").fontSize(6.8).fillColor("#527060").text("Categoria de Envases", categoryX + 10, y + 8, {
      width: categoryBlockWidth - 20,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
    const categoryRows = [
      ["Rango A", valueOf(header, "boxesA", "solcajasRA")],
      ["Rango B", valueOf(header, "boxesB", "SolcajasRB")],
      ["Rango C", valueOf(header, "boxesC", "SolcajasRC")],
      ["Total Cajas", valueOf(header, "totalBoxes", "soltotcajas")],
    ];
    categoryRows.forEach(([label, value], index) => {
      const rowY = y + 22 + 10 * index;
      document.font("Helvetica-Bold").fontSize(6.4).fillColor("#527060").text(label, categoryX + 10, rowY, {
        width: categoryBlockWidth * 0.6,
        lineBreak: false,
        ellipsis: true,
      });
      document.font("Helvetica-Bold").fontSize(7.8).fillColor(clean(value) ? "#172033" : "#81918A").text(clean(value) || "-", categoryX + categoryBlockWidth * 0.6, rowY, {
        width: categoryBlockWidth * 0.3,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      });
    });
    y += 76;
    y = drawReportSection(document, includeOrchard ? "Detalle por productor y cuartel" : "Detalle por productor", left, y, width);
    y += 6;
    const groupColumns = includeOrchard
      ? [
          { label: "Especie", width: 75 },
          { label: "Cod. Prod.", width: 66 },
          { label: "Productor (es)", width: 150 },
          { label: "Nombre Cuartel", width: 115 },
          { label: "N° Pallet", width: 58, align: "right" },
          { label: "N° Cajas", width: width - 464, align: "right" },
        ]
      : [
          { label: "Especie", width: 88 },
          { label: "CSG", width: 72 },
          { label: "Productor (es)", width: 175 },
          { label: "N° Pallet", width: 55, align: "right" },
          { label: "N° Cajas", width: 55, align: "right" },
          { label: "Reservado S.A.G\nPallet Muestra", width: width - 445, headerFontSize: 6.5 },
        ];
    const tableRows = [
      ...groups,
      {
        __totals: true,
        speciesName: "Totales:",
        pallets: totalPallets,
        boxes: totalBoxes,
      },
    ];
    y = drawReportTable(document, tableRows, groupColumns, left, y, width, (row) =>
      includeOrchard
        ? [row.speciesName, valueOf(row, "producerCode", "producerSagCode"), row.producerName, row.orchardName, number(row.pallets), number(row.boxes)]
        : [row.speciesName, row.producerSagCode, row.producerName, number(row.pallets), number(row.boxes), valueOf(row, "reservedSagPalletSample")],
      { emptyValue: "" },
    );
    y += 8;
    const destinationColumnWidth = width / 3;
    drawReportField(document, "Destinos:", valueOf(header, "destinationName", "destinationCode"), left, y, destinationColumnWidth - 12);
    drawReportField(document, "Paises Destino:", valueOf(header, "approvedDestinations", "solDestinos", "SolNDest"), left + destinationColumnWidth, y, destinationColumnWidth - 12);
    drawReportLineField(document, "Nro. Envases Inspeccionados", left + destinationColumnWidth * 2, y, destinationColumnWidth - 12, { line: false });
    y += 30;
    // El bloque SAG contiene varias líneas; reservarlo completo evita que PDFKit
    // cree una página distinta por cada etiqueta cuando queda al final de la hoja.
    if (y + 215 > document.page.height - 48) {
      document.addPage();
      y = document.page.margins.top;
    }
    y = drawReportSection(document, "Reservado S.A.G", left, y, width);
    const statusWidth = (width - 16) / 3;
    ["Aprobado", "Rechazado", "Objetado"].forEach((label, index) => {
      const x = left + index * (statusWidth + 8);
      const labelX = x + 8;
      const labelY = y + 7;
      document.font("Helvetica-Bold").fontSize(8).fillColor("#172033").text(label, labelX, labelY, {
        lineBreak: false,
      });
      const checkboxX = Math.min(x + statusWidth - 24, labelX + document.widthOfString(label) + 10);
      document.rect(checkboxX, y + 4, 14, 14).lineWidth(0.8).strokeColor("#172033").stroke();
    });
    y += 24;
    const drawSAGLine = (label, lineY, options = {}) => {
      const labelX = left + (options.labelOffset || 0);
      const labelWidth = Math.min(document.widthOfString(label) + 10, width - 40);
      document.font("Helvetica-Bold").fontSize(7.5).fillColor("#172033").text(label, labelX, lineY, {
        lineBreak: false,
      });
      const lineX = Math.min(labelX + labelWidth, left + width - 24);
      document.moveTo(lineX, lineY + 10).lineTo(left + width, lineY + 10).lineWidth(0.8).strokeColor("#172033").stroke();
      return lineX;
    };
    drawSAGLine("Certificados de Inspeccion N°s:", y);
    y += 20;
    drawSAGLine("Nombre Ing. Agronomo Inspector:", y);
    y += 20;
    drawSAGLine("Firma Ing. Agronomo Inspector:", y);
    y += 20;
    drawSAGLine("Fecha Revision:", y);
    y += 20;
    drawSAGLine("Observaciones:", y);
    y += 20;
    document.moveTo(left, y + 10).lineTo(left + width, y + 10).lineWidth(0.8).strokeColor("#172033").stroke();
    y += 20;
    if (finish) finishReportDocument(document, cover.company, cover.request).then(resolve).catch(reject);
    else resolve({ document, cover });
  });

const renderFitosanitarioDetail = (data, { includeOrchard = false, document: providedDocument = null, finish = true } = {}) =>
  new Promise((resolve, reject) => {
    const document = providedDocument || createReportDocument({
      title: `DETALLE SOLICITUD ${printableRequestNumber(data)}`,
      author: reportCompany(data),
      landscape: false,
    });
    const cover = drawReportHeader(document, data, "DETALLE DEL LOTE POR PALLET");
    const header = data.header || {};
    let y = cover.y;
    const width = cover.width;
    const left = cover.left;
    const companyRegion = clean(valueOf(header, "companyRegion", "Empreg"));
    const regionTitle = companyRegion ? `${companyRegion} REGION` : "&EmpReg REGION";
    y = drawReportSection(document, `SERVICIO AGRICOLA Y GANADERO - INSPECCION EN ORIGEN - ${regionTitle}`, left, y, width);
    const topFieldWidth = width / 3;
    const topFields = [
      { label: "PLANTA:", value: reportCompany(data), width: topFieldWidth },
      { label: "FECHA:", value: date(valueOf(header, "requestDate", "SOLFECHA")), width: topFieldWidth },
      { label: "N° SOLICITUD INSPECCIÓN FITOSANITARIA:", value: cover.request, width: topFieldWidth, fieldWidth: topFieldWidth - 10 },
    ];
    let topFieldX = left;
    topFields.forEach(({ label, value, width: fieldLayoutWidth, fieldWidth }) => {
      drawReportField(document, label, value, topFieldX, y, fieldWidth || fieldLayoutWidth - 10);
      topFieldX += fieldLayoutWidth;
    });
    y += 32;
    const detailColumns = includeOrchard
      ? [
          { label: "N° Folio", width: 72 },
          { label: "Productor", width: 91 },
          { label: "Variedad", width: 72 },
          { label: "Proceso", width: 48 },
          { label: "Fecha", width: 66 },
          { label: "Cajas", width: 54, align: "right" },
          { label: "Kilos", width: 57, align: "right" },
          { label: "Provincia", width: 76 },
          { label: "Comuna", width: 70 },
          { label: "Especie", width: 78 },
          { label: "Cuartel", width: width - 684 },
        ]
      : width > 650
        ? [
            { label: "N° Folio", width: 70 },
            { label: "Productor", width: 88 },
            { label: "Provincia", width: 76 },
            { label: "Variedad", width: 78 },
            { label: "Proceso", width: 51 },
            { label: "Kilos", width: 58, align: "right" },
            { label: "Cajas", width: 53, align: "right" },
            { label: "Fecha", width: 64 },
            { label: "Comuna", width: 75 },
            { label: "Especie", width: 75 },
            { label: "CSG", width: width - 688 },
          ]
        : [
            { label: "N° Folio", width: 52, fontSize: 5.7 },
            { label: "Productor", width: 65, fontSize: 5.7 },
            { label: "CSG", width: 49, fontSize: 5.7 },
            { label: "Provincia", width: 42, fontSize: 4.7, headerFontSize: 5.7 },
            { label: "Comuna", width: 42, fontSize: 4.7, headerFontSize: 5.7 },
            { label: "Especie", width: 54, fontSize: 5.7 },
            { label: "Variedad", width: 55, fontSize: 4.7, headerFontSize: 5.7 },
            { label: "Fecha Proceso", width: 66, fontSize: 5.7 },
            { label: "Kilos", width: 56, align: "right", fontSize: 5.7 },
            { label: "Cajas", width: 59, align: "right", fontSize: 5.7 },
          ];
    // Solo los folios con más de una línea reciben un subtotal; los folios
    // unitarios siguen directamente hacia la fila general de totales.
    const detailRows = addFolioTotals(data.details || []);
    y = drawReportTable(document, detailRows, detailColumns, left, y, width, (row) => {
      if (row.__folioTotals) {
        return detailColumns.map((column) => {
          if (column.label === "N° Folio" || column.label === "Folio") return `Totales ${row.folio}:`;
          if (column.label === "Kilos") return number(row.kilos, 2);
          if (column.label === "Cajas") return number(row.boxes);
          return "";
        });
      }
      return includeOrchard
        ? [
            valueOf(row, "folio"),
            valueOf(row, "producerName"),
            valueOf(row, "varietyName"),
            valueOf(row, "type"),
            date(valueOf(row, "movementDate")),
            number(valueOf(row, "boxes")),
            number(valueOf(row, "kilos"), 2),
            valueOf(row, "producerProvince"),
            valueOf(row, "producerCommune"),
            valueOf(row, "speciesName"),
            valueOf(row, "orchardName", "orchard"),
          ]
        : [
            valueOf(row, "folio"),
            valueOf(row, "producerName"),
            valueOf(row, "producerSagCode"),
            valueOf(row, "producerProvince"),
            valueOf(row, "producerCommune"),
            valueOf(row, "speciesName"),
            valueOf(row, "varietyName"),
            date(valueOf(row, "movementDate")),
            number(valueOf(row, "kilos"), 2),
            number(valueOf(row, "boxes")),
          ];
    },
    // Compactar las filas del detalle evita que cada línea consuma espacio
    // vertical innecesario, manteniendo una separación legible entre registros.
    { headerHeight: 18, rowHeight: 18, folioTotalsRowHeight: 20, fontSize: 7.2, emptyValue: "" },
    );
    // Los totales forman una fila adicional del listado y siguen el orden GeneXus:
    // pallet al inicio, la etiqueta junto a Kilos, y los valores bajo Kilos/Cajas.
    const totalRowHeight = 20;
    if (y + totalRowHeight > document.page.height - 48) {
      document.addPage();
      y = document.page.margins.top;
    }
    document.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor("#C9D8CF").stroke();
    document.rect(left, y, width, totalRowHeight).fill("#D8ECDD");
    let totalColumnX = left;
    const totalColumnPositions = detailColumns.map((column) => {
      const position = { x: totalColumnX, width: column.width, label: column.label };
      totalColumnX += column.width;
      return position;
    });
    const totalCell = (label, value, options = {}) => {
      const cell = totalColumnPositions.find((column) => column.label === label) || totalColumnPositions[totalColumnPositions.length - 1];
      document.font("Helvetica-Bold").fontSize(options.fontSize || 7.2).fillColor("#0B4A2A").text(value, cell.x + 4, y + 6, {
        width: cell.width - 8,
        align: options.align || "right",
        lineBreak: false,
        ellipsis: true,
      });
    };
    const firstColumn = totalColumnPositions[0];
    document.font("Helvetica-Bold").fontSize(6.8).fillColor("#0B4A2A").text(`Total Pallet: ${number(valueOf(header, "totalPallets", "soltotpal"))}`, firstColumn.x + 4, y + 6, {
      width: firstColumn.width - 4,
      align: "left",
      lineBreak: false,
      ellipsis: true,
    });
    const totalLabelColumn = totalColumnPositions.find((column) => column.label === "Fecha Proceso") || totalColumnPositions.find((column) => column.label === "Fecha") || totalColumnPositions[totalColumnPositions.length - 1];
    totalCell(totalLabelColumn.label, "Totales:", { fontSize: 7, align: "right" });
    totalCell("Kilos", number(valueOf(header, "totalKilos", "soltotkilos"), 2), { fontSize: 6.2 });
    totalCell("Cajas", number(valueOf(header, "totalBoxes", "soltotcajas")));
    document.moveTo(left, y + totalRowHeight).lineTo(left + width, y + totalRowHeight).lineWidth(0.5).strokeColor("#C9D8CF").stroke();
    if (finish) finishReportDocument(document, cover.company, cover.request).then(resolve).catch(reject);
    else resolve({ document, cover });
  });

const renderSolicitudPdf = (data) =>
  new Promise((resolve, reject) => {
    const document = createReportDocument({
      title: `SOLICITUD DE INSPECCION FITOSANITARIA ${printableRequestNumber(data)}`,
      author: reportCompany(data),
    });
    renderFitosanitarioCover(data, { document, finish: false })
      .then(() => {
        document.addPage();
        return renderFitosanitarioDetail(data, { document, finish: false });
      })
      .then(({ cover }) => finishReportDocument(document, cover.company, cover.request))
      .then(resolve)
      .catch(reject);
  });

module.exports = {
  renderSolicitudPdf,
};
