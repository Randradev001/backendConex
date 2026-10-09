const PDFDocument = require("pdfkit");

const clean = (value) => String(value ?? "").trim();
const singleLine = (value) => clean(value).replace(/\s+/g, " ");
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
  const parsed = value instanceof Date ? value : new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
  }
  return raw || "-";
};
const valueOf = (row, ...keys) => {
  for (const key of keys) {
    if (row && row[key] !== null && row[key] !== undefined && clean(row[key]) !== "") return row[key];
  }
  return "";
};
const rut = (numberValue, dvValue) => {
  const numberPart = clean(numberValue);
  const dvPart = clean(dvValue);
  if (!numberPart) return "";
  return dvPart ? `${numberPart}-${dvPart}` : numberPart;
};

// Inserta un subtotal únicamente después de la última línea de cada folio repetido.
const addFolioTotals = (rows) => {
  const counts = new Map();
  const totals = new Map();
  rows.forEach((row) => {
    const folio = clean(valueOf(row, "folio"));
    if (!folio) return;
    counts.set(folio, (counts.get(folio) || 0) + 1);
    const current = totals.get(folio) || { boxes: 0, kilos: 0 };
    current.boxes += Number(valueOf(row, "boxes")) || 0;
    current.kilos += Number(valueOf(row, "kilos")) || 0;
    totals.set(folio, current);
  });

  const seen = new Map();
  return rows.flatMap((row) => {
    const folio = clean(valueOf(row, "folio"));
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

const paginateDetailRows = (rows, { normalCapacity, finalCapacity }) => {
  const source = Array.isArray(rows) ? rows : [];
  const regularRows = Math.max(1, Number(normalCapacity) || 1);
  const lastPageRows = Math.max(0, Number(finalCapacity) || 0);
  const pages = [];
  let offset = 0;

  // Las páginas anteriores se llenan hasta el límite normal. La última queda
  // con el espacio reservado para totales y firmas.
  while (source.length - offset > lastPageRows) {
    const remaining = source.length - offset;
    const take = Math.min(regularRows, remaining);
    pages.push(source.slice(offset, offset + take));
    offset += take;
  }
  pages.push(source.slice(offset));
  return pages;
};

const renderDespachoPdf = (data) =>
  new Promise((resolve, reject) => {
    const header = data.header || {};
    const planilla = clean(valueOf(header, "planillaNumber", "DORNumf", "internalNumber", "DORNum")) || "-";
    const company = clean(header.companyName) || "CONEX";
    const document = new PDFDocument({
      size: "LETTER",
      layout: "portrait",
      margin: 30,
      bufferPages: true,
      info: { Title: `Planilla de Despacho ${planilla}`, Author: company },
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const colors = {
      green: "#0B4A2A",
      greenLight: "#D8ECDD",
      pale: "#F1F8F3",
      ink: "#172033",
      muted: "#607080",
      border: "#C9D8CF",
    };
    let y = document.page.margins.top;
    const left = () => document.page.margins.left;
    const width = () => document.page.width - document.page.margins.left - document.page.margins.right;
    const bottom = () => document.page.height - 42;

    const drawPageTitle = (title, subtitle = "") => {
      document.roundedRect(left(), y, width(), 52, 7).fill(colors.green);
      document.font("Helvetica-Bold").fontSize(7).fillColor("#CDEBD5").text(company.toUpperCase(), left() + 12, y + 8, {
        width: width() - 140,
        ellipsis: true,
        lineBreak: false,
      });
      document.font("Helvetica-Bold").fontSize(14).fillColor("#FFFFFF").text(title, left() + 12, y + 22, {
        width: width() - 140,
        ellipsis: true,
        lineBreak: false,
      });
      document.roundedRect(left() + width() - 112, y + 8, 96, 35, 5).fill("#F1F8E9");
      document.font("Helvetica-Bold").fontSize(6).fillColor(colors.green).text("N° PLANILLA", left() + width() - 105, y + 12, {
        width: 82,
        align: "center",
        lineBreak: false,
      });
      document.font("Helvetica-Bold").fontSize(13).fillColor(colors.green).text(planilla, left() + width() - 105, y + 23, {
        width: 82,
        align: "center",
        lineBreak: false,
      });
      if (subtitle) document.font("Helvetica").fontSize(7).fillColor("#D8F0E0").text(subtitle, left() + 12, y + 39, { lineBreak: false });
      y += 66;
    };

    const ensure = (height) => {
      if (y + height <= bottom()) return;
      document.addPage();
      y = document.page.margins.top;
      drawPageTitle("PLANILLA DE DESPACHO", `Temporada ${clean(header.tempCod) || "-"}`);
    };

    const section = (title, rightField = null) => {
      ensure(54);
      document.font("Helvetica-Bold").fontSize(10).fillColor(colors.green).text(title, left(), y, { lineBreak: false });
      if (rightField) {
        const fieldWidth = 132;
        const fieldX = left() + width() - fieldWidth;
        document.font("Helvetica-Bold").fontSize(6.5).fillColor(colors.muted).text(rightField.label, fieldX, y + 1, {
          width: 58,
          lineBreak: false,
          ellipsis: true,
        });
        document.font("Helvetica").fontSize(8).fillColor(colors.ink).text(clean(rightField.value) || "-", fieldX + 60, y, {
          width: fieldWidth - 60,
          align: "right",
          lineBreak: false,
          ellipsis: true,
        });
      }
      document.moveTo(left(), y + 15).lineTo(left() + width(), y + 15).lineWidth(0.5).strokeColor(colors.border).stroke();
      y += 22;
    };

    const field = (label, value, x, fieldWidth, options = {}) => {
      document.font("Helvetica-Bold").fontSize(options.labelSize || 6.5).fillColor(colors.muted).text(label, x, y, {
        width: fieldWidth,
        lineBreak: false,
        ellipsis: true,
      });
      document.font("Helvetica").fontSize(options.valueSize || 8).fillColor(colors.ink).text(clean(value) || "-", x, y + 10, {
        width: fieldWidth,
        lineBreak: false,
        ellipsis: true,
      });
    };

    const fieldsRow = (items, height = 30) => {
      ensure(height);
      const colWidth = width() / items.length;
      items.forEach((item, index) => field(item[0], item[1], left() + colWidth * index + 4, colWidth - 8, item[2]));
      y += height;
    };

    const drawTable = (rows, columns, options = {}) => {
      const headerHeight = options.headerHeight || 22;
      const rowHeight = options.rowHeight || 21;
      const drawHeader = () => {
        document.rect(left(), y, width(), headerHeight).fill(colors.greenLight);
        let x = left();
        columns.forEach((column) => {
          const multiline = column.label.includes("\n");
          document.font("Helvetica-Bold").fontSize(column.headerSize || 6.5).fillColor(colors.green).text(column.label, x + 3, y + (multiline ? 3 : 6), {
            width: column.width - 6,
            align: column.align || "left",
            lineBreak: multiline,
            lineGap: multiline ? 0 : undefined,
            ellipsis: true,
          });
          x += column.width;
        });
        y += headerHeight;
      };
      ensure(headerHeight + rowHeight);
      drawHeader();
      const source = rows.length ? rows : [{}];
      let dataRowNumber = 0;
      source.forEach((row, index) => {
        const currentRowHeight = row.__folioTotals ? options.folioTotalsRowHeight || rowHeight : rowHeight;
        if (y + currentRowHeight > bottom()) {
          document.addPage({ size: "LETTER", layout: "portrait", margin: document.page.margins.left });
          y = document.page.margins.top;
          drawPageTitle(
            options.pageTitle || "PLANILLA DE DESPACHO",
            options.pageSubtitle || `Temporada ${clean(header.tempCod) || "-"}`,
          );
          drawHeader();
        }
        const isTotalsRow = Boolean(row.__totals);
        if (isTotalsRow) document.rect(left(), y, width(), currentRowHeight).fill(colors.greenLight);
        else if (index % 2 === 0) document.rect(left(), y, width(), currentRowHeight).fill("#FBFDFC");
        document.rect(left(), y, width(), currentRowHeight).lineWidth(0.3).strokeColor(colors.border).stroke();
        let x = left();
        const rowNumber = row.__totals || !rows.length ? "" : ++dataRowNumber;
        columns.forEach((column) => {
          const value = options.mapRow ? options.mapRow(row, column, rowNumber) : row[column.key];
          const displayValue = row.__folioTotals ? clean(value) : singleLine(value) || (isTotalsRow ? "" : "-");
          const isFolioTotals = Boolean(row.__folioTotals && column.key === "folio");
          document.font(isTotalsRow ? "Helvetica-Bold" : "Helvetica").fontSize(column.fontSize || 6.8).fillColor(isTotalsRow ? colors.green : colors.ink).text(displayValue, x + 3, y + (isFolioTotals ? 2 : 6), {
            width: column.width - 6,
            align: column.align || "left",
            lineBreak: isFolioTotals,
            lineGap: isFolioTotals ? 0 : undefined,
            ellipsis: true,
          });
          x += column.width;
        });
        y += currentRowHeight;
      });
      y += options.afterGap ?? 8;
    };

    const groupedCargo = () => {
      const groups = new Map();
      (data.details || []).forEach((row) => {
        const key = [
          clean(valueOf(row, "speciesName")),
          clean(valueOf(row, "varietyName")),
          clean(valueOf(row, "containerName")),
          clean(valueOf(row, "categoryName")),
        ].join("|");
        const current = groups.get(key) || {
          speciesName: valueOf(row, "speciesName"),
          varietyName: valueOf(row, "varietyName"),
          producerName: valueOf(row, "producerName"),
          containerName: valueOf(row, "containerName"),
          categoryName: valueOf(row, "categoryName"),
          boxes: 0,
          kilos: 0,
          processDate: valueOf(row, "processDate"),
          condition: valueOf(row, "caliber"),
        };
        current.boxes += Number(valueOf(row, "boxes")) || 0;
        current.kilos += Number(valueOf(row, "kilos")) || 0;
        groups.set(key, current);
      });
      return [...groups.values()];
    };

    const drawMainBlock = (x, top, blockWidth, blockHeight, title) => {
      document.roundedRect(x, top, blockWidth, blockHeight, 3).fill("#FBFDFC");
      document.roundedRect(x, top, blockWidth, blockHeight, 3).lineWidth(0.35).strokeColor(colors.border).stroke();
      document.font("Helvetica-Bold").fontSize(7.6).fillColor(colors.green).text(title, x + 6, top + 5, {
        width: blockWidth - 12,
        lineBreak: false,
        ellipsis: true,
      });
      document.moveTo(x + 6, top + 18).lineTo(x + blockWidth - 6, top + 18).lineWidth(0.35).strokeColor(colors.border).stroke();
    };

    const drawMainInlineFields = (x, top, blockWidth, items, rowHeight = 14, valueFontSize = 6.8) => {
      const labelWidth = Math.min(92, Math.max(62, blockWidth * 0.34));
      items.forEach(([label, value], index) => {
        const rowTop = top + 23 + index * rowHeight;
        document.font("Helvetica-Bold").fontSize(5.2).fillColor(colors.muted).text(singleLine(label), x + 7, rowTop, {
          width: labelWidth,
          lineBreak: false,
          ellipsis: true,
        });
        document.font("Helvetica").fontSize(valueFontSize).fillColor(colors.ink).text(singleLine(value) || "-", x + 7 + labelWidth, rowTop, {
          width: blockWidth - labelWidth - 14,
          lineBreak: false,
          ellipsis: true,
        });
      });
    };

    const drawMainLabeledFields = (x, top, blockWidth, items, columns = 2, rowHeight = 22) => {
      const gap = 8;
      const fieldWidth = (blockWidth - 14 - gap * (columns - 1)) / columns;
      items.forEach(([label, value], index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const fieldX = x + 7 + column * (fieldWidth + gap);
        const fieldY = top + 23 + row * rowHeight;
        document.font("Helvetica-Bold").fontSize(5.1).fillColor(colors.muted).text(singleLine(label), fieldX, fieldY, {
          width: fieldWidth,
          lineBreak: false,
          ellipsis: true,
        });
        document.font("Helvetica").fontSize(6.7).fillColor(colors.ink).text(singleLine(value) || "-", fieldX, fieldY + 8, {
          width: fieldWidth,
          lineBreak: false,
          ellipsis: true,
        });
      });
    };

    const drawMainCheckboxFields = (x, top, blockWidth, items) => {
      const gap = 8;
      const columns = items.length;
      const fieldWidth = (blockWidth - 14 - gap * (columns - 1)) / columns;
      items.forEach(([label], index) => {
        const fieldX = x + 7 + index * (fieldWidth + gap);
        const fieldY = top + 25;
        const boxSize = 10;
        document.font("Helvetica-Bold").fontSize(6.7).fillColor(colors.ink).text(label, fieldX, fieldY, {
          width: Math.min(fieldWidth - boxSize - 4, document.widthOfString(label)),
          lineBreak: false,
          ellipsis: true,
        });
        const labelWidth = Math.min(fieldWidth - boxSize - 4, document.widthOfString(label));
        document.rect(fieldX + labelWidth + 4, fieldY - 2, boxSize, boxSize).lineWidth(0.6).strokeColor(colors.ink).stroke();
      });
    };

    const cargoRowHeight = 17;
    const drawMainCargoTable = (x, top, tableWidth) => {
      const columns = [
        { label: "N°", width: 18, key: "lineNumber" },
        { label: "ESPECIE", width: 47, key: "speciesName" },
        { label: "VARIEDAD", width: 47, key: "varietyName" },
        { label: "LOTE", width: 28, key: "lot" },
        { label: "CONDICION", width: 43, key: "condition" },
        { label: "PRODUCTO", width: 58, key: "producerName" },
        { label: "CANTIDAD\nPOR UNIDAD\nDE MEDIDA", width: 55, key: "quantityByUnit", align: "right" },
        { label: "TIPO UNIDAD\nDE MEDIDA", width: 43, key: "unitType" },
        { label: "CANTIDAD\nDE ENVASE", width: 50, key: "containerQuantity", align: "right" },
        { label: "TIPO DE\nENVASE", width: 38, key: "containerName" },
        { label: "PUERTO/PAIS\nDESTINO", width: 60, key: "destination" },
        { label: "CONSIGNATARIO", width: 65, key: "consigneeName" },
      ];
      const tableTop = top + 22;
      const headerHeight = 22;
      const rows = groupedCargo().slice(0, 6);
      const source = rows.length ? rows : [{}];
      const cellValue = (row, column, index) => {
        if (!row.speciesName && !row.varietyName && column.key !== "lineNumber") return "";
        if (column.key === "lineNumber") return index + 1;
        if (column.key === "lot") return valueOf(row, "lot");
        if (column.key === "condition") return valueOf(row, "condition");
        if (column.key === "quantityByUnit") return number(row.kilos, 2);
        if (column.key === "unitType") return "KILOS";
        if (column.key === "containerQuantity") return number(row.boxes);
        if (column.key === "destination") return `${valueOf(header, "destinationPort")} / ${valueOf(header, "destinationName")}`;
        if (column.key === "consigneeName") return valueOf(header, "consigneeName");
        return row[column.key];
      };
      const fitCell = (value, column) => {
        const text = singleLine(value);
        if (column.key === "consigneeName") return text;
        const maxChars = Math.max(3, Math.floor((column.width - 6) / 2.6));
        return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 3))}...` : text;
      };
      document.rect(x, tableTop, tableWidth, headerHeight).fill(colors.greenLight);
      let cellX = x;
      columns.forEach((column) => {
        const multiline = column.label.includes("\n");
        const lineCount = column.label.split("\n").length;
        const titleHeight = lineCount * 4.8;
        const titleY = tableTop + Math.max(1, (headerHeight - titleHeight) / 2);
        document.font("Helvetica-Bold").fontSize(4.2).fillColor(colors.green).text(column.label, cellX + 2, titleY, {
          width: column.width - 4,
          align: column.align || "left",
          lineBreak: multiline,
          lineGap: -0.3,
          ellipsis: true,
        });
        cellX += column.width;
      });
      let rowTop = tableTop + headerHeight;
      source.forEach((row, index) => {
        if (index % 2 === 0) document.rect(x, rowTop, tableWidth, cargoRowHeight).fill("#FBFDFC");
        document.rect(x, rowTop, tableWidth, cargoRowHeight).lineWidth(0.25).strokeColor(colors.border).stroke();
        cellX = x;
        columns.forEach((column) => {
          const value = fitCell(cellValue(row, column, index), column);
          document.font("Helvetica").fontSize(4.8).fillColor(colors.ink).text(value || "-", cellX + 2, rowTop + 3, {
            width: column.width - 4,
            align: column.align || "left",
            lineBreak: column.key === "consigneeName",
            lineGap: -0.3,
            ellipsis: column.key !== "consigneeName",
          });
          cellX += column.width;
        });
        rowTop += cargoRowHeight;
      });
      const totalHeight = 12;
      document.rect(x, rowTop, tableWidth, totalHeight).fill(colors.greenLight);
      document.rect(x, rowTop, tableWidth, totalHeight).lineWidth(0.25).strokeColor(colors.border).stroke();
      const columnX = (key) => {
        let currentX = x;
        for (const column of columns) {
          if (column.key === key) return currentX;
          currentX += column.width;
        }
        return x;
      };
      const totalCell = (key, value, align = "right") => {
        const column = columns.find((item) => item.key === key);
        document.font("Helvetica-Bold").fontSize(4.8).fillColor(colors.green).text(value, columnX(key) + 2, rowTop + 3, {
          width: column.width - 4,
          align,
          lineBreak: false,
          ellipsis: true,
        });
      };
      totalCell("producerName", "TOTAL");
      totalCell("quantityByUnit", number(valueOf(header, "totalKilos"), 2));
      totalCell("containerQuantity", number(valueOf(header, "totalBoxes")));
      totalCell("destination", `PALLET/BINS: ${valueOf(header, "palletBin")}`, "left");
      return rowTop + totalHeight - top;
    };

    const drawMainPlanilla = () => {
      drawPageTitle("PLANILLA DE DESPACHO", `Temporada ${clean(header.tempCod) || "-"}`);
      const gap = 6;
      const halfWidth = (width() - gap) / 2;
      const top = y;
      const topHeight = 78;
      drawMainBlock(left(), top, halfWidth, topHeight, "1.- IDENTIFICACION CENTRO");
      drawMainInlineFields(left(), top, halfWidth, [
        ["N° PLANILLA", planilla],
        ["REG. PROV. COMUNA", valueOf(header, "companyCommuneCode", "companyCommune")],
        ["ESTABLECIMIENTO", company],
        ["N° INSCRIPCION", valueOf(header, "companySAGCode", "companyRut")],
      ]);
      drawMainBlock(left() + halfWidth + gap, top, halfWidth, topHeight, "2.- CONTROL SAG");
      drawMainInlineFields(left() + halfWidth + gap, top, halfWidth, [
        ["FOLIO PUERTO", valueOf(header, "destinationPortCode", "destinationPort")],
        ["REVISION", valueOf(header, "statusLabel")],
        ["DD / MM / AA", ""],
      ]);

      const secondTop = top + topHeight + gap;
      const secondHeight = 112;
      drawMainBlock(left(), secondTop, halfWidth, secondHeight, "10.- ANTECEDENTES GENERALES");
      drawMainInlineFields(left(), secondTop, halfWidth, [
        ["AGENTE", valueOf(header, "agentName")],
        ["RUT", rut(valueOf(header, "agentRut"), valueOf(header, "agentDv"))],
        ["EXPORT.", valueOf(header, "exporterName")],
        ["RUT", rut(valueOf(header, "exporterRut"), valueOf(header, "exporterDv"))],
        ["NAVE", valueOf(header, "vessel")],
      ]);
      drawMainBlock(left() + halfWidth + gap, secondTop, halfWidth, secondHeight, "3.- TRANSPORTE Y DESTINO");
      drawMainInlineFields(left() + halfWidth + gap, secondTop, halfWidth, [
        ["FECHA DESPACHO", date(valueOf(header, "shipmentDate"))],
        ["PUERTO DE EMBARQUE", valueOf(header, "embarkPort")],
        ["TIPO TRANSPORTE", valueOf(header, "transportType")],
        ["PATENTE(S)", valueOf(header, "patent")],
        ["GUIAS(S) DESPACHO", valueOf(header, "guideNumber")],
        ["SELLO(S)N.", valueOf(header, "seals")],
        ["UBICACION", valueOf(header, "location")],
      ], 14, 5.8);

      const cargoTop = secondTop + secondHeight + gap;
      const cargoHeight = 22 + 22 + cargoRowHeight * Math.max(1, Math.min(6, groupedCargo().length || 1)) + 12;
      drawMainBlock(left(), cargoTop, width(), cargoHeight, "4.- ANTECEDENTES DE LA CARGA");
      drawMainCargoTable(left(), cargoTop, width());

      const lowerTop = cargoTop + cargoHeight + gap;
  const lowerHeight = 122;
      drawMainBlock(left(), lowerTop, halfWidth, lowerHeight, "5.- OBSERVACIONES: (PROVINCIA(S) ORIGEN; COMUNA(S) ORIGEN)");
      const observation = singleLine(valueOf(header, "observations"));
      [observation.slice(0, 70), observation.slice(70, 140), observation.slice(140, 210)].forEach((line, index) => {
        const lineY = lowerTop + 25 + index * 18;
        document.font("Helvetica").fontSize(6.5).fillColor(colors.ink).text(line || " ", left() + 7, lineY, { width: halfWidth - 14, lineBreak: false, ellipsis: true });
        document.moveTo(left() + 7, lineY + 11).lineTo(left() + halfWidth - 7, lineY + 11).lineWidth(0.25).strokeColor(colors.border).stroke();
      });
      const verificationX = left() + halfWidth + gap;
      drawMainBlock(verificationX, lowerTop, halfWidth, lowerHeight, "8.- VERIFICACIÓN SAG PUERTO");
      drawMainCheckboxFields(verificationX, lowerTop, halfWidth, [
        ["Aprobado"],
        ["Rechazado"],
      ]);
  const rejectionLabelY = lowerTop + 43;
  document.font("Helvetica-Bold").fontSize(5.5).fillColor(colors.ink).text(
    "CAUSA DEL RECHAZO",
    verificationX + 7,
    rejectionLabelY,
    { lineBreak: false },
  );
  document
    .rect(verificationX + 7, lowerTop + 54, halfWidth - 14, 28)
    .lineWidth(0.6)
    .strokeColor(colors.ink)
    .stroke();

  const inspectorGap = 8;
  const inspectorLineWidth = (halfWidth - 14 - inspectorGap) / 2;
  const inspectorLeftX = verificationX + 7;
  const inspectorRightX = inspectorLeftX + inspectorLineWidth + inspectorGap;
  const inspectorLineY = lowerTop + lowerHeight - 17;
  [
    [inspectorLeftX, "NOMBRE INSPECTOR"],
    [inspectorRightX, "FIRMA INSPECTOR"],
  ].forEach(([fieldX, label]) => {
    document
      .moveTo(fieldX, inspectorLineY)
      .lineTo(fieldX + inspectorLineWidth, inspectorLineY)
      .lineWidth(0.6)
      .strokeColor(colors.ink)
      .stroke();
    document.font("Helvetica-Bold").fontSize(5.8).fillColor(colors.ink).text(
      label,
      fieldX,
      inspectorLineY + 5,
      { width: inspectorLineWidth, align: "center", lineBreak: false },
    );
  });

      const finalTop = lowerTop + lowerHeight + gap;
  const finalHeight = 122;
      drawMainBlock(left(), finalTop, halfWidth, finalHeight, "9.- DATOS DESPACHADOR");
  const dispatcherX = left();
  const dispatcherNameWidth = halfWidth * 0.55;
  const dispatcherNameX = dispatcherX + (halfWidth - dispatcherNameWidth) / 2;
  const dispatcherNameY = finalTop + 25;
  document.rect(dispatcherNameX, dispatcherNameY, dispatcherNameWidth, 12).fill("#FFFFFF");
  document.font("Helvetica").fontSize(6.8).fillColor(colors.ink).text(
    singleLine(valueOf(header, "dispatcherName")),
    dispatcherNameX,
    dispatcherNameY + 2,
    { width: dispatcherNameWidth, align: "center", lineBreak: false, ellipsis: true },
  );
  document
    .moveTo(dispatcherNameX, dispatcherNameY + 13)
    .lineTo(dispatcherNameX + dispatcherNameWidth, dispatcherNameY + 13)
    .lineWidth(0.6)
    .strokeColor(colors.ink)
    .stroke();
  document.font("Helvetica-Bold").fontSize(5.8).fillColor(colors.ink).text(
    "NOMBRE INSPECTOR CONTRAPARTE",
    dispatcherX + 7,
    finalTop + 45,
    { width: halfWidth - 14, align: "center", lineBreak: false },
  );

  const signatureGap = 8;
  const signatureLineY = finalTop + 92;
  const signatureAreaWidth = (halfWidth - 14 - signatureGap) / 2;
  const signatureLeftX = dispatcherX + 7;
  const signatureRightX = signatureLeftX + signatureAreaWidth + signatureGap;
  [signatureLeftX, signatureRightX].forEach((signatureX) => {
    document
      .moveTo(signatureX, signatureLineY)
      .lineTo(signatureX + signatureAreaWidth, signatureLineY)
      .lineWidth(0.6)
      .strokeColor(colors.ink)
      .stroke();
  });
  document.font("Helvetica-Bold").fontSize(5.8).fillColor(colors.ink).text(
    "FIRMA\nINSPECTOR CONTRAPARTE",
    signatureLeftX,
    signatureLineY + 6,
    { width: signatureAreaWidth, align: "left", lineGap: 0 },
  );
  document.font("Helvetica-Bold").fontSize(5.8).fillColor(colors.ink).text(
    "TIMBRE\nSOLO DESPACHO SAG",
    signatureRightX,
    signatureLineY + 6,
    { width: signatureAreaWidth, align: "center", lineGap: 0 },
  );
      drawMainBlock(left() + halfWidth + gap, finalTop, halfWidth, finalHeight, "6.- CONDICION DE LA CARGA");
      drawMainLabeledFields(left() + halfWidth + gap, finalTop, halfWidth, [
        ["INSPECCIONADO", "[ ]"],
        ["TRATADO", "[ ]"],
        ["TRATADO E INSPECCIONADO", "[ ]"],
      ], 2, 21);

      const treatmentTop = finalTop + finalHeight + gap;
      const treatmentHeight = 72;
      drawMainBlock(left(), treatmentTop, width(), treatmentHeight, "7.- TRATAMIENTO DETALLE");
      drawMainInlineFields(left(), treatmentTop, width(), [
        ["CODIGO TRATAMIENTO", valueOf(header, "treatmentCode")],
        ["TRATAMIENTO", valueOf(header, "treatment")],
        ["TRATAMIENTO 2", valueOf(header, "treatment2")],
        ["TRATAMIENTO 3", valueOf(header, "treatment3")],
      ], 14);
      y = treatmentTop + treatmentHeight;
    };

    drawMainPlanilla();

    const drawDetailPageHeader = (includeSection = true) => {
      y = document.page.margins.top;
      drawPageTitle("DESPACHO DE FRUTA INSPECCIONADA", `ANEXO PLANILLA DESPACHO N° ${planilla}`);
      if (includeSection) {
        section("DETALLE DE LA PLANILLA", { label: "FECHA EMISION", value: date(valueOf(header, "shipmentDate")) });
      }
      return y;
    };

    document.addPage({ size: "LETTER", layout: "portrait", margin: 28 });
    const detailStartY = drawDetailPageHeader();
    const folioHeaders = new Map((data.folios || []).map((row) => [clean(row.folio), row]));
    const detailColumns = [
      { label: "Nº", width: 26, key: "lineNumber", align: "right" },
      { label: "Nº Folio", width: 62, key: "folio" },
      { label: "Especie", width: 60, key: "speciesName" },
      { label: "Variedad", width: 65, key: "varietyName" },
      { label: "Provincia\nOrigen", width: 70, key: "province" },
      { label: "Comuna\nOrigen", width: 65, key: "commune" },
      { label: "CSG", width: 50, key: "originCsg" },
      { label: "Nº Ins.", width: 43, key: "inspectionNumber" },
      { label: "Fecha\nIns.", width: 60, key: "processDate" },
      { label: "Nº de Cajas", width: 55, key: "boxes", align: "right" },
    ];
    const detailRows = addFolioTotals(data.details || []);
    const drawDetailTable = (rows) => drawTable(rows, detailColumns, {
      headerHeight: 24,
      rowHeight: 20,
      pageTitle: "DESPACHO DE FRUTA INSPECCIONADA",
      pageSubtitle: `ANEXO PLANILLA DESPACHO N° ${planilla}`,
      folioTotalsRowHeight: 20,
      afterGap: 0,
      mapRow: (row, column, rowNumber) => {
        if (row.__folioTotals) {
          if (column.key === "folio") return `Totales\n${row.folio}:`;
          if (column.key === "boxes") return number(row.boxes);
          return "";
        }
        if (column.key === "lineNumber") return rowNumber;
        if (column.key === "boxes") return number(row.boxes);
        if (column.key === "processDate") return date(row.processDate);
        if (column.key === "inspectionNumber") return valueOf(folioHeaders.get(clean(row.folio)), "inspectionNumber");
        if (column.key === "originCsg") return valueOf(row, "originCsg", "producerCode");
        if (column.key === "producerName") return valueOf(row, "producerName", "originCsg");
        return row[column.key];
      },
    });
    const detailTotalsHeight = 20;
    const detailSignatureHeight = 58;
    const detailFooterGap = 4;
    const detailSignatureTop = document.page.height - 42 - detailSignatureHeight;
    const detailHeaderHeight = 24;
    const detailRowHeight = 20;
    const normalCapacity = Math.max(1, Math.floor((bottom() - detailStartY - detailHeaderHeight) / detailRowHeight));
    const finalCapacity = Math.max(0, Math.floor((detailSignatureTop - detailStartY - detailHeaderHeight - detailTotalsHeight - detailFooterGap) / detailRowHeight));
    const detailPages = paginateDetailRows(detailRows, { normalCapacity, finalCapacity });

    detailPages.forEach((rows, index) => {
      if (index > 0) {
        document.addPage({ size: "LETTER", layout: "portrait", margin: 28 });
        drawDetailPageHeader(rows.length > 0);
      }
      // Una página final vacía puede ser necesaria para ubicar los totales y
      // las firmas cuando la página anterior quedó completamente ocupada.
      if (rows.length > 0 || detailPages.length === 1) drawDetailTable(rows);
    });

    document.rect(left(), y, width(), detailTotalsHeight).fill(colors.greenLight);
    document.rect(left(), y, width(), detailTotalsHeight).lineWidth(0.3).strokeColor(colors.border).stroke();
    const detailTotalColumns = detailColumns.map((column, index) => ({
      ...column,
      x: left() + detailColumns.slice(0, index).reduce((sum, item) => sum + item.width, 0),
    }));
    const palletColumn = detailTotalColumns.find((item) => item.key === "lineNumber");
    const totalsColumn = detailTotalColumns.find((item) => item.key === "originCsg");
    document.font("Helvetica-Bold").fontSize(6.8).fillColor(colors.green).text(`Total Pallet: ${number(valueOf(header, "totalFolios"))}`, palletColumn.x + 3, y + 6, {
      width: detailColumns[0].width + detailColumns[1].width + detailColumns[2].width + detailColumns[3].width + detailColumns[4].width + detailColumns[5].width + detailColumns[6].width - 6,
      align: "left",
      lineBreak: false,
      ellipsis: true,
    });
    document.font("Helvetica-Bold").fontSize(6.8).fillColor(colors.green).text("Totales:", totalsColumn.x + 3, y + 6, {
      width: 58,
      align: "left",
      lineBreak: false,
      ellipsis: true,
    });
    document.font("Helvetica-Bold").fontSize(6.8).fillColor(colors.green).text(number(valueOf(header, "totalKilos"), 2), totalsColumn.x + 65, y + 6, {
      width: 52,
      align: "right",
      lineBreak: false,
      ellipsis: true,
    });
    document.font("Helvetica-Bold").fontSize(6.8).fillColor(colors.green).text(number(valueOf(header, "totalBoxes")), detailTotalColumns.find((item) => item.key === "boxes").x + 3, y + 6, {
      width: detailTotalColumns.find((item) => item.key === "boxes").width - 6,
      align: "right",
      lineBreak: false,
      ellipsis: true,
    });
    y += detailTotalsHeight;
    y += detailFooterGap;

    y = detailSignatureTop;
    const signatureLineColor = "#64645A";
    const signatureLineWidth = 190;
    const leftSignatureX = left() + 42;
    const rightSignatureX = left() + width() / 2 + 36;
    const dispatcherName = clean(valueOf(header, "dispatcherName", "authorizedDispatcher"));
    document.rect(leftSignatureX, y + 7, signatureLineWidth, 12).fill("#FFFFFF");
    if (dispatcherName) {
      document.font("Helvetica-Bold").fontSize(8).fillColor(colors.ink).text(dispatcherName, leftSignatureX + 2, y + 9, {
        width: signatureLineWidth - 4,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });
    }
    document.moveTo(leftSignatureX, y + 26).lineTo(leftSignatureX + signatureLineWidth, y + 26).lineWidth(0.7).strokeColor(signatureLineColor).stroke();
    document.moveTo(rightSignatureX, y + 26).lineTo(rightSignatureX + signatureLineWidth, y + 26).lineWidth(0.7).strokeColor(signatureLineColor).stroke();
    document.font("Helvetica-Bold").fontSize(7.2).fillColor(colors.ink).text("NOMBRE CONTRAPARTE PROFESIONAL\nO CONTRAPARTE TECNICA", leftSignatureX, y + 31, {
      width: signatureLineWidth,
      lineBreak: true,
      lineGap: 0,
    });
    document.font("Helvetica-Bold").fontSize(7.2).fillColor(colors.ink).text("FIRMA CONTRAPARTE PROFESIONAL\nO CONTRAPARTE TECNICA", rightSignatureX, y + 31, {
      width: signatureLineWidth,
      lineBreak: true,
      lineGap: 0,
    });
    y += detailSignatureHeight;

    const pages = document.bufferedPageRange();
    for (let page = 0; page < pages.count; page += 1) {
      document.switchToPage(page);
      document.page.margins.bottom = 0;
      const footerY = document.page.height - 20;
      document.font("Helvetica").fontSize(7).fillColor(colors.muted).text(`${company} · Planilla ${planilla}`, document.page.margins.left, footerY, {
        width: document.page.width - document.page.margins.left - document.page.margins.right - 90,
        lineBreak: false,
        ellipsis: true,
      });
      document.font("Helvetica-Bold").fontSize(7).text(`Página ${page + 1} de ${pages.count}`, document.page.margins.left, footerY, {
        width: document.page.width - document.page.margins.left - document.page.margins.right,
        align: "right",
        lineBreak: false,
      });
    }
    document.end();
  });

module.exports = { addFolioTotals, paginateDetailRows, renderDespachoPdf };
