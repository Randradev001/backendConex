const fs = require('fs');
const path = require('path');
require('../src/config/loadEnv');
const { getPool, sql } = require('../src/conectorMysql/conectorSqlServer');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'migration');
const project = require(path.join(root, 'docs', 'gx8', 'inventory', 'project-objects.json'));
const tables = require(path.join(root, 'docs', 'gx8', 'inventory', 'tables.json'));
const dependenciesCsv = fs.readFileSync(path.join(root, 'docs', 'gx8', 'inventory', 'dependencies.csv'), 'utf8');

const MASTER_TRANSACTIONS = [
  'DEFEMP',
  'Temp01',
  'Especies',
  'EnvCat',
  'Productores',
  'Calibres',
  'Agentes',
  'Clientes',
  'Comunas',
  'Condicion',
  'Consig',
  'Destinos',
  'Export',
  'Origen',
  'Tipdoc',
  'CausaAnul',
  'DespaAuto',
  'DestMP',
  'EnvMP',
  'ExpProd',
  'MaeLineaEmbalaje',
  'Monedas',
  'paramgen',
  'Procedencia',
  'ProdGen',
  'Puertos',
  'Secciones',
  'TipMov',
  'ValMExt'
];

const SCREEN_DECISIONS = {
  DEFEMP: { screen: 'Empresas', menuVisible: true, details: [], note: 'Raiz multiempresa; no filtra por EmpCod de sesion.' },
  Temp01: { screen: 'Temporadas', menuVisible: true, details: [], note: 'Maestro por empresa de sesion.' },
  Especies: { screen: 'Especies', menuVisible: true, details: ['Especies1', 'Calibres'], note: 'Calibres es detalle relacionado por Especod, aunque no sea nivel 2 de la Transaction Especies.' },
  EnvCat: { screen: 'Envases', menuVisible: true, details: ['EnvCat1'], note: 'Categorias se mantienen dentro del modal de envase.' },
  Productores: { screen: 'Productores', menuVisible: true, details: ['Productores1'], note: 'Cuarteles se mantienen dentro del modal de productor.' },
  Export: { screen: 'Exportadoras', menuVisible: true, details: ['ExpProd'], note: 'ExpProd es relacion exportadora-productor.' },
  Monedas: { screen: 'Monedas', menuVisible: true, details: ['ValMExt'], note: 'ValMExt incluye importacion Excel a estudiar contra GX8.' },
  paramgen: { screen: 'Parametros generales', menuVisible: true, details: ['paramge1'], note: 'Detalle de parametro se edita desde cabecera.' },
  TipMov: { screen: 'Tipos de movimiento', menuVisible: true, details: ['TipMov1'], note: 'Subtipos se editan desde cabecera.' },
  Calibres: { screen: 'Especies', menuVisible: false, details: [], note: 'No va al menu; se administra desde Especies.' },
  ValMExt: { screen: 'Monedas', menuVisible: false, details: [], note: 'No va al menu; se administra desde Monedas.' },
  ExpProd: { screen: 'Exportadoras', menuVisible: false, details: [], note: 'No va al menu; se administra desde Exportadoras.' }
};

const PHYSICAL_TABLE_MAP = {
  Export: 'EXPORT1'
};

const REFERENCED_FIELDS = new Set([
  'EmpNom',
  'EspeNom',
  'ExpNom',
  'MonDes'
]);

function norm(value) {
  return String(value || '').trim();
}

function findObject(type, name) {
  const target = name.toLowerCase();
  return project.objects.find((item) => item.type === type && norm(item.name).toLowerCase() === target);
}

function findTable(name) {
  const target = name.toLowerCase();
  return tables.find((item) => norm(item.name).toLowerCase() === target);
}

function parseStructure(structure) {
  if (!structure) return { headerFields: [], detailGroups: [] };
  const text = String(structure).replace(/\s+/g, ' ').trim();
  const detailGroups = [];
  const detailRegex = /\(([^()]+)\)/g;
  let headerText = text;
  let match;
  while ((match = detailRegex.exec(text)) !== null) {
    const fields = match[1].split('|').map((field) => field.trim()).filter(Boolean);
    detailGroups.push(fields);
    headerText = headerText.replace(match[0], ' ');
  }
  const headerFields = headerText.split('|').map((field) => field.trim()).filter(Boolean);
  return { headerFields, detailGroups };
}

function csvLines(text) {
  return text.split(/\r?\n/).filter(Boolean);
}

function dependencyProcedures(gxName) {
  const needle = `"Transaction","${gxName}",`;
  return csvLines(dependenciesCsv)
    .filter((line) => line.startsWith(needle) && line.includes(',"Procedure",'))
    .map((line) => line.split('","').map((part) => part.replace(/^"|"$/g, '')))
    .map((cols) => cols[4])
    .filter(Boolean);
}

