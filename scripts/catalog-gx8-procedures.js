const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const xpzPath = process.argv[2] || process.env.GX8_XPZ_PATH;
const outputDir = path.resolve(__dirname, '..', 'docs', 'gx8');

if (!xpzPath) {
  console.error('Uso: node scripts/catalog-gx8-procedures.js <ruta-exportacion.xpz>');
  process.exit(1);
}

const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const collectCodeSources = (node, currentPath = [], sources = []) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectCodeSources(item, currentPath, sources));
    return sources;
  }

  if (!node || typeof node !== 'object') return sources;

  for (const [key, value] of Object.entries(node)) {
    const nextPath = [...currentPath, key];
    if (key === 'Source' && currentPath.includes('CodeBlock') && typeof value === 'string') {
      sources.push(value);
    } else {
      collectCodeSources(value, nextPath, sources);
    }
  }

  return sources;
};

const stripLineComments = (source) => source
  .split(/\r?\n/)
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

const parseParameters = (rules) => {
  const match = /\bparm\s*\(([\s\S]*?)\)\s*;/i.exec(rules || '');
  if (!match) return [];
  return match[1].split(',').map((value) => value.trim()).filter(Boolean);
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((values) => values.some((value) => value !== ''))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
};

const businessAreas = {
  Anulaciones: 'Gestion de anulaciones',
  Cajas_Leidas: 'Lectura y despacho de cajas',
  CapturaCajas: 'Captura de cajas de empaque',
  ConfiguracionLineas: 'Configuracion de lineas de embalaje',
  Consultas: 'Consultas operacionales',
  Despachos: 'Despachos de fruta',
  Despachos_Varios: 'Despachos comerciales y varios',
  Diagrama: 'Diagramacion y control de folios',
  ETIQUETAS: 'Etiquetado de cajas y lineas',
  Factura: 'Facturacion y documentos tributarios',
  Fruta_Comercial: 'Gestion de fruta comercial',
  Guias_Despacho: 'Guias de despacho',
  Ingreso_de_Folios: 'Ingreso y control de folios',
  Ingresos: 'Recepcion e ingresos de fruta',
  Inspecciones: 'Inspecciones y solicitudes',
  Interplanta: 'Movimientos interplanta',
  LecturaCajas: 'Lectura de cajas',
  Maestros: 'Maestros y parametros del sistema',
  Menus: 'Navegacion de la aplicacion',
  Multipuerto: 'Despachos multipuerto',
  Orden_Proceso: 'Ordenes de proceso y lotes',
  Packing_List: 'Packing list y reportes de exportacion',
  Paletizado: 'Paletizado y control de folios',
  Proce_General: 'Servicios generales del sistema',
  Procesos: 'Procesos de empaque',
  Repaletizaje: 'Repaletizaje',
  SAG: 'Reportes y existencias SAG',
  Seguridad: 'Seguridad y permisos de usuarios',
  Stock: 'Consulta de stock',
  TM: 'Procesos TM',
  USDA: 'Despachos y requisitos USDA',
  Varios: 'Procesos auxiliares'
};

const getSuggestedBusinessPurpose = ({ folder, name, description }) => {
  const area = businessAreas[folder] || 'Proceso transversal o integracion por confirmar';
  const identity = `${name} ${description}`.toLowerCase();
  let action;

  if (/anula|baja|elim|dlt|\bdel/.test(identity)) {
    action = `anula, elimina o revierte registros asociados a "${description}"`;
  } else if (/crea|graba|ins|genera|arma|asig|agrega|sube|modi|cambia|marca|actu/.test(identity)) {
    action = `crea, actualiza o registra datos para "${description}"`;
  } else if (/archi|carga|excel|imp|eti|report|planilla|packing/.test(identity)) {
    action = `genera, imprime o integra una salida operativa para "${description}"`;
  } else if (/trae|bus|lee|veri|val|estado|rango|suma|existencia|cuenta/.test(identity)) {
    action = `consulta, calcula o valida informacion para "${description}"`;
  } else {
    action = `apoya la operacion de "${description}"`;
  }

  return `${area}: ${action}.`;
};

