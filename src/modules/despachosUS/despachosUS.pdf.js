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
  const parsed = value instanceof Date ? value : new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? raw || "-"
    : `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
};

const renderDespachoUSPdf = (data) =>
  new Promise((resolve, reject) => {
    const header = data.header || {};
    const folios = Array.isArray(data.folios) ? data.folios : [];
    const details = Array.isArray(data.details) ? data.details : [];
  const communes = Array.isArray(data.communes) ? data.communes : [];
    const document = new PDFDocument({
      size: "LETTER",
      layout: "portrait",
      margin: 18,
      bufferPages: true,
      info: {
        Title: `Planilla de Despacho US ${clean(header.DORNumf || header.DORNum)}`,
        Author: clean(header.companyName) || "CONEX",
      },
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const black = "#000000";
    const pageWidth = document.page.width;
    const pageHeight = document.page.height;
    const frame = { x: 18, y: 14, width: pageWidth - 36, height: pageHeight - 28 };
    const line = (x1, y1, x2, y2, width = 0.55) =>
      document.moveTo(x1, y1).lineTo(x2, y2).lineWidth(width).strokeColor(black).stroke();
    const text = (value, x, y, width, options = {}) => {
      const font = options.bold ? "Helvetica-Bold" : "Helvetica";
      const size = options.size || 7;
      const content = oneLine(value) || "-";
      document.font(font).fontSize(size).fillColor(black);
      let fitted = content;
      if (document.widthOfString(fitted) > width) {
        const suffix = "...";
        while (fitted.length > 1 && document.widthOfString(`${fitted}${suffix}`) > width) fitted = fitted.slice(0, -1);
        fitted = `${fitted}${suffix}`;
      }
      return document.text(fitted, x, y, {
        width,
        height: options.height || size + 2,
        align: options.align || "left",
        lineBreak: false,
        ellipsis: false,
      });
    };
    const box = (x, y, width, height, title) => {
      document.rect(x, y, width, height).lineWidth(0.65).strokeColor(black).stroke();
      if (clean(title)) {
        document.font("Helvetica-Bold").fontSize(7).fillColor(black).text(title, x + 6, y + 5, {
          width: width - 12,
          lineBreak: false,
          ellipsis: true,
        });
      }
    };
    const labelValue = (label, value, x, y, width, labelWidth = 76) => {
      document.font("Helvetica-Bold").fontSize(6).fillColor(black).text(label, x, y + 3, {
        width: labelWidth,
        lineBreak: false,
        ellipsis: true,
      });
      document.rect(x + labelWidth, y, width - labelWidth, 15).lineWidth(0.45).strokeColor(black).stroke();
      text(value, x + labelWidth + 3, y + 4, width - labelWidth - 6, { size: 6.3 });
    };
    const check = (label, x, y, width) => {
      text(label, x, y, width - 15, { size: 6.5 });
      document.rect(x + width - 11, y - 2, 10, 10).lineWidth(0.5).strokeColor(black).stroke();
    };

    const cargoRows = (() => {
      const grouped = new Map();
      details.forEach((row) => {
        const key = [row.speciesName, row.varietyName, row.containerName].map(oneLine).join("|");
        const current = grouped.get(key) || {
          speciesCode: row.speciesCode,
          speciesName: row.speciesName,
          varietyCode: row.varietyCode,
          varietyName: row.varietyName,
          categoryName: row.categoryName || row.categoryCode,
          containerShortName: row.containerShortName || row.containerName,
          containerName: row.containerName,
          boxes: 0,
          kilos: 0,
        };
        current.boxes += Number(row.boxes) || 0;
        current.kilos += Number(row.kilos) || 0;
        grouped.set(key, current);
      });
      return [...grouped.values()];
    })();

    const drawTable = (x, y, width, columns, rows, rowHeight = 18, headerHeight = 25) => {
      const total = columns.reduce((sum, column) => sum + column.width, 0);
      const scale = width / total;
      const scaled = columns.map((column) => ({ ...column, width: column.width * scale }));
      document.rect(x, y, width, headerHeight).lineWidth(0.65).strokeColor(black).stroke();
      let cellX = x;
      scaled.forEach((column) => {
        document.font("Helvetica-Bold").fontSize(5.6).fillColor(black).text(column.label, cellX + 2, y + 8, {
          width: column.width - 4,
          align: "center",
          lineBreak: false,
          ellipsis: true,
        });
        cellX += column.width;
        line(cellX, y, cellX, y + headerHeight, 0.4);
      });
      rows.forEach((row, rowIndex) => {
        const rowY = y + headerHeight + rowIndex * rowHeight;
        document.rect(x, rowY, width, rowHeight).lineWidth(0.4).strokeColor(black).stroke();
        cellX = x;
        scaled.forEach((column) => {
          const value = typeof column.value === "function" ? column.value(row, rowIndex) : row[column.key];
          text(value, cellX + 2, rowY + 5, column.width - 4, {
            size: 5.8,
            align: column.align || "left",
          });
          cellX += column.width;
          line(cellX, rowY, cellX, rowY + rowHeight, 0.3);
        });
      });
      return y + headerHeight + rows.length * rowHeight;
    };

    const drawCargoLayout = (x, y, width, rows) => {
      const columns = [
        { label: "REG.\nORIG.", width: 35, value: (_, index) => index + 1, align: "center" },
        { label: "ESPECIE", width: 62, key: "speciesName" },
        { label: "VARIEDAD", width: 71, key: "varietyName" },
        { label: "CODIGO\nESPECIE", width: 133, value: () => "", align: "center" },
        { label: "D\nV", width: 45, key: "speciesCode", align: "center" },
        { label: "TIPO", width: 68, key: "categoryName", align: "center" },
         { label: "CANTIDAD", width: 68, value: (row) => number(row.boxes), align: "center" },
        { label: "TIPO\nENVASE", width: 76, key: "containerShortName", align: "center" },
         { label: "KILOS\nNETOS", width: 67, value: (row) => number(row.kilos, 2), align: "center" },
         { label: "PUERTO/PAIS DESTINO", width: 148, value: () => [header.dorNpuertoD, header.destNom].filter((value) => clean(value)).join(" / "), align: "center" },
        { label: "COD\nPTO.", width: 50, value: () => header.DorPuertoD, align: "center" },
        { label: "NOMBRE", width: 109, value: () => header.consNom },
        { label: "CODIGO", width: 105, value: () => header.ConsCod, align: "center" },
      ];
      const total = columns.reduce((sum, column) => sum + column.width, 0);
      const scale = width / total;
      const scaled = columns.map((column) => ({ ...column, width: column.width * scale }));
      const headerHeight = 26;
      const rowHeight = 14;
      const totalHeight = 18;
      const endX = x + width;
      const drawGridRow = (rowY, rowHeightValue) => {
        document.rect(x, rowY, width, rowHeightValue).lineWidth(0.45).strokeColor(black).stroke();
        let cellX = x;
        scaled.forEach((column, index) => {
          if (index > 0) line(cellX, rowY, cellX, rowY + rowHeightValue, 0.3);
          cellX += column.width;
        });
      };
      document.rect(x, y, width, headerHeight).lineWidth(0.6).strokeColor(black).stroke();
      let cellX = x;
      scaled.forEach((column, index) => {
        if (index > 0) {
          const isConsigneeMiddle = index === scaled.length - 1;
          line(cellX, isConsigneeMiddle ? y + 11 : y, cellX, y + headerHeight, 0.35);
        }
        const labels = column.label.split("\n");
        const lineHeight = 5.5;
        const isConsignee = index >= scaled.length - 2;
        const labelY = y + (headerHeight - labels.length * lineHeight) / 2 + (isConsignee ? 7 : 1);
        labels.forEach((label, lineIndex) => text(label, cellX + 2, labelY + lineIndex * lineHeight, column.width - 4, { bold: true, size: 4.4, align: "center" }));
        cellX += column.width;
      });
      const consigneeStart = x + scaled.slice(0, 11).reduce((sum, column) => sum + column.width, 0);
      line(consigneeStart, y + 11, endX, y + 11, 0.3);
      text("CONSIGNATARIO", consigneeStart + 2, y + 1, endX - consigneeStart - 4, { bold: true, size: 4.4, align: "center" });
      rows.forEach((row, rowIndex) => {
        const rowY = y + headerHeight + rowIndex * rowHeight;
        drawGridRow(rowY, rowHeight);
        cellX = x;
        scaled.forEach((column) => {
          const value = typeof column.value === "function" ? column.value(row, rowIndex) : row[column.key];
           text(value, cellX + 3, rowY + 4, column.width - 6, { size: 5.2, align: column.align || "center" });
          cellX += column.width;
        });
      });
      const totalY = y + headerHeight + rows.length * rowHeight;
      document.rect(x, totalY, width, totalHeight).lineWidth(0.45).strokeColor(black).stroke();
      const columnX = (index) => x + scaled.slice(0, index).reduce((sum, column) => sum + column.width, 0);
      text("TOTAL", columnX(0) + 2, totalY + 5, columnX(6) - columnX(0) - 4, { bold: true, size: 6, align: "center" });
       text(number(header.dorTotCajas), columnX(6) + 3, totalY + 5, scaled[6].width - 6, { bold: true, size: 5.8, align: "center" });
       text(number(header.dorTotKilos, 2), columnX(8) + 3, totalY + 5, scaled[8].width - 6, { bold: true, size: 5.8, align: "center" });
      text("TOTAL DE PALLETS", columnX(9) + 2, totalY + 5, columnX(12) - columnX(9) - 4, { bold: true, size: 5.8, align: "center" });
      text(number(header.dorPalBin), columnX(12) + 2, totalY + 5, scaled[12].width - 4, { bold: true, size: 5.8, align: "center" });
       return totalY + totalHeight;
    };

    const drawMainPage = () => {
      const x = frame.x + 6;
      const width = frame.width - 12;
      const gap = 5;
      const top = frame.y + 4;
      const topHeight = 108;
      const leftWidth = (width - gap * 2) * 0.31;
      const centerWidth = (width - gap * 2) * 0.37;
      const rightWidth = width - leftWidth - centerWidth - gap * 2;
      const centerX = x + leftWidth + gap;
      const rightX = centerX + centerWidth + gap;

      // Primera fila del XPZ: identificación, encabezado de la planilla y control SAG.
      box(x, top, leftWidth, topHeight, "1.- IDENTIFICACION CENTRO");
      labelValue("FOLIO ORIGEN", header.DORNumf || header.DORNum, x + 8, top + 24, leftWidth - 16, 68);
      labelValue("REG. PROV. COMUNA", header.companyCommuneCode, x + 8, top + 44, leftWidth - 16, 82);
      labelValue("NOMBRE DE PLANTA", header.companyName, x + 8, top + 64, leftWidth - 16, 82);
      labelValue("NRO. INSCRIPCION PLANTA", header.companySAGCode || header.EmpCodSAG, x + 8, top + 84, leftWidth - 16, 82);

      box(centerX, top, centerWidth, topHeight, "");
      text(header.companyName, centerX + 8, top + 18, centerWidth - 16, { bold: true, size: 9, align: "center" });
      text("PLANILLA DE DESPACHO DE FRUTA", centerX + 8, top + 48, centerWidth - 16, { bold: true, size: 10.5, align: "center" });
      text("A SER FUMIGADA EN U.S.A.", centerX + 8, top + 65, centerWidth - 16, { bold: true, size: 7.5, align: "center" });

      box(rightX, top, rightWidth, topHeight, "2.- CONTROL SAG");
      text("FOLIO PUERTO", rightX + 8, top + 29, 62, { bold: true, size: 6 });
      const folioPuertoX = rightX + 70;
      const folioPuertoBoxWidth = 10;
      const folioPuertoBoxStep = 11;
      for (let index = 0; index < 8; index += 1) {
        document.rect(folioPuertoX + index * folioPuertoBoxStep, top + 24, folioPuertoBoxWidth, 15).lineWidth(0.45).strokeColor(black).stroke();
      }
      text("REVISION", rightX + 8, top + 49, 58, { bold: true, size: 6 });
      const rawDate = clean(header.DorFecha).slice(0, 10);
      const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate.split("-") : ["", "", ""];
      const revisionValues = [parsedDate[2], parsedDate[1], parsedDate[0] ? parsedDate[0].slice(-2) : ""];
      const revisionLabels = ["DD", "MM", "AA"];
      let revisionX = rightX + 70;
      revisionValues.forEach((value, index) => {
        document.rect(revisionX, top + 47, 22, 15).lineWidth(0.45).strokeColor(black).stroke();
        if (value) text(value, revisionX + 2, top + 51, 18, { size: 6, align: "center" });
        text(revisionLabels[index], revisionX + 2, top + 65, 18, { size: 5.2, align: "center" });
        revisionX += 28;
      });

      const secondY = top + topHeight + gap;
      const secondHeight = 110;
      const exporterWidth = (width - gap) * 0.30;
      const transportWidth = width - exporterWidth - gap;
      const transportX = x + exporterWidth + gap;

      box(x, secondY, exporterWidth, secondHeight, "3.-");
      labelValue("EXPORT.", header.expNom, x + 8, secondY + 26, exporterWidth - 16, 52);
      labelValue("RUT", `${clean(header.expRut)}${clean(header.expDv) ? `-${clean(header.expDv)}` : ""}`, x + 8, secondY + 48, exporterWidth - 16, 52);

      box(transportX, secondY, transportWidth, secondHeight, "4.- TRANSPORTE Y DESTINO");
      const transportLeftX = transportX + 8;
      const transportColumnGap = 4;
      const transportRightX = transportX + 206;
      const transportLeftWidth = transportRightX - transportLeftX - transportColumnGap;
      const transportRightWidth = transportWidth - 214;
      const transportLeftLabelWidth = 78;
      const transportRightLabelWidth = 86;
      labelValue("FECHA DESPACHO", date(header.DorFecha), transportLeftX, secondY + 22, transportLeftWidth, transportLeftLabelWidth);
      labelValue("PUERTO DE EMBARQUE", header.dorNPuertoE, transportRightX, secondY + 22, transportRightWidth, transportRightLabelWidth);
      labelValue("GUIAS(S) DESPACHO", header.DorNguia, transportLeftX, secondY + 43, transportWidth - 16, transportLeftLabelWidth);
      labelValue("TIPO TRANSPORTE", header.dorTipoTrans, transportLeftX, secondY + 64, transportLeftWidth, transportLeftLabelWidth);
      labelValue("PATENTE(S)", header.dorPatente, transportRightX, secondY + 64, transportRightWidth, transportRightLabelWidth);
      labelValue("SELLO(S)/N.", header.dorNSellos, transportLeftX, secondY + 85, transportLeftWidth, transportLeftLabelWidth);
      labelValue("UBICACION", header.dorUbicacion, transportRightX, secondY + 85, transportRightWidth, transportRightLabelWidth);

      const cargoY = secondY + secondHeight + gap;
      text("5.", x + 2, cargoY + 1, 18, { bold: true, size: 7 });
      const mainRows = cargoRows.slice(0, 6);
      const cargoEndY = drawCargoLayout(x, cargoY + 10, width, mainRows);

      const lowerY = cargoEndY + gap;
      const lowerHeight = 180;
      const lowerGap = 4;
      const agentWidth = (width - lowerGap * 2) * 0.25;
      const controlWidth = (width - lowerGap * 2) * 0.40;
      const verifyWidth = width - agentWidth - controlWidth - lowerGap * 2;
      const controlX = x + agentWidth + lowerGap;
      const verifyX = controlX + controlWidth + lowerGap;

      box(x, lowerY, agentWidth, lowerHeight, "6.-");
      text("AGENTE", x + 10, lowerY + 18, agentWidth - 20, { bold: true, size: 6 });
      labelValue("EMBARCADOR", header.ageNom, x + 10, lowerY + 24, agentWidth - 20, 48);
      labelValue("RUT", `${clean(header.ageRut)}${clean(header.ageDv) ? `-${clean(header.ageDv)}` : ""}`, x + 10, lowerY + 48, agentWidth - 20, 40);
      labelValue("NAVE", header.dorNave, x + 10, lowerY + 72, agentWidth - 20, 40);
      line(x + 10, lowerY + lowerHeight - 42, x + agentWidth - 10, lowerY + lowerHeight - 42, 0.6);
      text("FIRMA Y TIMBRE AGENTE", x + 10, lowerY + lowerHeight - 36, agentWidth - 20, { size: 5.8, align: "center" });

      box(controlX, lowerY, controlWidth, lowerHeight, "7.- ORIGEN FRUTA");
      text("PROVINCIA(S) COMUNA(S)", controlX + 10, lowerY + 20, controlWidth - 20, { size: 6.1, align: "center" });
      const observationText = oneLine(header.dorObs1);
      const originRows = [observationText.slice(0, 80), observationText.slice(80, 160), observationText.slice(160, 240)];
      for (let index = 0; index < 3; index += 1) {
        const rowY = lowerY + 34 + index * 14;
        if (originRows[index]) text(originRows[index], controlX + 10, rowY, controlWidth - 20, { size: 5.8 });
        line(controlX + 10, rowY + 10, controlX + controlWidth - 10, rowY + 10, 0.3);
      }
      const controlSectionY = lowerY + 78;
      line(controlX, controlSectionY, controlX + controlWidth, controlSectionY, 0.55);
      text("8.- CONTROL SAG PUERTO", controlX + 10, controlSectionY + 7, controlWidth - 20, { bold: true, size: 7 });
      line(controlX + 20, lowerY + lowerHeight - 18, controlX + controlWidth / 2 - 8, lowerY + lowerHeight - 18, 0.6);
      line(controlX + controlWidth / 2 + 8, lowerY + lowerHeight - 18, controlX + controlWidth - 20, lowerY + lowerHeight - 18, 0.6);
      text("NOMBRE INSPECTOR", controlX + 16, lowerY + lowerHeight - 12, controlWidth / 2 - 24, { size: 5.6, align: "center" });
      text("TIMBRE", controlX + controlWidth / 2 + 8, lowerY + lowerHeight - 12, controlWidth / 2 - 24, { size: 5.6, align: "center" });

      box(verifyX, lowerY, verifyWidth, lowerHeight, "9.- VERIFICACION DESPACHO");
      text(header.daNombre, verifyX + 28, lowerY + 30, Math.min(160, verifyWidth - 40), { size: 6.2, align: "center" });
      line(verifyX + 24, lowerY + 45, verifyX + Math.min(184, verifyWidth - 14), lowerY + 45, 0.6);
      text("NOMBRE CONTRAPARTE", verifyX + 24, lowerY + 50, Math.min(160, verifyWidth - 38), { size: 5.8, align: "center" });
      const signatureY = lowerY + lowerHeight - 52;
      line(verifyX + 12, signatureY, verifyX + verifyWidth * 0.48 - 8, signatureY, 0.6);
      line(verifyX + verifyWidth * 0.63, signatureY, verifyX + verifyWidth - 12, signatureY, 0.6);
      text("FIRMA CONTRAPARTE", verifyX + 12, signatureY + 6, verifyWidth * 0.48 - 20, { size: 5.8, align: "center" });
      text("TIMBRE", verifyX + verifyWidth * 0.63, signatureY + 6, verifyWidth * 0.37 - 12, { size: 5.8, align: "center" });
    };

    const drawPackingListPage = () => {
      const packingRows = [];
      const folioTotals = new Map();
      const detailTotals = new Map();
      const firstRowByFolio = new Set();
      const lastRowByFolio = new Map();

      folios.forEach((item) => {
        const key = clean(item.folio);
        if (key) folioTotals.set(key, Number(item.boxes) || 0);
      });
      details.forEach((row, index) => {
        const key = clean(row.folio);
        detailTotals.set(key, (detailTotals.get(key) || 0) + (Number(row.boxes) || 0));
        lastRowByFolio.set(key, index);
      });

      let folioSequence = 0;
      details.forEach((row, index) => {
        const folio = clean(row.folio);
        const isFirst = !firstRowByFolio.has(folio);
        if (isFirst) {
          firstRowByFolio.add(folio);
          folioSequence += 1;
        }
        const isLast = lastRowByFolio.get(folio) === index;
        packingRows.push({
          ...row,
          sequenceLabel: isFirst ? folioSequence : "",
          folioLabel: isFirst ? folio : "",
          detailBoxes: Number(row.boxes) || 0,
          folioBoxes: isLast ? (folioTotals.get(folio) ?? detailTotals.get(folio) ?? 0) : 0,
        });
      });

      if (!packingRows.length) {
        folios.forEach((item, index) => {
          const folio = clean(item.folio);
          packingRows.push({
            ...item,
            sequenceLabel: index + 1,
            folioLabel: folio,
            detailBoxes: Number(item.boxes) || 0,
            folioBoxes: Number(item.boxes) || 0,
          });
        });
      }

      const uniqueFolios = new Set(packingRows.map((row) => clean(row.folio)).filter(Boolean));
      const totalBoxes = packingRows.reduce((sum, row) => sum + (Number(row.detailBoxes) || 0), 0)
        || Number(header.dorTotCajas)
        || 0;
      const totalPallets = uniqueFolios.size || Number(header.dorTotFol) || 0;
      const columns = [
        { label: "N°", width: 28, key: "sequenceLabel", align: "center" },
        { label: "N° Folio", width: 72, key: "folioLabel", align: "center" },
        {
          label: "N° de Cajas",
          width: 88,
          value: (row) => [row.detailBoxes, row.folioBoxes || ""].filter((value) => value !== "").map((value) => number(value)).join("   "),
          align: "center",
        },
        { label: "F.Emb.", width: 60, value: (row) => date(row.processDate), align: "center" },
        { label: "Productor", width: 115, key: "producerName" },
        { label: "Provincia", width: 75, key: "province" },
        { label: "Comuna", width: 70, key: "commune" },
        { label: "IDG", width: 57, key: "producerExternalCode", align: "center" },
        { label: "Packing - IDP", width: 120, key: "packingName" },
        { label: "Provincia", width: 80, key: "packingProvince" },
        { label: "Comuna", width: 80, key: "packingCommune" },
        { label: "Especie", width: 50, key: "speciesName" },
        { label: "Variedad", width: 70, key: "varietyName" },
      ];
      const tableWidth = frame.width;
      const totalColumnWidth = columns.reduce((sum, column) => sum + column.width, 0);
      const scale = tableWidth / totalColumnWidth;
      const scaled = columns.map((column) => ({ ...column, width: column.width * scale }));
      const rowsPerPage = 24;
      let offset = 0;
      let pageNumber = 0;

      do {
        document.addPage({ size: "LETTER", layout: "portrait", margin: 18 });
        pageNumber += 1;
        const x = frame.x;
        const right = x + frame.width;
        const top = 18;
        const pageBottom = document.page.height - 18;
        document.rect(x, top, frame.width, pageBottom - top).lineWidth(0.65).strokeColor(black).stroke();

        text(header.companyName, x + 8, top + 8, 250, { bold: true, size: 7.2 });
        text(header.companyBusiness, x + 8, top + 21, 220, { size: 6.5 });
        text(header.companyAddress, x + 8, top + 34, 220, { size: 6.5 });
        text(`Rut: ${clean(header.companyRut)}${clean(header.companyDv) ? `-${clean(header.companyDv)}` : ""}`, x + 8, top + 47, 150, { size: 6.5 });
        text("Fecha Impresión:", right - 145, top + 8, 82, { bold: true, size: 6.5, align: "right" });
        text(date(new Date()), right - 58, top + 8, 50, { size: 6.5, align: "right" });
        text("PACKING LIST", x + 150, top + 34, frame.width - 300, { bold: true, size: 10, align: "center" });
        text(`PLANILLA DE DESPACHO N°: ${clean(header.DORNumf || header.DORNum)}`, x + 110, top + 50, frame.width - 220, { bold: true, size: 8, align: "center" });
        text(`FECHA DE DESPACHO: ${date(header.DorFecha)}`, x + 8, top + 73, 180, { bold: true, size: 6.5 });

        const tableY = top + 92;
        const headerHeight = 20;
        const rowHeight = 15;
        const pageRows = packingRows.slice(offset, offset + rowsPerPage);
        document.rect(x, tableY, tableWidth, headerHeight).lineWidth(0.6).strokeColor(black).stroke();
        let cellX = x;
        scaled.forEach((column) => {
          text(column.label, cellX + 2, tableY + 8, column.width - 4, { bold: true, size: 5.4, align: "center" });
          cellX += column.width;
          if (cellX < right - 0.5) line(cellX, tableY, cellX, tableY + headerHeight, 0.35);
        });
        pageRows.forEach((row, rowIndex) => {
          const rowY = tableY + headerHeight + rowIndex * rowHeight;
          document.rect(x, rowY, tableWidth, rowHeight).lineWidth(0.4).strokeColor(black).stroke();
          cellX = x;
          scaled.forEach((column) => {
            const raw = typeof column.value === "function" ? column.value(row, rowIndex) : row[column.key];
            text(raw, cellX + 2, rowY + 4, column.width - 4, { size: 5.1, align: "center" });
            cellX += column.width;
            if (cellX < right - 0.5) line(cellX, rowY, cellX, rowY + rowHeight, 0.3);
          });
        });

        const tableBottom = tableY + headerHeight + pageRows.length * rowHeight;
        offset += pageRows.length;
        const isLastPage = offset >= packingRows.length;
        if (isLastPage) {
          const totalY = Math.min(tableBottom + 8, pageBottom - 178);
          const totalHeight = 22;
          const boxesColumnStart = x + scaled.slice(0, 2).reduce((sum, column) => sum + column.width, 0);
          const boxesColumnCenter = boxesColumnStart + scaled[2].width / 2;
          document.rect(x, totalY, tableWidth, totalHeight).lineWidth(0.5).strokeColor(black).stroke();
          text("Total Cajas:", x + 8, totalY + 7, 50, { bold: true, size: 6.7 });
          text(number(totalBoxes), boxesColumnCenter - 22, totalY + 7, 44, { bold: true, size: 7, align: "center" });
          text("Total Pallet:", x + tableWidth - 160, totalY + 7, 75, { bold: true, size: 6.7 });
          text(number(totalPallets), x + tableWidth - 68, totalY + 7, 48, { bold: true, size: 7, align: "center" });

          const signatureTop = pageBottom - 128;
          line(x + 36, signatureTop + 18, x + 184, signatureTop + 18, 0.6);
          line(x + tableWidth / 2, signatureTop + 18, x + tableWidth / 2 + 148, signatureTop + 18, 0.6);
          text(header.daNombre, x + 36, signatureTop + 2, 148, { size: 6.2, align: "center" });
          text("NOMBRE CONTRAPARTE PROFESIONAL", x + 36, signatureTop + 29, 148, { bold: true, size: 5.8, align: "center" });
          text("O CONTRAPARTE TECNICA", x + 36, signatureTop + 42, 148, { bold: true, size: 5.8, align: "center" });
          text("FIRMA CONTRAPARTE PROFESIONAL", x + tableWidth / 2, signatureTop + 29, 148, { bold: true, size: 5.8, align: "center" });
          text("O CONTRAPARTE TECNICA", x + tableWidth / 2, signatureTop + 42, 148, { bold: true, size: 5.8, align: "center" });
        }
      } while (offset < packingRows.length || pageNumber === 0);
    };

    drawMainPage();
    drawPackingListPage();
    document.end();
  });

module.exports = { renderDespachoUSPdf };