function guessListColumns(name, structureInfo, tableInfo) {
  const explicit = {
    Agentes: ['AgeCod', 'Agerut', 'AgeDv', 'AgeNom'],
    Calibres: ['Especod', 'EspeNom', 'Calibre', 'CalCod'],
    Clientes: ['CliCod', 'Clirut', 'CliDv', 'CliNom'],
    Consig: ['ConsCod', 'ConsRut', 'ConsDV', 'ConsNom'],
    EnvCat: ['EnvCod', 'EnvNom', 'EnvNomExt'],
    Especies: ['Especod', 'EspeNom', 'EspeDiaV'],
    Export: ['ExpCod', 'ExpNom', 'ExpRut', 'ExpDv'],
    ExpProd: ['ExpCod', 'ExpNom', 'ProdCod', 'ProdNom'],
    paramgen: ['PARCod', 'PARDes', 'PARValor1', 'PARValor2', 'PARValor3'],
    Productores: ['ProdCod', 'ProdNom', 'ProdRut', 'ProdDv', 'ProdComuna', 'ProdProvincia'],
    Puertos: ['PuCod', 'PuNombre', 'PuNac'],
    Temp01: ['TempCod', 'TempDes', 'TempActiva', 'TempFecAbre', 'TempFecCierra'],
    ValMExt: ['MonCod', 'MonDes', 'VMEFec', 'VMEVal']
  };
  if (explicit[name]) return explicit[name];
  const fields = structureInfo.headerFields.length ? structureInfo.headerFields : (tableInfo?.keys || []);
  return fields.filter((field) => !field.endsWith('*')).slice(0, 6);
}