const getRecommendedTarget = ({ source, folder, name }) => {
  if (!source.trim()) return 'REVIEW_OR_RETIRE';
  if (/\bgxSel(File|Dir)\b|\bprint\b|[a-z]:\\/i.test(source)) return 'INTEGRATION_OR_REPORT_SERVICE';
  if (/^(Rpt|Archi|PImp|Eti|Excel)/i.test(name) || /ETIQUETAS|Packing_List/i.test(folder)) return 'REPORT_SERVICE';
  if (/^\s*(new|delete)\b/im.test(source)) return 'NODE_USE_CASE';
  if (/\bfor\s+each\b/i.test(source)) return 'NODE_QUERY_SERVICE';
  return 'SHARED_UTILITY';
};

const buildCatalog = async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.resolve(xpzPath)));
  const xmlEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.xml'));
  if (!xmlEntry) throw new Error('La XPZ no contiene un XML exportado');

  const xmlBuffer = await xmlEntry.async('nodebuffer');
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false
  });
  const exportFile = parser.parse(xmlBuffer.toString('latin1')).ExportFile;
  const procedureObjects = asArray(exportFile.GXObject)
    .filter((object) => object.Procedure)
    .map((object) => object.Procedure);

  const names = new Map(procedureObjects.map((procedure) => [String(procedure.Info.Name).toUpperCase(), String(procedure.Info.Name)]));
  const normalizeCall = (target) => {
    const key = target.toUpperCase();
    if (names.has(key)) return names.get(key);
    if (key.startsWith('P') && names.has(key.slice(1))) return names.get(key.slice(1));
    return target;
  };

  const procedures = procedureObjects.map((procedure) => {
    const name = String(procedure.Info.Name);
    const description = String(procedure.Info.Description || name);
    const folder = String(procedure.Info.Folder || '(sin carpeta)');
    const rules = String(procedure.Rules || '').trim();
    const source = collectCodeSources(procedure.Layout).join('\n').trim();
    const activeSource = stripLineComments(source);
    const calls = [];
    const callPattern = /\bcall\s*\(\s*['"]?([A-Za-z_][A-Za-z0-9_]*)/gi;
    let callMatch;

    while ((callMatch = callPattern.exec(activeSource)) !== null) {
      calls.push(normalizeCall(callMatch[1]));
    }

    const uniqueCalls = [...new Set(calls)];
    const parameters = parseParameters(rules);
    const hardcodedCompany = /\bEmpCod\s*=\s*1\b|\bPTraeParametro\s*,\s*1\s*,/i.test(activeSource);
    const uiDependency = /\bmsg\s*\(|\bgxSel(File|Dir)\b|[a-z]:\\/i.test(activeSource);

    return {
      gxName: name,
      description,
      folder,
      suggestedBusinessPurpose: getSuggestedBusinessPurpose({ folder, name, description }),
      lastUpdate: String(procedure.LastUpdate || ''),
      parameters,
      calls: uniqueCalls,
      sourceLength: source.length,
      sourceHash: crypto.createHash('sha256').update(`${rules}\n${source}`).digest('hex'),
      hasSource: source.length > 0,
      hasNew: /^\s*new\b/im.test(activeSource),
      hasDelete: /^\s*delete\b/im.test(activeSource),
      hasCommit: /\bcommit\b/i.test(activeSource),
      hasRollback: /\brollback\b/i.test(activeSource),
      usesEmpCod: /\bEmpCod\b/i.test(activeSource) || parameters.some((parameter) => /EmpCod/i.test(parameter)),
      usesTempCod: /\bTempCod\b/i.test(activeSource) || parameters.some((parameter) => /TempCod/i.test(parameter)),
      hardcodedCompany,
      uiDependency,
      recommendedTarget: getRecommendedTarget({ source: activeSource, folder, name }),
      migrationStatus: name.toUpperCase() === 'TRAECOR' ? 'PARTIAL_BACKEND' : 'PENDING_ANALYSIS'
    };
  }).sort((a, b) => a.folder.localeCompare(b.folder) || a.gxName.localeCompare(b.gxName));

  const callCounts = new Map();
  procedures.forEach((procedure) => procedure.calls.forEach((called) => callCounts.set(called, (callCounts.get(called) || 0) + 1)));
  const topCalls = [...callCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const metadata = {
    generatedAt: new Date().toISOString(),
    sourceXpz: path.resolve(xpzPath),
    procedureCount: procedures.length,
    procedures
  };

  const columns = [
    'gxName', 'description', 'folder', 'suggestedBusinessPurpose', 'lastUpdate', 'parameters', 'calls', 'sourceLength', 'sourceHash', 'hasSource',
    'hasNew', 'hasDelete', 'hasCommit', 'hasRollback', 'usesEmpCod', 'usesTempCod', 'hardcodedCompany',
    'uiDependency', 'recommendedTarget', 'migrationStatus'
  ];
  const csvRows = procedures.map((procedure) => columns.map((column) => {
    const value = Array.isArray(procedure[column]) ? procedure[column].join(' | ') : procedure[column];
    return csvCell(value);
  }).join(','));

  const readme = `# Catalogo de Procedures GX8\n\n` +
    `Fuente: \`${path.resolve(xpzPath)}\`\n\n` +
    `Procedures identificados: **${procedures.length}**. Este catalogo usa el nombre real del objeto GeneXus; el prefijo generado \`P\` solo se normaliza en las llamadas.\n\n` +
    `## Estados\n\n` +
    `- \`PENDING_ANALYSIS\`: falta confirmar entradas, salidas, tablas y comportamiento esperado.\n` +
    `- \`READY\`: analisis aprobado y casos de prueba definidos.\n` +
    `- \`IN_PROGRESS\`: migracion en curso.\n` +
    `- \`VALIDATED\`: resultado SQL y funcional comparado con GX8.\n` +
    `- \`RETIRED\`: objeto descartado con una justificacion registrada.\n\n` +
    `## Dependencias mas llamadas\n\n` +
    topCalls.map(([called, count]) => `- \`${called}\`: ${count} Procedures`).join('\n') + '\n\n' +
    `## Regla de migracion\n\n` +
    `La logica de negocio se migra a servicios o casos de uso Node. Los hooks React solo consumen endpoints y administran estado de pantalla. Antes de cambiar un estado a \`READY\`, se deben registrar tablas leidas/escritas, limites transaccionales, Empresa, Temporada, llamadas y pruebas de equivalencia.\n\n` +
    `Los archivos \`procedures.csv\` y \`procedures.json\` son generados y se pueden reemplazar. Las decisiones manuales se registran en \`migration-register.csv\`, que el generador crea solo una vez.\n`;

  const registerPath = path.join(outputDir, 'migration-register.csv');
  const registerColumns = [
    'gxName', 'folder', 'businessPurpose', 'inputs', 'outputs', 'tablesRead', 'tablesWritten', 'tenantValidated',
    'transactionStrategy', 'targetKind', 'targetPath', 'testEvidence', 'decision', 'status', 'notes'
  ];
  const existingRegister = fs.existsSync(registerPath)
    ? new Map(parseCsv(fs.readFileSync(registerPath, 'utf8')).map((item) => [item.gxName, item]))
    : new Map();
  const registerRows = procedures.map((procedure) => {
    const current = existingRegister.get(procedure.gxName) || {};
    const status = current.status && current.status !== 'READY' ? current.status : procedure.migrationStatus;
    return [
      procedure.gxName,
      procedure.folder,
      current.businessPurpose || procedure.suggestedBusinessPurpose,
      current.inputs || procedure.parameters.join(' | '),
      current.outputs || '',
      current.tablesRead || '',
      current.tablesWritten || '',
      current.tenantValidated || (procedure.usesEmpCod && !procedure.hardcodedCompany ? 'PENDING_CONFIRMATION' : 'REVIEW_REQUIRED'),
      current.transactionStrategy || '',
      current.targetKind || procedure.recommendedTarget,
      current.targetPath || '',
      current.testEvidence || '',
      current.decision || '',
      status,
      current.notes || 'Descripcion funcional sugerida desde nombre, carpeta y descripcion GX; validar reglas, tablas y casos de prueba.'
    ].map(csvCell).join(',');
  });

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'procedures.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'procedures.csv'), `\ufeff${columns.map(csvCell).join(',')}\n${csvRows.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf8');
  fs.writeFileSync(registerPath, `\ufeff${registerColumns.map(csvCell).join(',')}\n${registerRows.join('\n')}\n`, 'utf8');

  console.log(`Catalogados ${procedures.length} Procedures en ${outputDir}`);
};

buildCatalog().catch((error) => {
  console.error(error);
  process.exit(1);
});
