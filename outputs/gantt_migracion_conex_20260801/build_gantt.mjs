import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workDir = path.resolve("outputs/gantt_migracion_conex_20260801");
const outputPath = path.join(workDir, "Carta_Gantt_Migracion_CONEX_Comercial_Ago-Oct_2026.xlsx");
const sourceSummaryPath = path.join(workDir, "inventory_extracted_summary.json");

const sourceSummary = JSON.parse(await fs.readFile(sourceSummaryPath, "utf8"));

const COLORS = {
  darkGray: "#595959",
  mediumGray: "#BFBFBF",
  lightGray: "#E7E6E6",
  title: "#666666",
  peach: "#FCE4D6",
  mainGreen: "#76933C",
  phaseBlue: "#4F81BD",
  lightBlue: "#D9EAF7",
  lightGreen: "#E2F0D9",
  barBlue: "#5B9BD5",
  barBlueSoft: "#9DC3E6",
  barGreen: "#70AD47",
  barGreenSoft: "#A9D18E",
  white: "#FFFFFF",
  text: "#222222",
  border: "#D9D9D9",
};

function d(year, month, day) {
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start, end) {
  return Math.round((end - start) / 86400000) + 1;
}

function colName(index) {
  let n = index;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function fmtDateForNote(date) {
  return date.toISOString().slice(0, 10);
}

function normalizePercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const phases = [
  {
    id: "1",
    name: "Inicio, alcance y planificación",
    color: "blue",
    tasks: [
      { id: "1.1", name: "Kickoff y gobierno del proyecto", start: d(2026, 8, 3), end: d(2026, 8, 5), progress: 0.4 },
      { id: "1.2", name: "Validación de alcance y módulos prioritarios", start: d(2026, 8, 3), end: d(2026, 8, 12), progress: 0.6 },
      { id: "1.3", name: "Plan de entregas y criterios de aceptación", start: d(2026, 8, 10), end: d(2026, 8, 14), progress: 0.2 },
    ],
  },
  {
    id: "2",
    name: "Base técnica y arquitectura",
    color: "blue",
    tasks: [
      { id: "2.1", name: "Definición de base operativa y multiempresa", start: d(2026, 8, 10), end: d(2026, 8, 21), progress: 0.2 },
      { id: "2.2", name: "Preparación de esquema, conectores y APIs base", start: d(2026, 8, 17), end: d(2026, 9, 4), progress: 0.15 },
      { id: "2.3", name: "Contratos comunes, auditoría y trazabilidad", start: d(2026, 8, 31), end: d(2026, 9, 11), progress: 0.1 },
    ],
  },
  {
    id: "3",
    name: "Seguridad y permisos",
    color: "blue",
    tasks: [
      { id: "3.1", name: "Autenticación, sesión y roles", start: d(2026, 8, 17), end: d(2026, 8, 28), progress: 0.55 },
      { id: "3.2", name: "Permisos por sistema, módulo y programa", start: d(2026, 8, 24), end: d(2026, 9, 11), progress: 0.35 },
      { id: "3.3", name: "Menú autorizado y validación de accesos", start: d(2026, 9, 7), end: d(2026, 9, 18), progress: 0.15 },
    ],
  },
  {
    id: "4",
    name: "Maestros y catálogos GX8",
    color: "blue",
    tasks: [
      { id: "4.1", name: "Catálogos base de temporada, especies, envases y productores", start: d(2026, 9, 1), end: d(2026, 9, 18), progress: 0.25 },
      { id: "4.2", name: "Clientes, agentes, consignatarios y exportadoras", start: d(2026, 9, 14), end: d(2026, 10, 2), progress: 0.05 },
      { id: "4.3", name: "Parámetros, monedas, puertos y tipos de movimiento", start: d(2026, 9, 28), end: d(2026, 10, 16), progress: 0 },
      { id: "4.4", name: "Reglas GX8, niveles padre-detalle y exportaciones", start: d(2026, 10, 5), end: d(2026, 10, 23), progress: 0 },
    ],
  },
  {
    id: "5",
    name: "Procesos operacionales",
    color: "blue",
    tasks: [
      { id: "5.1", name: "Configuración de líneas y órdenes de proceso", start: d(2026, 9, 21), end: d(2026, 10, 9), progress: 0 },
      { id: "5.2", name: "Ingreso de folios, captura y lectura de cajas", start: d(2026, 10, 5), end: d(2026, 10, 23), progress: 0 },
      { id: "5.3", name: "Paletizado, repaletizaje y control de stock", start: d(2026, 10, 12), end: d(2026, 10, 30), progress: 0 },
    ],
  },
  {
    id: "6",
    name: "Despachos, guías y documentos",
    color: "blue",
    tasks: [
      { id: "6.1", name: "Guías de despacho y documentos operacionales", start: d(2026, 10, 5), end: d(2026, 10, 23), progress: 0 },
      { id: "6.2", name: "Despachos, anulaciones y reversas", start: d(2026, 10, 12), end: d(2026, 10, 30), progress: 0 },
      { id: "6.3", name: "Packing list, multipuerto y exportadora", start: d(2026, 10, 19), end: d(2026, 10, 30), progress: 0 },
    ],
  },
  {
    id: "7",
    name: "Reportes, regulatorios y etiquetas",
    color: "blue",
    tasks: [
      { id: "7.1", name: "Consultas y reportes comerciales", start: d(2026, 10, 5), end: d(2026, 10, 23), progress: 0 },
      { id: "7.2", name: "SAG, USDA e inspecciones", start: d(2026, 10, 12), end: d(2026, 10, 30), progress: 0 },
      { id: "7.3", name: "Etiquetas y formatos por destino", start: d(2026, 10, 19), end: d(2026, 10, 30), progress: 0 },
    ],
  },
  {
    id: "8",
    name: "QA, UAT y cierre comercial",
    color: "green",
    tasks: [
      { id: "8.1", name: "Pruebas funcionales por módulo", start: d(2026, 10, 12), end: d(2026, 10, 30), progress: 0 },
      { id: "8.2", name: "UAT con usuarios clave", start: d(2026, 10, 19), end: d(2026, 10, 30), progress: 0 },
      { id: "8.3", name: "Capacitación, ajustes y plan de salida", start: d(2026, 10, 26), end: d(2026, 10, 30), progress: 0 },
    ],
  },
];

const rows = [];
const overall = {
  kind: "overall",
  id: "0",
  name: "Migración comercial CONEX GX8 a plataforma web",
  start: d(2026, 8, 1),
  end: d(2026, 10, 30),
  color: "green",
};
rows.push(overall);

for (const phase of phases) {
  const start = new Date(Math.min(...phase.tasks.map((task) => task.start.getTime())));
  const end = new Date(Math.max(...phase.tasks.map((task) => task.end.getTime())));
  const phaseRow = { kind: "phase", id: phase.id, name: phase.name, start, end, color: phase.color, phase };
  rows.push(phaseRow);
  for (const task of phase.tasks) rows.push({ kind: "task", color: phase.color, ...task });
}

const workbook = Workbook.create();
const gantt = workbook.worksheets.add("Gantt CONEX");
const macro = workbook.worksheets.add("Vision Macro");
const assumptions = workbook.worksheets.add("Supuestos");

for (const sheet of [gantt, macro, assumptions]) sheet.showGridLines = false;

const projectStart = d(2026, 8, 1);
const projectEnd = d(2026, 10, 30);
const weeks = [];
for (let current = new Date(projectStart); current <= projectEnd; current = addDays(current, 7)) {
  weeks.push(new Date(current));
}
const firstTimelineCol = 11;
const lastTimelineCol = firstTimelineCol + weeks.length - 1;
const lastTimelineColName = colName(lastTimelineCol);
const lastDataRow = 6 + rows.length;
const totalRow = lastDataRow + 1;

function setRangeStyle(sheet, range, style) {
  sheet.getRange(range).format = style;
}

function writeCell(sheet, address, value) {
  sheet.getRange(address).values = [[value]];
}

function writeFormula(sheet, address, formula) {
  sheet.getRange(address).formulas = [[formula]];
}

function styleGanttBase() {
  gantt.getRange(`A1:${lastTimelineColName}${totalRow + 6}`).format = {
    font: { typeface: "Calibri", fontSize: 10, color: COLORS.text },
    fill: COLORS.white,
  };
  gantt.getRange("A1:A80").format.columnWidth = 2;
  gantt.getRange("B1:B80").format.columnWidth = 8;
  gantt.getRange("C1:C80").format.columnWidth = 31;
  gantt.getRange("D1:D80").format.columnWidth = 21;
  gantt.getRange("E1:E80").format.columnWidth = 13;
  gantt.getRange("F1:G80").format.columnWidth = 13;
  gantt.getRange("H1:H80").format.columnWidth = 8;
  gantt.getRange("I1:J80").format.columnWidth = 2.5;
  gantt.getRange(`K1:${lastTimelineColName}80`).format.columnWidth = 4.1;
  gantt.getRange("1:1").format.rowHeight = 32;
  gantt.getRange("2:5").format.rowHeight = 22;
  gantt.getRange("6:6").format.rowHeight = 24;
  gantt.getRange(`7:${totalRow}`).format.rowHeight = 22;

  gantt.getRange("C1:H1").merge();
  writeCell(gantt, "C1", "Carta Gantt Migración CONEX");
  setRangeStyle(gantt, "C1:H1", {
    font: { bold: true, fontSize: 22, color: COLORS.title },
    horizontalAlignment: "left",
  });

  gantt.getRange("C2:H2").merge();
  writeCell(gantt, "C2", "Cliente: CONEX");
  setRangeStyle(gantt, "C2:H2", {
    font: { fontSize: 14, color: COLORS.text },
  });

  writeCell(gantt, "D3", "Inicio del proyecto:");
  writeFormula(gantt, "F3", "=F7");
  writeCell(gantt, "D4", "Término del proyecto:");
  writeFormula(gantt, "F4", "=G7");
  setRangeStyle(gantt, "D3:D4", { horizontalAlignment: "right", font: { fontSize: 10, color: COLORS.text } });
  setRangeStyle(gantt, "F3:F4", {
    borders: { preset: "all", style: "thin", color: "#808080" },
    horizontalAlignment: "center",
    numberFormat: "d-m-yy",
  });

  writeCell(gantt, "C4", "ITEMS RELEVANTES");
  setRangeStyle(gantt, "C4:D4", {
    fill: COLORS.peach,
    font: { color: COLORS.text },
  });

  const headerRange = `B6:H6`;
  gantt.getRange("C6:D6").merge();
  gantt.getRange(headerRange).values = [["ID", "TAREA", null, "PROGRESO", "INICIO", "FIN", "DÍAS"]];
  setRangeStyle(gantt, headerRange, {
    fill: COLORS.darkGray,
    font: { bold: true, color: COLORS.white },
    horizontalAlignment: "center",
    borders: { preset: "all", style: "thin", color: "#808080" },
  });
  gantt.getRange("C6:D6").format.horizontalAlignment = "left";
}

function styleTimelineHeader() {
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  let startIdx = 0;
  while (startIdx < weeks.length) {
    const month = weeks[startIdx].getMonth();
    const year = weeks[startIdx].getFullYear();
    let endIdx = startIdx;
    while (endIdx + 1 < weeks.length && weeks[endIdx + 1].getMonth() === month && weeks[endIdx + 1].getFullYear() === year) {
      endIdx += 1;
    }
    const startCol = colName(firstTimelineCol + startIdx);
    const endCol = colName(firstTimelineCol + endIdx);
    gantt.getRange(`${startCol}2:${endCol}2`).merge();
    writeCell(gantt, `${startCol}2`, `${months[month]} ${year}`);
    setRangeStyle(gantt, `${startCol}2:${endCol}2`, {
      font: { color: COLORS.text, fontSize: 10 },
      horizontalAlignment: "center",
    });
    startIdx = endIdx + 1;
  }

  const weekDates = weeks.map((week) => week.getDate());
  const weekLabels = weeks.map((_, idx) => `S${idx + 1}`);
  gantt.getRange(`K4:${lastTimelineColName}4`).values = [weekDates];
  gantt.getRange(`K5:${lastTimelineColName}5`).values = [weekLabels];
  setRangeStyle(gantt, `K4:${lastTimelineColName}4`, {
    fill: COLORS.lightGray,
    font: { color: COLORS.text, fontSize: 8 },
    horizontalAlignment: "center",
    numberFormat: "0",
    borders: { preset: "all", style: "thin", color: COLORS.border },
  });
  setRangeStyle(gantt, `K5:${lastTimelineColName}6`, {
    fill: COLORS.darkGray,
    font: { color: COLORS.white, fontSize: 8 },
    horizontalAlignment: "center",
    borders: { preset: "all", style: "thin", color: "#808080" },
  });
}

function writeGanttRows() {
  const data = rows.map((row) => [0, row.id, row.name, null, row.progress ?? null, row.start, row.end, null]);
  gantt.getRange(`A7:H${lastDataRow}`).values = data;
  gantt.getRange(`C7:D${lastDataRow}`).merge(true);
  gantt.getRange(`F7:G${lastDataRow}`).format.numberFormat = "d-m-yy";
  gantt.getRange(`E7:E${lastDataRow}`).format.numberFormat = "0%";
  gantt.getRange(`H7:H${lastDataRow}`).format.numberFormat = "0";
  gantt.getRange(`B7:B${lastDataRow}`).format.horizontalAlignment = "center";
  gantt.getRange(`E7:H${lastDataRow}`).format.horizontalAlignment = "center";
  gantt.getRange(`C7:D${lastDataRow}`).format.wrapText = true;

  for (let i = 0; i < rows.length; i += 1) {
    const excelRow = 7 + i;
    writeFormula(gantt, `H${excelRow}`, `=G${excelRow}-F${excelRow}+1`);
    if (rows[i].kind === "task") {
      writeFormula(gantt, `A${excelRow}`, `=H${excelRow}`);
    } else {
      writeCell(gantt, `A${excelRow}`, 0);
    }
  }

  const phaseStarts = [];
  let cursor = 8;
  for (const phase of phases) {
    const phaseRow = cursor;
    const childStart = cursor + 1;
    const childEnd = cursor + phase.tasks.length;
    phaseStarts.push({ phaseRow, childStart, childEnd });
    writeFormula(gantt, `F${phaseRow}`, `=MIN(F${childStart}:F${childEnd})`);
    writeFormula(gantt, `G${phaseRow}`, `=MAX(G${childStart}:G${childEnd})`);
    writeFormula(gantt, `E${phaseRow}`, `=IFERROR(SUMPRODUCT(E${childStart}:E${childEnd},A${childStart}:A${childEnd})/SUM(A${childStart}:A${childEnd}),0)`);
    cursor = childEnd + 1;
  }

  writeCell(gantt, "F7", projectStart);
  writeFormula(gantt, "G7", `=MAX(G8:G${lastDataRow})`);
  writeFormula(gantt, "E7", `=IFERROR(SUMPRODUCT(E8:E${lastDataRow},A8:A${lastDataRow})/SUM(A8:A${lastDataRow}),0)`);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const excelRow = 7 + i;
    const range = `B${excelRow}:H${excelRow}`;
    if (row.kind === "overall") {
      setRangeStyle(gantt, range, {
        fill: COLORS.mainGreen,
        font: { bold: true, color: COLORS.white, fontSize: 12 },
        borders: { preset: "all", style: "thin", color: "#808080" },
      });
    } else if (row.kind === "phase") {
      const fill = row.color === "green" ? COLORS.mainGreen : COLORS.phaseBlue;
      setRangeStyle(gantt, range, {
        fill,
        font: { bold: true, color: COLORS.white, fontSize: 11 },
        borders: { preset: "all", style: "thin", color: "#808080" },
      });
    } else {
      const fill = row.color === "green" ? COLORS.lightGreen : COLORS.lightBlue;
      setRangeStyle(gantt, range, {
        fill,
        font: { color: COLORS.text, fontSize: 10 },
        borders: { preset: "all", style: "thin", color: COLORS.border },
      });
      setRangeStyle(gantt, `E${excelRow}:E${excelRow}`, {
        fill: COLORS.mediumGray,
        horizontalAlignment: "center",
        numberFormat: "0%",
      });
    }
  }

  setRangeStyle(gantt, `A7:A${lastDataRow}`, {
    font: { color: COLORS.white },
    fill: COLORS.white,
  });

  gantt.getRange(`C${totalRow}:G${totalRow}`).merge();
  writeCell(gantt, `C${totalRow}`, "Total días");
  writeFormula(gantt, `H${totalRow}`, "=H7");
  setRangeStyle(gantt, `C${totalRow}:H${totalRow}`, {
    fill: "#A6A6A6",
    font: { color: COLORS.text, bold: true },
    horizontalAlignment: "right",
    borders: { preset: "all", style: "thin", color: "#808080" },
  });
  gantt.getRange(`H${totalRow}`).format.horizontalAlignment = "center";
}

