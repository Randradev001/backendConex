const path = require("path");
const PDFDocument = require("pdfkit");

const clean = (value) => String(value ?? "").trim();
const singleLine = (value) => clean(value).replace(/\s+/g, " ");
const number = (value, decimals = 0) => new Intl.NumberFormat("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value || 0));
const date = (value) => {
  const raw = clean(value);
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = value instanceof Date ? value : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw || "-" : `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
};
const valueOf = (row, ...keys) => {
  for (const key of keys) if (row && row[key] !== null && row[key] !== undefined && clean(row[key]) !== "") return row[key];
  return "";
};
const rut = (value, dv) => clean(value) ? `${clean(value)}${clean(dv) ? `-${clean(dv)}` : ""}` : "";
const logoPath = path.join(__dirname, "../../img/sag-logo.png");

// El anexo GX solo imprime subtotales en los folios que contienen más de una línea.
const addFolioTotals = (rows) => {
  const counts = new Map();
  const totals = new Map();
  (rows || []).forEach((row) => {
    const folio = clean(row.folio);
    if (!folio) return;
    counts.set(folio, (counts.get(folio) || 0) + 1);
    const current = totals.get(folio) || { boxes: 0, kilos: 0 };
    current.boxes += Number(row.boxes) || 0;
    current.kilos += Number(row.kilos) || 0;
    totals.set(folio, current);
  });
  const seen = new Map();
  return (rows || []).flatMap((row) => {
    const folio = clean(row.folio);
    if (!folio || counts.get(folio) <= 1) return [row];
    const occurrence = (seen.get(folio) || 0) + 1;
    seen.set(folio, occurrence);
    if (occurrence < counts.get(folio)) return [row];
    const total = totals.get(folio);
    return [row, { __totals: true, __folioTotals: true, folio, boxes: total.boxes, kilos: total.kilos }];
  });
};

const paginateDetailRows = (rows, { normalCapacity, finalCapacity }) => {
  const source = Array.isArray(rows) ? rows : [];
  const regularRows = Math.max(1, Number(normalCapacity) || 1);
  const lastPageRows = Math.max(0, Number(finalCapacity) || 0);
  const pages = [];
  let offset = 0;
  while (source.length - offset > lastPageRows) {
    const take = Math.min(regularRows, source.length - offset);
    pages.push(source.slice(offset, offset + take));
    offset += take;
  }
  pages.push(source.slice(offset));
  return pages;
};

const renderDespachoPdf = (data) => new Promise((resolve, reject) => {
  const header = data.header || {};
  const details = Array.isArray(data.details) ? data.details : [];
  // Carta vertical es el formato de producción; se conserva landscape solo
  // para consumidores que lo soliciten explícitamente.
  const layout = data.layout === "landscape" ? "landscape" : "portrait";
  const isPortrait = layout === "portrait";
  const planilla = clean(valueOf(header, "planillaNumber", "DORNumf", "internalNumber", "DORNum")) || "-";
  const company = clean(header.companyName) || "CONEX";
  const document = new PDFDocument({ size: "LETTER", layout, margin: 10, bufferPages: true, info: { Title: `Planilla de Despacho ${planilla}`, Author: company } });
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  document.on("error", reject);
  document.on("end", () => resolve(Buffer.concat(chunks)));

  // PlaniDSAG y DPlaniSAG se reproducen con tinta negra y fondo blanco.
  const black = "#000000";
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  const frame = { x: 10, y: 8, width: pageWidth - 20, height: pageHeight - 16 };
  const line = (x1, y1, x2, y2, thickness = 0.55) => document.moveTo(x1, y1).lineTo(x2, y2).lineWidth(thickness).strokeColor(black).stroke();
  const box = (x, y, width, height, title, size = 7.1) => {
    document.rect(x, y, width, height).lineWidth(0.65).strokeColor(black).stroke();
    document.font("Helvetica-Bold").fontSize(size).fillColor(black).text(title, x + 5, y + 4, { width: width - 10, lineBreak: false, ellipsis: true });
  };
  const text = (value, x, y, width, options = {}) => document.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.size || 7).fillColor(black).text(singleLine(value) || "-", x, y, { width, align: options.align || "left", lineBreak: false, ellipsis: true });
  const drawFrame = () => document.rect(frame.x, frame.y, frame.width, frame.height).lineWidth(0.8).strokeColor(black).stroke();
  const drawInline = (label, value, x, y, width, labelWidth) => {
    document.font("Helvetica-Bold").fontSize(5.7).fillColor(black).text(label, x, y + 2, { width: labelWidth, lineBreak: false, ellipsis: true });
    document.rect(x + labelWidth, y, width - labelWidth, 14).lineWidth(0.5).strokeColor(black).stroke();
    text(value, x + labelWidth + 3, y + 3, width - labelWidth - 6, { size: 6.3 });
  };
  const drawRows = (x, y, width, rows, labelWidth, step = 15) => rows.forEach(([label, value], index) => {
    const rowY = y + index * step;
    document.font("Helvetica-Bold").fontSize(5.7).fillColor(black).text(label, x, rowY, { width: labelWidth, lineBreak: false, ellipsis: true });
    text(value, x + labelWidth, rowY, width - labelWidth, { size: 6.5 });
  });
  const check = (label, x, y, width) => {
    document.font("Helvetica").fontSize(6.6).fillColor(black).text(label, x, y, { width: width - 16, lineBreak: false, ellipsis: true });
    document.rect(x + width - 12, y - 2, 11, 11).lineWidth(0.55).strokeColor(black).stroke();
  };
  const drawDigitBoxes = (x, y, count, width, value) => {
    const digits = clean(value).replace(/\D/g, "");
    for (let index = 0; index < count; index += 1) {
      document.rect(x + index * width, y, width, 17).lineWidth(0.5).strokeColor(black).stroke();
      if (digits[index]) text(digits[index], x + index * width, y + 4, width, { size: 7, align: "center" });
    }
  };
  const drawLogo = () => document.image(logoPath, frame.x + 7, frame.y + 5, { fit: [52, 47], align: "left", valign: "top" });

  const cargoGroups = (() => {
    const groups = new Map();
    details.forEach((row) => {
      const key = [clean(row.speciesName), clean(row.varietyName), clean(row.containerName), clean(row.categoryName)].join("|");
      const current = groups.get(key) || { speciesName: row.speciesName, varietyName: row.varietyName, producerName: row.producerName, containerName: row.containerName, condition: row.caliber, lot: row.lot, boxes: 0, kilos: 0 };
      current.boxes += Number(row.boxes) || 0;
      current.kilos += Number(row.kilos) || 0;
      groups.set(key, current);
    });
    return [...groups.values()];
  })();

  const drawMainHeader = () => {
    drawLogo();
    document.font("Helvetica-Bold").fontSize(isPortrait ? 9.5 : 12).fillColor(black).text("PLANILLA DE DESPACHO", isPortrait ? frame.x + 45 : frame.x + 225, isPortrait ? frame.y + 63 : frame.y + 10, { width: isPortrait ? frame.width - 90 : 325, align: "center", lineBreak: false });
    const metaX = isPortrait ? frame.x + frame.width - 190 : frame.x + frame.width - 170;
    [["Código:", "F-CER-PPS-PA-001"], ["Versión :", "03"], ["Fecha Vigencia :", "01-10-2014"], ["Página:", ""]].forEach(([label, value], index) => {
      document.font("Helvetica").fontSize(7).fillColor(black).text(label, metaX, frame.y + 4 + index * 11, { width: 75, lineBreak: false });
      if (value) text(value, metaX + 78, frame.y + 4 + index * 11, 85, { size: 7 });
    });
    line(frame.x + 2, frame.y + (isPortrait ? 82 : 55), frame.x + frame.width - 2, frame.y + (isPortrait ? 82 : 55), 0.75);
  };

  const drawCargo = (x, y, width) => {
    const units = [26, 97, 71, 34, 69, 107, 73, 68, 67, 55, 191, 136];
    const labels = ["N°", "ESPECIE", "VARIEDAD", "LOTE", "CONDICION", "PRODUCTO", "CANTIDAD\nPOR UNIDAD\nDE MEDIDA", "TIPO UNIDAD\nDE MEDIDA", "CANTIDAD\nDE ENVASE", "TIPO DE\nENVASE", "PUERTO/PAIS DESTINO", "CONSIGNATARIO"];
    const columns = units.map((unit, index) => ({ label: labels[index], width: (width * unit) / 991 }));
    // La grilla termina dentro del bloque 4 para conservar el espacio antes de los bloques inferiores.
    const headerHeight = 22;
    const rowHeight = 17;
    document.rect(x, y, width, headerHeight).lineWidth(0.6).strokeColor(black).stroke();
    let cellX = x;
    columns.forEach((column) => {
      const multi = column.label.includes("\n");
      document.font("Helvetica-Bold").fontSize(5.1).fillColor(black).text(column.label, cellX + 2, y + (multi ? 2 : 7), { width: column.width - 4, align: "center", lineBreak: multi, lineGap: -0.7, ellipsis: true });
      cellX += column.width;
      line(cellX, y, cellX, y + headerHeight, 0.4);
    });
    const row = cargoGroups[0] || {};
    const values = [row.speciesName ? "1" : "", row.speciesName, row.varietyName, row.lot, row.condition, row.producerName, row.kilos === undefined ? "" : number(row.kilos, 2), "KILOS", row.boxes === undefined ? "" : number(row.boxes), row.containerName, `${valueOf(header, "destinationPort")} / ${valueOf(header, "destinationName")}`, valueOf(header, "consigneeName")];
    document.rect(x, y + headerHeight, width, rowHeight).lineWidth(0.45).strokeColor(black).stroke();
    cellX = x;
    columns.forEach((column, index) => {
      text(values[index], cellX + 2, y + headerHeight + 4, column.width - 4, { size: 5.3, align: index === 6 || index === 8 ? "right" : "left" });
      cellX += column.width;
      line(cellX, y + headerHeight, cellX, y + headerHeight + rowHeight, 0.35);
    });
    const totalY = y + headerHeight + rowHeight;
    document.rect(x, totalY, width, 15).lineWidth(0.45).strokeColor(black).stroke();
    const columnX = (index) => x + columns.slice(0, index).reduce((sum, column) => sum + column.width, 0);
    text("TOTAL", columnX(5) + 2, totalY + 4, columns[5].width - 4, { bold: true, size: 6, align: "center" });
    text(number(header.totalKilos, 2), columnX(6) + 2, totalY + 4, columns[6].width - 4, { bold: true, size: 5.8, align: "right" });
    text(number(header.totalBoxes), columnX(8) + 2, totalY + 4, columns[8].width - 4, { bold: true, size: 5.8, align: "right" });
    text(valueOf(header, "palletBin"), columnX(10) + 2, totalY + 4, columns[10].width - 4, { bold: true, size: 5.8, align: "center" });
  };

  const drawMainPage = () => {
    drawFrame();
    drawMainHeader();
    const x = frame.x + 2;
    const width = frame.width - 4;
    const gap = 2;
    const topY = frame.y + (isPortrait ? 86 : 58);
    const topHeight = 96;
    const firstWidth = width * 0.35;
    const secondWidth = width * 0.33;
    const thirdWidth = width - firstWidth - secondWidth - gap * 2;
    box(x, topY, firstWidth, topHeight, "1.- IDENTIFICACION CENTRO");
    drawRows(x + 9, topY + 25, firstWidth - 18, [["N° PLANILLA", planilla], ["REG. PROV. COMUNA", valueOf(header, "companyCommuneCode", "companyCommune")], ["ESTABLECIMIENTO", company], ["N° INSCRIPCION", valueOf(header, "companySAGCode", "companyRut")]], 94, 17);
    const controlX = x + firstWidth + gap;
    box(controlX, topY, secondWidth, topHeight, "2.- CONTROL SAG");
    document.font("Helvetica-Bold").fontSize(6).fillColor(black).text("FOLIO PUERTO", controlX + 8, topY + 34, { width: 70, lineBreak: false });
    drawDigitBoxes(controlX + 82, topY + 31, 8, isPortrait ? 13 : 20, valueOf(header, "destinationPortCode"));
    document.font("Helvetica-Bold").fontSize(6).fillColor(black).text("REVISION", controlX + 8, topY + 62, { width: 65, lineBreak: false });
    drawDigitBoxes(controlX + 82, topY + 59, 6, isPortrait ? 16 : 20, valueOf(header, "revision"));
    ["DD", "MM", "AA"].forEach((label, index) => document.font("Helvetica").fontSize(5.8).fillColor(black).text(label, controlX + 86 + index * (isPortrait ? 30 : 40), topY + 82, { width: 24, align: "center", lineBreak: false }));
    const generalX = controlX + secondWidth + gap;
    box(generalX, topY, thirdWidth, topHeight, "10.- ANTECEDENTES GENERALES");
    drawRows(generalX + 9, topY + 25, thirdWidth - 18, [["AGENTE", valueOf(header, "agentName")], ["RUT", rut(header.agentRut, header.agentDv)], ["EXPORT.", valueOf(header, "exporterName")], ["RUT", rut(header.exporterRut, header.exporterDv)], ["NAVE", valueOf(header, "vessel")]], 48, 14);

    const transportY = topY + topHeight + gap;
    const transportHeight = isPortrait ? 84 : 58;
    box(x, transportY, width, transportHeight, "3.- TRANSPORTE Y DESTINO");
    if (isPortrait) {
      drawInline("FECHA DESPACHO", date(header.shipmentDate), x + 10, transportY + 22, 145, 72);
      drawInline("PUERTO DE EMBARQUE", header.embarkPort, x + 165, transportY + 22, 210, 92);
      drawInline("TIPO TRANSPORTE", header.transportType, x + 385, transportY + 22, 195, 76);
      drawInline("PATENTE(S)", header.patent, x + 10, transportY + 42, 145, 54);
      drawInline("GUIAS(S) DESPACHO", header.guideNumber, x + 165, transportY + 42, 190, 92);
      drawInline("SELLO(S)/N.", header.seals, x + 365, transportY + 42, 215, 70);
      drawInline("UBICACION:", header.location, x + 10, transportY + 62, width - 20, 62);
    } else {
      drawInline("FECHA DESPACHO", date(header.shipmentDate), x + 10, transportY + 22, 145, 72);
      drawInline("PUERTO DE EMBARQUE", header.embarkPort, x + 166, transportY + 22, 235, 96);
      drawInline("TIPO TRANSPORTE", header.transportType, x + 408, transportY + 22, 185, 78);
      drawInline("PATENTE(S)", header.patent, x + 600, transportY + 22, width - 610, 56);
      drawInline("GUIAS(S) DESPACHO", header.guideNumber, x + 10, transportY + 40, 190, 96);
      drawInline("SELLO(S)/N.", header.seals, x + 210, transportY + 40, 220, 70);
      drawInline("UBICACION:", header.location, x + 440, transportY + 40, width - 450, 65);
    }

    const cargoY = transportY + transportHeight + 2;
    const cargoHeight = 74;
    box(x, cargoY, width, cargoHeight, "4. ANTECEDENTES DE LA CARGA");
    drawCargo(x + 2, cargoY + 20, width - 4);

    const lowerY = cargoY + cargoHeight + 4;
    const lowerGap = 4;
    const leftWidth = width * 0.4;
    const middleWidth = width * 0.29;
    const rightWidth = width - leftWidth - middleWidth - lowerGap * 2;
    const middleX = x + leftWidth + lowerGap;
    const rightX = middleX + middleWidth + lowerGap;
    // Reservar el pie de la hoja evita que PDFKit cree una página adicional
    // al escribir las etiquetas de firma del bloque inferior.
    const lowerHeight = frame.y + frame.height - lowerY - 42;
    box(x, lowerY, leftWidth, 61, "5.- OBSERVACIONES: (Provincia(s) Origen; Comuna(s) Origen)", 6.4);
    const observation = singleLine(header.observations);
    for (let index = 0; index < 3; index += 1) {
      const rowY = lowerY + 24 + index * 12;
      text(observation.slice(index * 70, index * 70 + 70), x + 7, rowY, leftWidth - 14, { size: 6 });
      line(x + 7, rowY + 10, x + leftWidth - 7, rowY + 10, 0.3);
    }
    const conditionY = lowerY + 65;
    const conditionHeight = isPortrait ? 78 : 51;
    box(x, conditionY, leftWidth, conditionHeight, "6.- CONDICION DE LA CARGA");
    if (isPortrait) {
      check("INSPECCIONADO", x + 8, conditionY + 23, leftWidth - 16);
      check("TRATADO", x + 8, conditionY + 40, leftWidth - 16);
      check("TRATADO E INSPECCIONADO", x + 8, conditionY + 57, leftWidth - 16);
    } else {
      check("INSPECCIONADO", x + 8, conditionY + 24, 105);
      check("TRATADO", x + 120, conditionY + 24, 78);
      check("TRATADO E INSPECCIONADO", x + 202, conditionY + 24, leftWidth - 210);
    }
    const treatmentY = conditionY + conditionHeight + 4;
    box(x, treatmentY, leftWidth, lowerY + lowerHeight - treatmentY, "7 TRATAMIENTO");
    const treatmentWidth = isPortrait ? leftWidth - 14 : leftWidth - 160;
    const treatmentX = isPortrait ? x + 7 : x + 150;
    drawInline("CODIGO TRATAMIENTO", header.treatmentCode, treatmentX, treatmentY + 20, treatmentWidth, 88);
    [header.treatment, header.treatment2, header.treatment3].forEach((value, index) => {
      const rowY = treatmentY + 36 + index * 10;
      text(value, x + 8, rowY, leftWidth - 16, { size: 6.2 });
      line(x + 8, rowY + 9, x + leftWidth - 8, rowY + 9, 0.3);
    });

    box(middleX, lowerY, middleWidth, lowerHeight, "8. VERIFICACIÓN SAG PUERTO");
    if (isPortrait) {
      check("APROBADO", middleX + 10, lowerY + 27, middleWidth - 20);
      check("RECHAZADO", middleX + 10, lowerY + 44, middleWidth - 20);
    } else {
      check("APROBADO", middleX + 10, lowerY + 27, 100);
      check("RECHAZADO", middleX + 132, lowerY + 27, middleWidth - 142);
    }
    const rejectionLabelY = lowerY + (isPortrait ? 67 : 49);
    const rejectionBoxY = lowerY + (isPortrait ? 79 : 61);
    document.font("Helvetica-Bold").fontSize(6.2).fillColor(black).text("CAUSA DEL RECHAZO", middleX + 10, rejectionLabelY, { lineBreak: false });
    document.rect(middleX + 10, rejectionBoxY, middleWidth - 20, 29).lineWidth(0.55).strokeColor(black).stroke();
    const inspectorLineY = lowerY + lowerHeight - 50;
    line(middleX + 30, inspectorLineY, middleX + middleWidth - 30, inspectorLineY, 0.7);
    document.font("Helvetica-Bold").fontSize(6.4).fillColor(black).text("NOMBRE INSPECTOR", middleX + 30, inspectorLineY + 5, { width: middleWidth - 60, align: "center", lineBreak: false });
    line(middleX + 30, inspectorLineY + 30, middleX + middleWidth - 30, inspectorLineY + 30, 0.7);
    document.font("Helvetica-Bold").fontSize(6.4).fillColor(black).text("FIRMA INSPECTOR", middleX + 30, inspectorLineY + 35, { width: middleWidth - 60, align: "center", lineBreak: false });

    box(rightX, lowerY, rightWidth, lowerHeight, "9. DATOS DESPACHADOR");
    const dispatcherY = lowerY + 30;
    text(valueOf(header, "dispatcherName", "authorizedDispatcher"), rightX + 18, dispatcherY, rightWidth - 36, { size: 7, align: "center" });
    line(rightX + 18, dispatcherY + 13, rightX + rightWidth - 18, dispatcherY + 13, 0.7);
    document.font("Helvetica-Bold").fontSize(6.4).fillColor(black).text("NOMBRE INSPECTOR CONTRAPARTE", rightX + 8, dispatcherY + 20, { width: rightWidth - 16, align: "center", lineBreak: false });
    const signatureY = lowerY + lowerHeight - 35;
    line(rightX + 10, signatureY, rightX + rightWidth * 0.55 - 8, signatureY, 0.7);
    line(rightX + rightWidth * 0.55 + 8, signatureY, rightX + rightWidth - 10, signatureY, 0.7);
    document.font("Helvetica-Bold").fontSize(6.2).fillColor(black).text("FIRMA\nINSPECTOR CONTRAPARTE", rightX + 10, signatureY + 5, { width: rightWidth * 0.55 - 18, lineGap: 0 });
    document.font("Helvetica-Bold").fontSize(6.2).fillColor(black).text("TIMBRE\nSOLO DESPACHO SAG", rightX + rightWidth * 0.55 + 8, signatureY + 5, { width: rightWidth * 0.45 - 18, align: "center", lineGap: 0 });
  };

  const detailColumns = [
    ["N°", 36, "lineNumber", "right"], ["N° Folio", 78, "folio"], ["Especie", 116, "speciesName"], ["Variedad", 122, "varietyName"], ["Provincia\nOrigen", 85, "province"], ["Comuna\nOrigen", 77, "commune"], ["CSG", 58, "originCsg"], ["N° Ins.", 65, "inspectionNumber"], ["Fecha\nIns.", 61, "processDate"], ["N° de Cajas", 85, "boxes", "right"],
  ];
  const detailRows = addFolioTotals(details);
  const detailPages = paginateDetailRows(detailRows, { normalCapacity: 26, finalCapacity: 20 });
  const detailWidthUnits = detailColumns.reduce((sum, [, width]) => sum + width, 0);
  const drawAnnexHeader = () => {
    drawFrame();
    document.font("Helvetica").fontSize(7).fillColor(black).text("Fecha Impresión:", frame.x + frame.width - 135, frame.y + 8, { width: 125, align: "right", lineBreak: false });
    document.font("Helvetica-Bold").fontSize(11).fillColor(black).text("DESPACHO DE FRUTA INSPECCIONADA", frame.x + 170, frame.y + 27, { width: frame.width - 340, align: "center", lineBreak: false });
    document.font("Helvetica").fontSize(7).fillColor(black).text(`Rut: ${rut(header.companyRut, header.companyDv)}`, frame.x + 8, frame.y + 28, { width: 130, lineBreak: false });
    document.font("Helvetica-Bold").fontSize(7).fillColor(black).text("ANEXO PLANILLA DESPACHO N°", frame.x + 22, frame.y + 53, { width: 190, lineBreak: false });
    text(planilla, frame.x + 214, frame.y + 53, 75, { bold: true, size: 7 });
    document.font("Helvetica-Bold").fontSize(7).fillColor(black).text("FECHA DE EMISION:", frame.x + frame.width - 230, frame.y + 53, { width: 110, lineBreak: false });
    text(date(header.shipmentDate), frame.x + frame.width - 112, frame.y + 53, 100, { bold: true, size: 7 });
    return frame.y + 72;
  };
  const drawDetailTable = (rows, top) => {
    const tableWidth = Math.min(frame.width - 4, detailWidthUnits);
    const scale = tableWidth / detailWidthUnits;
    const columns = detailColumns.map(([label, unit, key, align]) => ({ label, width: unit * scale, key, align }));
    const headerHeight = 28;
    const rowHeight = 18;
    const tableX = frame.x + 2;
    document.rect(tableX, top, tableWidth, headerHeight).lineWidth(0.65).strokeColor(black).stroke();
    let cellX = tableX;
    columns.forEach((column) => {
      const multi = column.label.includes("\n");
      document.font("Helvetica-Bold").fontSize(6.1).fillColor(black).text(column.label, cellX + 2, top + (multi ? 4 : 9), { width: column.width - 4, align: "center", lineBreak: multi, lineGap: -0.4, ellipsis: true });
      cellX += column.width;
      line(cellX, top, cellX, top + headerHeight, 0.4);
    });
    let rowTop = top + headerHeight;
    let rowNumber = 0;
    rows.forEach((row) => {
      const totals = Boolean(row.__folioTotals);
      document.rect(tableX, rowTop, tableWidth, rowHeight).lineWidth(0.45).strokeColor(black).stroke();
      cellX = tableX;
      columns.forEach((column) => {
        let value = "";
        if (totals) {
          if (column.key === "folio") value = `Totales ${row.folio}:`;
          if (column.key === "boxes") value = number(row.boxes);
        } else if (column.key === "lineNumber") value = String(++rowNumber);
        else if (column.key === "inspectionNumber") value = valueOf((data.folios || []).find((folio) => clean(folio.folio) === clean(row.folio)), "inspectionNumber");
        else if (column.key === "processDate") value = date(row.processDate);
        else if (column.key === "boxes") value = number(row.boxes);
        else value = row[column.key];
        text(value, cellX + 2, rowTop + 5, column.width - 4, { bold: totals, size: totals ? 6.2 : 6.4, align: column.align || "left" });
        cellX += column.width;
        line(cellX, rowTop, cellX, rowTop + rowHeight, 0.35);
      });
      rowTop += rowHeight;
    });
    return { bottom: rowTop, tableWidth };
  };
  const drawAnnexFooter = (top, tableWidth) => {
    document.rect(frame.x + 2, top, tableWidth, 20).lineWidth(0.55).strokeColor(black).stroke();
    text(`Total Cajas: ${number(header.totalBoxes)}`, frame.x + 8, top + 6, 150, { bold: true, size: 6.5 });
    text(`Total Pallet: ${number(header.totalFolios)}`, frame.x + 190, top + 6, 150, { bold: true, size: 6.5 });
    const lineY = frame.y + frame.height - 55;
    const signatureWidth = 220;
    const leftX = frame.x + 80;
    const rightX = frame.x + frame.width - 300;
    text(valueOf(header, "dispatcherName", "authorizedDispatcher"), leftX, lineY - 17, signatureWidth, { size: 7, align: "center" });
    line(leftX, lineY, leftX + signatureWidth, lineY, 0.7);
    line(rightX, lineY, rightX + signatureWidth, lineY, 0.7);
    document.font("Helvetica-Bold").fontSize(7).fillColor(black).text("NOMBRE CONTRAPARTE PROFESIONAL\nO CONTRAPARTE TECNICA", leftX, lineY + 5, { width: signatureWidth, lineGap: 0, align: "center" });
    document.font("Helvetica-Bold").fontSize(7).fillColor(black).text("FIRMA CONTRAPARTE PROFESIONAL\nO CONTRAPARTE TECNICA", rightX, lineY + 5, { width: signatureWidth, lineGap: 0, align: "center" });
  };

  drawMainPage();
  let lastDetail = null;
  detailPages.forEach((rows) => {
    document.addPage({ size: "LETTER", layout, margin: 10 });
    lastDetail = drawDetailTable(rows, drawAnnexHeader());
  });
  drawAnnexFooter(lastDetail.bottom + 4, lastDetail.tableWidth);

  const pages = document.bufferedPageRange();
  for (let page = 0; page < pages.count; page += 1) {
    document.switchToPage(page);
    if (page === 0) text(`${page + 1} de ${pages.count}`, frame.x + frame.width - 92, frame.y + 37, 84, { size: 7, align: "right" });
    else text(`Página: ${page + 1} de ${pages.count}`, frame.x + frame.width - 100, frame.y + 37, 92, { size: 7, align: "right" });
  }
  document.end();
});

module.exports = { addFolioTotals, paginateDetailRows, renderDespachoPdf };