async function loadDbMetadata() {
  const pool = await getPool();
  const request = pool.request();
  const result = await request.query(`
    SELECT
      t.TABLE_NAME AS tableName,
      c.COLUMN_NAME AS columnName,
      c.DATA_TYPE AS dataType,
      c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
      c.NUMERIC_PRECISION AS numericPrecision,
      c.NUMERIC_SCALE AS numericScale,
      c.IS_NULLABLE AS isNullable
    FROM INFORMATION_SCHEMA.TABLES t
    LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME
    WHERE t.TABLE_TYPE='BASE TABLE'
    ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const key = norm(row.tableName).toLowerCase();
    if (!map.has(key)) map.set(key, { exists: true, columns: [] });
    if (row.columnName) map.get(key).columns.push(row);
  }
  return map;
}

function dbInfo(metadata, tableName) {
  const item = metadata.get(norm(tableName).toLowerCase());
  if (!item) return { exists: false, columns: [] };
  return item;
}

function sqlType(column) {
  if (!column) return '';
  if (column.maxLength) return `${column.dataType}(${column.maxLength})`;
  if (column.numericPrecision) return `${column.dataType}(${column.numericPrecision},${column.numericScale})`;
  return column.dataType;
}

function buildRows(metadata) {
  return MASTER_TRANSACTIONS.map((name) => {
    const tx = findObject('Transaction', name);
    const workPanel = findObject('WorkPanel', name);
    const report = findObject('Report', name);
    const tableName = PHYSICAL_TABLE_MAP[name] || (name === 'Temp01' ? 'Temp01' : name);
    const table = findTable(tableName);
    const structureInfo = parseStructure(tx?.structure);
    const decision = SCREEN_DECISIONS[name] || { screen: name, menuVisible: true, details: [], note: '' };
    const db = dbInfo(metadata, tableName);
    const dbColumns = db.columns.map((column) => column.columnName);
    const referencedFields = structureInfo.headerFields
      .map((field) => field.replace(/\*$/, '').trim())
      .filter((field) => REFERENCED_FIELDS.has(field));

    const missingInventoryColumns = structureInfo.headerFields
      .map((field) => field.replace(/\*$/, '').trim())
      .filter(Boolean)
      .filter((field, index, arr) => arr.indexOf(field) === index)
      .filter((field) => !REFERENCED_FIELDS.has(field))
      .filter((field) => db.exists && !dbColumns.some((column) => column.toLowerCase() === field.toLowerCase()));

    return {
      gxName: name,
      screen: decision.screen,
      menuVisible: decision.menuVisible,
      table: tableName,
      tableExistsInConex: db.exists,
      keys: table?.keys || [],
      dbColumnCount: db.columns.length,
      dbColumns: db.columns.map((column) => `${column.columnName} ${sqlType(column)} ${column.isNullable === 'NO' ? 'NOT NULL' : 'NULL'}`),
      workPanel: Boolean(workPanel),
      report: Boolean(report),
      structureHeader: structureInfo.headerFields,
      structureDetails: structureInfo.detailGroups,
      detailSections: decision.details,
      listColumns: guessListColumns(name, structureInfo, table),
      formFields: structureInfo.headerFields.map((field) => field.replace(/\*$/, '')),
      procedures: dependencyProcedures(name),
      referencedFields,
      missingInventoryColumns,
      note: decision.note,
      status: tx ? 'GX_TRANSACTION_FOUND' : 'PENDING_GX_CONFIRMATION'
    };
  });
}

function renderMarkdown(rows) {
  const lines = [];
  lines.push('# Estudio de maestros GX8 en CONEX');
  lines.push('');
  lines.push(`Fecha: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('## Decisiones de modalidad');
  lines.push('');
  lines.push('- Todos los maestros con niveles se implementan como cabecera-detalle.');
  lines.push('- El menu muestra solamente maestros padre.');
  lines.push('- Los detalles se editan dentro del modal de la cabecera.');
  lines.push('- Se usa una sola base SQL Server: la configurada en `DB_DATABASE`.');
  lines.push('- `EmpCod` proviene de la sesion salvo `DEFEMP`, que es la raiz de empresas.');
  lines.push('');
  lines.push('## Matriz resumida');
  lines.push('');
  lines.push('| Maestro GX | Pantalla | Menu | Tabla | Existe BD | Clave | Detalles | WorkPanel | Reglas/procedimientos | Observacion |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of rows) {
    lines.push(`| ${row.gxName} | ${row.screen} | ${row.menuVisible ? 'Si' : 'No'} | ${row.table} | ${row.tableExistsInConex ? 'Si' : 'No'} | ${row.keys.join(' + ') || '-'} | ${row.detailSections.join(', ') || '-'} | ${row.workPanel ? 'Si' : 'No'} | ${row.procedures.join(', ') || '-'} | ${row.note || '-'} |`);
  }
  lines.push('');
  lines.push('## Configuracion propuesta por maestro');
  for (const row of rows) {
    lines.push('');
    lines.push(`### ${row.screen} (${row.gxName})`);
    lines.push('');
    lines.push(`- Tabla: \`${row.table}\` (${row.tableExistsInConex ? 'existe en CONEX' : 'no detectada en CONEX'})`);
    lines.push(`- Menu visible: ${row.menuVisible ? 'si' : 'no'}`);
    lines.push(`- Clave: ${row.keys.map((key) => `\`${key}\``).join(', ') || 'pendiente'}`);
    lines.push(`- Listado: ${row.listColumns.map((field) => `\`${field}\``).join(', ') || 'pendiente'}`);
    lines.push(`- Formulario cabecera: ${row.formFields.map((field) => `\`${field}\``).join(', ') || 'pendiente de confirmar'}`);
    lines.push(`- Detalles en modal: ${row.detailSections.map((detail) => `\`${detail}\``).join(', ') || 'ninguno'}`);
    if (row.structureDetails.length) {
      lines.push(`- Niveles GX detectados: ${row.structureDetails.map((group) => group.map((field) => `\`${field}\``).join(' + ')).join('; ')}`);
    }
    lines.push(`- Procedimientos asociados: ${row.procedures.map((name) => `\`${name}\``).join(', ') || 'ninguno detectado'}`);
    if (row.referencedFields.length) {
      lines.push(`- Campos referenciados GX: ${row.referencedFields.map((field) => `\`${field}\``).join(', ')}. No se tratan como columnas fisicas faltantes.`);
    }
    if (row.missingInventoryColumns.length) {
      lines.push(`- Campos del inventario no encontrados con el mismo nombre en BD: ${row.missingInventoryColumns.map((field) => `\`${field}\``).join(', ')}`);
    }
    if (row.note) lines.push(`- Nota: ${row.note}`);
  }
  lines.push('');
  lines.push('## Siguientes confirmaciones');
  lines.push('');
  lines.push('1. Validar nombres visibles y columnas de listado contra cada WorkPanel GX8.');
  lines.push('2. Definir permisos `SistCod`, `Modcod`, `ProgCod` y acciones por maestro padre.');
  lines.push('3. Confirmar maestros sin WorkPanel antes de habilitar CRUD completo.');
  lines.push('4. Ejecutar pruebas de alta, modificacion, baja, dependencia y exportacion por maestro.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const metadata = await loadDbMetadata();
  const rows = buildRows(metadata);
  fs.writeFileSync(path.join(outDir, 'maestros-gx8-conex-study.json'), JSON.stringify(rows, null, 2));
  fs.writeFileSync(path.join(outDir, 'maestros-gx8-conex-study.md'), renderMarkdown(rows));
  console.log(`Generado ${path.join(outDir, 'maestros-gx8-conex-study.md')}`);
  console.log(`Maestros estudiados: ${rows.length}`);
  console.log(`Tablas detectadas en BD: ${rows.filter((row) => row.tableExistsInConex).length}`);
  await sql.close();
}

main().catch(async (error) => {
  console.error(error);
  await sql.close();
  process.exit(1);
});
