import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = path.resolve("outputs/gantt_migracion_conex_20260801");
const inventoryPath = "C:\\Proyectos2025\\Conex\\DocumentacionIA\\Inventario_GX8_Conex.xlsx";

const input = await FileBlob.load(inventoryPath);
const workbook = await SpreadsheetFile.importXlsx(input);

function rowsFor(sheetName) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const range = sheet.getUsedRange(true);
  return range.values;
}

function toObjects(rows) {
  const headers = rows[0].map((value) => String(value ?? "").trim());
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header || `Column${index + 1}`, row[index] ?? null])),
  );
}

function countBy(rows, field, fallback = "(sin carpeta)") {
  const map = new Map();
  for (const row of rows) {
    const key = String(row[field] ?? fallback).trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const sheetReport = {};
for (const sheet of workbook.worksheets.items ?? []) {
  const rows = sheet.getUsedRange(true).values;
  sheetReport[sheet.name] = {
    rows: rows.length,
    cols: rows[0]?.length ?? 0,
    headers: rows[0]?.slice(0, 24) ?? [],
    sampleRows: rows.slice(1, 6).map((row) => row.slice(0, 12)),
  };
}

const allObjects = toObjects(rowsFor("Todos Objetos"));
const procedures = toObjects(rowsFor("Procedimientos"));
const transactions = toObjects(rowsFor("Transacciones"));
const panels = toObjects(rowsFor("Paneles"));
const reports = toObjects(rowsFor("Reportes"));
const tables = toObjects(rowsFor("Tablas"));

const byType = countBy(allObjects, "Tipo", "(sin tipo)");
const byFolder = countBy(allObjects, "Carpeta");
const procByFolder = countBy(procedures, "Carpeta");
const tranByFolder = countBy(transactions, "Carpeta");
const panelByFolder = countBy(panels, "Carpeta");
const reportByFolder = countBy(reports, "Carpeta");
const tableByFolder = countBy(tables, "Carpeta");

const migrationSheets = {};
for (const name of ["Revision general", "Migracion procedimientos", "Resumen"]) {
  try {
    const rows = rowsFor(name);
    migrationSheets[name] = {
      rows: rows.length,
      headers: rows[0],
      sampleRows: rows.slice(1, 12),
    };
  } catch (error) {
    migrationSheets[name] = { error: error.message };
  }
}

const summary = {
  sheetReport,
  totals: {
    allObjects: allObjects.length,
    procedures: procedures.length,
    transactions: transactions.length,
    panels: panels.length,
    reports: reports.length,
    tables: tables.length,
  },
  byType,
  topFolders: byFolder.slice(0, 40),
  procedureFolders: procByFolder.slice(0, 30),
  transactionFolders: tranByFolder.slice(0, 30),
  panelFolders: panelByFolder.slice(0, 30),
  reportFolders: reportByFolder.slice(0, 30),
  tableFolders: tableByFolder.slice(0, 30),
  migrationSheets,
};

await fs.writeFile(path.join(workDir, "inventory_extracted_summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
