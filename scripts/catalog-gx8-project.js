const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const xpzPath = process.argv[2] || process.env.GX8_XPZ_PATH;
const outputDir = path.resolve(__dirname, '..', 'docs', 'gx8', 'inventory');

if (!xpzPath) {
  console.error('Uso: node scripts/catalog-gx8-project.js <ruta-exportacion.xpz>');
  process.exit(1);
}

const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const writeCsv = (fileName, columns, rows) => {
  const content = rows.map((row) => columns.map((column) => {
    const value = Array.isArray(row[column]) ? row[column].join(' | ') : row[column];
    return csvCell(value);
  }).join(','));

  fs.writeFileSync(path.join(outputDir, fileName), `\ufeff${columns.map(csvCell).join(',')}\n${content.join('\n')}\n`, 'utf8');
};

const collectText = (node, acceptedKeys, values = []) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectText(item, acceptedKeys, values));
    return values;
  }

  if (!node || typeof node !== 'object') return values;

  for (const [key, value] of Object.entries(node)) {
    if (acceptedKeys.has(key) && typeof value === 'string') values.push(value);
    collectText(value, acceptedKeys, values);
  }

  return values;
};

const stripLineComments = (source) => source
  .split(/\r?\n/)
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

const getObjectEntry = (wrapper) => {
  const type = Object.keys(wrapper).find((key) => key !== '#text');
  return type ? { type, object: wrapper[type] } : null;
};