function paintTimelineBars() {
  setRangeStyle(gantt, `K7:${lastTimelineColName}${lastDataRow}`, {
    fill: COLORS.white,
    borders: { preset: "all", style: "thin", color: COLORS.border },
  });

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const excelRow = 7 + i;
    let fill;
    if (row.kind === "overall") fill = COLORS.barGreen;
    else if (row.kind === "phase") fill = row.color === "green" ? COLORS.barGreen : COLORS.barBlue;
    else fill = row.color === "green" ? COLORS.barGreenSoft : COLORS.barBlueSoft;

    for (let j = 0; j < weeks.length; j += 1) {
      const weekStart = weeks[j];
      const weekEnd = addDays(weekStart, 6);
      if (weekStart <= row.end && weekEnd >= row.start) {
        const col = colName(firstTimelineCol + j);
        setRangeStyle(gantt, `${col}${excelRow}:${col}${excelRow}`, {
          fill,
          borders: { preset: "all", style: "thin", color: COLORS.white },
        });
      }
    }
  }
}

function buildMacroSheet() {
  const typeRows = sourceSummary.byType.map((item) => [item.name, item.count]);
  const topFolders = sourceSummary.topFolders.slice(0, 18).map((item) => [item.name, item.count]);
  const totalObjects = sourceSummary.totals.allObjects;
  const fronts = [
    ["Seguridad y permisos", 30, "Modelo de sesión, roles y autorización VA2."],
    ["Maestros y catálogos", 61, "Base funcional para operar temporada, especies, productores, clientes y catálogos."],
    ["Operación de empaque y bodega", 160, "Órdenes, folios, líneas, captura, paletizado, repaletizaje y stock."],
    ["Despachos, guías y documentos", 103, "Documentos operacionales, despachos, anulaciones y packing list."],
    ["Regulatorio, inspecciones y etiquetas", 66, "SAG, USDA, inspecciones, folios y etiquetas por destino."],
    ["Consultas, reportes e integraciones", 126, "Consultas gerenciales, reportes, exportaciones y servicios transversales."],
    ["Base técnica y datos", 228, "Tablas, atributos, dependencias, esquema, conversión de datos y QA técnico."],
  ];

  writeCell(macro, "A1", "Visión Macro de Migración CONEX");
  setRangeStyle(macro, "A1:F1", {
    font: { bold: true, fontSize: 18, color: COLORS.title },
    horizontalAlignment: "left",
  });
  writeCell(macro, "A2", "Resumen comercial construido desde el inventario GX8 y la documentación de migración.");
  setRangeStyle(macro, "A2:F2", { font: { fontSize: 11, color: COLORS.text } });

  macro.getRange("A4:D4").values = [["Frente comercial", "Objetos asociados", "% referencial", "Comentario"]];
  macro.getRange(`A5:D${4 + fronts.length}`).values = fronts.map(([name, count, comment]) => [name, count, null, comment]);
  for (let row = 5; row <= 4 + fronts.length; row += 1) {
    writeFormula(macro, `C${row}`, `=B${row}/$B$${5 + fronts.length}`);
  }
  macro.getRange(`A${5 + fronts.length}:D${5 + fronts.length}`).values = [["Total inventario base", totalObjects, 1, "774 objetos GX identificados como universo de referencia."]];
  setRangeStyle(macro, "A4:D4", {
    fill: COLORS.darkGray,
    font: { bold: true, color: COLORS.white },
    borders: { preset: "all", style: "thin", color: "#808080" },
  });
  setRangeStyle(macro, `A5:D${5 + fronts.length}`, {
    borders: { preset: "all", style: "thin", color: COLORS.border },
    wrapText: true,
  });
  macro.getRange(`B5:B${5 + fronts.length}`).format.numberFormat = "#,##0";
  macro.getRange(`C5:C${5 + fronts.length}`).format.numberFormat = "0%";
  macro.getRange(`A${5 + fronts.length}:D${5 + fronts.length}`).format = {
    fill: COLORS.lightGray,
    font: { bold: true, color: COLORS.text },
    borders: { preset: "all", style: "thin", color: "#808080" },
  };

  const typeStart = 15;
  macro.getRange(`A${typeStart}:B${typeStart}`).values = [["Clasificación GX", "Cantidad"]];
  macro.getRange(`A${typeStart + 1}:B${typeStart + typeRows.length}`).values = typeRows;
  setRangeStyle(macro, `A${typeStart}:B${typeStart}`, {
    fill: COLORS.phaseBlue,
    font: { bold: true, color: COLORS.white },
    borders: { preset: "all", style: "thin", color: "#808080" },
  });
  setRangeStyle(macro, `A${typeStart + 1}:B${typeStart + typeRows.length}`, {
    borders: { preset: "all", style: "thin", color: COLORS.border },
  });
  macro.getRange(`B${typeStart + 1}:B${typeStart + typeRows.length}`).format.numberFormat = "#,##0";

  macro.getRange(`D${typeStart}:E${typeStart}`).values = [["Carpetas principales", "Cantidad"]];
  macro.getRange(`D${typeStart + 1}:E${typeStart + topFolders.length}`).values = topFolders;
  setRangeStyle(macro, `D${typeStart}:E${typeStart}`, {
    fill: COLORS.phaseBlue,
    font: { bold: true, color: COLORS.white },
    borders: { preset: "all", style: "thin", color: "#808080" },
  });
  setRangeStyle(macro, `D${typeStart + 1}:E${typeStart + topFolders.length}`, {
    borders: { preset: "all", style: "thin", color: COLORS.border },
  });
  macro.getRange(`E${typeStart + 1}:E${typeStart + topFolders.length}`).format.numberFormat = "#,##0";

  macro.getRange("A:A").format.columnWidth = 34;
  macro.getRange("B:B").format.columnWidth = 16;
  macro.getRange("C:C").format.columnWidth = 14;
  macro.getRange("D:D").format.columnWidth = 48;
  macro.getRange("E:E").format.columnWidth = 14;
  macro.getRange("F:F").format.columnWidth = 8;
  macro.freezePanes.freezeRows(4);
}

