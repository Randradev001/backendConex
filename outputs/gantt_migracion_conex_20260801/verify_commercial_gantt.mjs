import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const filePath = "C:\\Proyectos2025\\Conex\\backend\\backendConex\\outputs\\gantt_migracion_conex_20260801\\Carta_Gantt_Migracion_CONEX_Comercial_Ago-Oct_2026.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));

const table = await workbook.inspect({
  kind: "table",
  sheetId: "Gantt CONEX",
  range: "B1:H45",
  include: "values,formulas",
  tableMaxRows: 45,
  tableMaxCols: 7,
  maxChars: 12000,
});
console.log(table.ndjson);

for (const term of ["Facturación", "DTE", "e-fact", "2027", "mayo"]) {
  const matches = await workbook.inspect({
    kind: "match",
    searchTerm: term,
    options: { maxResults: 20, ignoreDiacritics: true },
    maxChars: 4000,
  });
  console.log(`--- matches for ${term} ---`);
  console.log(matches.ndjson);
}