const buildInventory = async () => {
  const resolvedXpzPath = path.resolve(xpzPath);
  const zip = await JSZip.loadAsync(fs.readFileSync(resolvedXpzPath));
  const xmlEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.xml'));
  if (!xmlEntry) throw new Error('La XPZ no contiene un XML exportado');

  const xmlBuffer = await xmlEntry.async('nodebuffer');
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false });
  const exportFile = parser.parse(xmlBuffer.toString('latin1')).ExportFile;
  const entries = asArray(exportFile.GXObject).map(getObjectEntry).filter(Boolean);
  const nameIndex = new Map();

  entries.forEach(({ type, object }) => {
    const name = String(object.Info?.Name || '');
    const key = name.toUpperCase();
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key).push({ name, type });
  });

  const resolveDependency = (rawTarget) => {
    const key = rawTarget.toUpperCase();
    if (nameIndex.has(key) && nameIndex.get(key).length === 1) return { ...nameIndex.get(key)[0], resolved: true };

    const prefixes = [
      { prefix: 'P', type: 'Procedure' },
      { prefix: 'W', type: 'WorkPanel' },
      { prefix: 'R', type: 'Report' },
      { prefix: 'T', type: 'Transaction' }
    ];

    for (const candidate of prefixes) {
      if (!key.startsWith(candidate.prefix)) continue;
      const matches = nameIndex.get(key.slice(1)) || [];
      const match = matches.find((item) => item.type === candidate.type);
      if (match) return { ...match, resolved: true };
    }

    return { name: rawTarget, type: 'ExternalOrUnknown', resolved: false };
  };

  const dependencyRows = [];
  const objectRows = entries.map(({ type, object }) => {
    const info = object.Info || {};
    const name = String(info.Name || '');
    const rules = typeof object.Rules === 'string' ? object.Rules.trim() : '';
    const sourceTexts = collectText(object, new Set(['Source']));
    const code = stripLineComments([rules, ...sourceTexts].filter(Boolean).join('\n'));
    const dependencyCounts = new Map();
    const callPattern = /\bcall\s*\(\s*['"]?([A-Za-z_][A-Za-z0-9_]*)/gi;
    let callMatch;

    while ((callMatch = callPattern.exec(code)) !== null) {
      const rawTarget = callMatch[1];
      const resolved = resolveDependency(rawTarget);
      const dependencyKey = `${rawTarget}|${resolved.name}|${resolved.type}`;
      const current = dependencyCounts.get(dependencyKey) || { rawTarget, ...resolved, occurrences: 0 };
      current.occurrences += 1;
      dependencyCounts.set(dependencyKey, current);
    }

    dependencyCounts.forEach((dependency) => dependencyRows.push({
      sourceType: type,
      sourceName: name,
      rawTarget: dependency.rawTarget,
      targetType: dependency.type,
      targetName: dependency.name,
      resolved: dependency.resolved,
      occurrences: dependency.occurrences
    }));

    return {
      type,
      name,
      description: String(info.Description || name),
      folder: String(info.Folder || ''),
      lastUpdate: String(object.LastUpdate || ''),
      id: String(object.Id || info.Id || ''),
      variableCount: asArray(object.Variable).length,
      keyCount: asArray(object.Key).length,
      keys: asArray(object.Key).map(String),
      indexCount: asArray(object.TblIndex).length,
      subtypeCount: asArray(object.Subtype).length,
      sourceLength: sourceTexts.join('\n').length,
      rulesLength: rules.length,
      dependencyCount: dependencyCounts.size,
      sourceHash: crypto.createHash('sha256').update(JSON.stringify(object)).digest('hex'),
      structure: String(object.Structure?.Source || '').trim().replace(/\r?\n/g, ' | ')
    };
  }).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

  const gxAttributes = asArray(exportFile.Attributes).flatMap((container) => (
    container && typeof container === 'object' && !Array.isArray(container) ? asArray(container.GXAtt) : []
  ));
  const attributeRows = gxAttributes.map((item) => {
    const attribute = item.Attribute || {};
    return {
      id: String(attribute.Id || ''),
      name: String(attribute.Name || ''),
      title: String(attribute.Title || ''),
      type: String(attribute.Type || 'Numeric'),
      length: String(attribute.Length || ''),
      decimals: String(attribute.Decimals || ''),
      picture: String(attribute.Picture || ''),
      formula: String(attribute.Formula || ''),
      controlInfoFromDomain: String(item.AttInfo?.ControlInfoFromDomain || '')
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const tableRows = entries.filter((entry) => entry.type === 'Table').map(({ object }) => ({
    name: String(object.Info?.Name || ''),
    description: String(object.Info?.Description || ''),
    id: String(object.Id || ''),
    keys: asArray(object.Key).map(String),
    indexes: asArray(object.TblIndex).map((index) => {
      const attributes = asArray(index.IdxAttri).map((item) => String(item.Name || item));
      return `${index.Name}:${index.UniqueDuplicate || ''}:${attributes.join('+')}`;
    })
  })).sort((a, b) => a.name.localeCompare(b.name));

  const typeCounts = objectRows.reduce((counts, object) => {
    counts[object.type] = (counts[object.type] || 0) + 1;
    return counts;
  }, {});
  const unresolvedDependencies = dependencyRows.filter((dependency) => !dependency.resolved);
  const metadata = {
    generatedAt: new Date().toISOString(),
    sourceXpz: resolvedXpzPath,
    model: exportFile.Model,
    kmw: exportFile.KMW,
    objectCount: objectRows.length,
    attributeCount: attributeRows.length,
    tableCount: tableRows.length,
    dependencyCount: dependencyRows.length,
    unresolvedDependencyCount: unresolvedDependencies.length,
    typeCounts,
    objects: objectRows
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'project-objects.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'attributes.json'), `${JSON.stringify(attributeRows, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'tables.json'), `${JSON.stringify(tableRows, null, 2)}\n`, 'utf8');

  writeCsv('project-objects.csv', [
    'type', 'name', 'description', 'folder', 'lastUpdate', 'id', 'variableCount', 'keyCount', 'keys', 'indexCount',
    'subtypeCount', 'sourceLength', 'rulesLength', 'dependencyCount', 'sourceHash', 'structure'
  ], objectRows);
  writeCsv('attributes.csv', [
    'id', 'name', 'title', 'type', 'length', 'decimals', 'picture', 'formula', 'controlInfoFromDomain'
  ], attributeRows);
  writeCsv('tables.csv', ['name', 'description', 'id', 'keys', 'indexes'], tableRows);
  writeCsv('dependencies.csv', [
    'sourceType', 'sourceName', 'rawTarget', 'targetType', 'targetName', 'resolved', 'occurrences'
  ], dependencyRows);

  const registerPath = path.join(outputDir, 'project-review-register.csv');
  if (!fs.existsSync(registerPath)) {
    writeCsv('project-review-register.csv', [
      'type', 'name', 'folder', 'businessArea', 'businessRole', 'migrationDecision', 'targetPath', 'status', 'notes'
    ], objectRows.map((object) => ({
      type: object.type,
      name: object.name,
      folder: object.folder,
      businessArea: object.folder,
      businessRole: '',
      migrationDecision: '',
      targetPath: '',
      status: 'DISCOVERED',
      notes: ''
    })));
  }

  const summary = `# Inventario general GX8\n\n` +
    `Fuente: \`${resolvedXpzPath}\`\n\n` +
    `Modelo: **${exportFile.Model?.Name || ''}** (${exportFile.Model?.Type || ''})\n\n` +
    `## Totales\n\n` +
    `- Objetos GX: **${objectRows.length}**\n` +
    `- Atributos globales: **${attributeRows.length}**\n` +
    `- Tablas: **${tableRows.length}**\n` +
    `- Dependencias detectadas: **${dependencyRows.length}**\n` +
    `- Dependencias externas o no resueltas: **${unresolvedDependencies.length}**\n\n` +
    `## Objetos por tipo\n\n` +
    Object.entries(typeCounts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => `- ${type}: ${count}`).join('\n') +
    `\n\n## Archivos\n\n` +
    `- \`project-objects.csv\`: todos los objetos de la exportacion.\n` +
    `- \`attributes.csv\`: atributos globales y tipos GX.\n` +
    `- \`tables.csv\`: tablas, llaves e indices.\n` +
    `- \`dependencies.csv\`: llamadas detectadas y nombre GX normalizado.\n` +
    `- \`project-review-register.csv\`: planilla editable; no se reemplaza al regenerar.\n`;

  fs.writeFileSync(path.join(outputDir, 'README.md'), summary, 'utf8');
  console.log(`Inventariados ${objectRows.length} objetos GX y ${attributeRows.length} atributos en ${outputDir}`);
};

buildInventory().catch((error) => {
  console.error(error);
  process.exit(1);
});