function buildAssumptionsSheet() {
  const rowsAssumptions = [
    ["Fecha base", "2026-08-01"],
    ["Fecha final referencial", fmtDateForNote(projectEnd)],
    ["Escala", "Semanal; cada columna del calendario representa una semana."],
    ["Tipo de Gantt", "Comercial para cliente; resume frentes de negocio y no reemplaza el plan técnico por objeto GX."],
    ["Fuente formato", "C:\\Users\\andre\\Downloads\\Carta Gantt APERP.xlsx"],
    ["Fuente inventario", "C:\\Proyectos2025\\Conex\\DocumentacionIA\\Inventario_GX8_Conex.xlsx"],
    ["Inventario base", `${sourceSummary.totals.allObjects} objetos GX: ${sourceSummary.totals.procedures} procedimientos, ${sourceSummary.totals.transactions} transacciones, ${sourceSummary.totals.panels} paneles, ${sourceSummary.totals.reports} reportes, ${sourceSummary.totals.tables} tablas.`],
    ["Documentación considerada", "docs/migration/security-status.md; docs/migration/masters-migration-study.md; docs/migration/APERPSeguridad-mapping.md"],
    ["Supuesto clave 1", "La empresa autenticada y el modelo multiempresa se mantienen en backend; no se recibe EmpCod desde pantallas de negocio."],
    ["Supuesto clave 2", "Seguridad y maestros parten con avance técnico existente, pero quedan sujetos a pruebas contra la base final."],
    ["Supuesto clave 3", "Las fechas dependen de confirmar base única o estrategia de dos bases, datos reales, usuarios expertos y menú/programas productivos."],
    ["Hito comercial", "UAT, capacitación y plan de salida concentrados en la última semana de octubre de 2026."],
  ];
  writeCell(assumptions, "A1", "Supuestos y Fuentes");
  setRangeStyle(assumptions, "A1:D1", {
    font: { bold: true, fontSize: 18, color: COLORS.title },
  });
  assumptions.getRange(`A3:B${3 + rowsAssumptions.length}`).values = [["Concepto", "Detalle"], ...rowsAssumptions];
  setRangeStyle(assumptions, "A3:B3", {
    fill: COLORS.darkGray,
    font: { bold: true, color: COLORS.white },
  });
  setRangeStyle(assumptions, `A3:B${3 + rowsAssumptions.length}`, {
    borders: { preset: "all", style: "thin", color: COLORS.border },
    wrapText: true,
  });
  assumptions.getRange(`A4:A${3 + rowsAssumptions.length}`).format = {
    fill: COLORS.lightGray,
    font: { bold: true, color: COLORS.text },
    borders: { preset: "all", style: "thin", color: COLORS.border },
  };
  assumptions.getRange("A:A").format.columnWidth = 26;
  assumptions.getRange("B:B").format.columnWidth = 110;
  assumptions.freezePanes.freezeRows(2);
}

