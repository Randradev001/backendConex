import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = path.resolve("outputs/gantt_migracion_conex_20260801");
const ganttPath = "C:\\Users\\andre\\Downloads\\Carta Gantt APERP.xlsx";
const inventoryPath = "C:\\Proyectos2025\\Conex\\DocumentacionIA\\Inventario_GX8_Conex.xlsx";

async function loadWorkbook(filePath) {
  const input = await FileBlob.load(filePath);
  return SpreadsheetFile.importXlsx(input);
}

async function inspectWorkbook(label, filePath) {
  const workbook = await loadWorkbook(filePath);
  const summary = await workbook.inspect({
    kind: "workbook,sheet,table,drawing",
    maxChars: 16000,
    tableMaxRows: 8,
    tableMaxCols: 16,
    tableMaxCellChars: 100,
  });
  await fs.writeFile(path.join(workDir, `${label}_summary.ndjson`), summary.ndjson, "utf8");
  console.log(`--- ${label} summary ---`);
  console.log(summary.ndjson);

  const sheetNames = workbook.worksheets.items?.map((sheet) => sheet.name) ?? [];
  console.log(`${label} sheets:`, JSON.stringify(sheetNames));

  for (const sheetName of sheetNames) {
    const preview = await workbook.render({
      sheetName,
      autoCrop: "all",
      scale: 1,
      format: "png",
    });
    await fs.writeFile(
      path.join(workDir, `${label}_${sheetName.replace(/[^a-zA-Z0-9_-]+/g, "_")}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }

  if (sheetNames.length) {
    const first = sheetNames[0];
    const region = await workbook.inspect({
      kind: "region",
      sheetId: first,
      range: "A1:AZ80",
      maxChars: 20000,
    });
    await fs.writeFile(path.join(workDir, `${label}_${first}_region.ndjson`), region.ndjson, "utf8");

    const styles = await workbook.inspect({
      kind: "computedStyle",
      sheetId: first,
      range: "A1:AZ30",
      maxChars: 12000,
    });
    await fs.writeFile(path.join(workDir, `${label}_${first}_styles.ndjson`), styles.ndjson, "utf8");
  }
}

await inspectWorkbook("gantt", ganttPath);
await inspectWorkbook("inventory", inventoryPath);