styleGanttBase();
styleTimelineHeader();
writeGanttRows();
paintTimelineBars();
buildMacroSheet();
buildAssumptionsSheet();

gantt.freezePanes.freezeRows(6);
gantt.freezePanes.freezeColumns(8);

const checks = await workbook.inspect({
  kind: "table",
  sheetId: "Gantt CONEX",
  range: "B1:H20",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
  maxChars: 9000,
});
await fs.writeFile(path.join(workDir, "final_inspect_gantt.ndjson"), checks.ndjson, "utf8");

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 6000,
});
await fs.writeFile(path.join(workDir, "final_formula_errors.ndjson"), errors.ndjson, "utf8");

const ganttPreview = await workbook.render({
  sheetName: "Gantt CONEX",
  range: `A1:${lastTimelineColName}${totalRow + 1}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(workDir, "preview_gantt_conex.png"), new Uint8Array(await ganttPreview.arrayBuffer()));

const macroPreview = await workbook.render({
  sheetName: "Vision Macro",
  range: "A1:E35",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(workDir, "preview_vision_macro.png"), new Uint8Array(await macroPreview.arrayBuffer()));

const assumptionsPreview = await workbook.render({
  sheetName: "Supuestos",
  range: "A1:B16",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(workDir, "preview_supuestos.png"), new Uint8Array(await assumptionsPreview.arrayBuffer()));

await fs.mkdir(workDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
