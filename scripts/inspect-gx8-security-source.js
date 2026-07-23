const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const xpzPath = process.argv[2] || process.env.GX8_XPZ_PATH;
const requestedNames = new Set(
  (process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['VeriUsu', 'Encripta', 'CamClave', 'VA2', 'TraeNSeg', 'VeriLicencia', 'Conex'])
    .map((name) => name.toUpperCase())
);
const referenceTargets = ['Encripta', 'VeriUsu', 'TraeNSeg', 'VA2'];

if (!xpzPath) {
  console.error('Uso: node scripts/inspect-gx8-security-source.js <exportacion.xpz> [objetos...]');
  process.exit(1);
}

const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const collectSources = (node, currentPath = [], sources = []) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectSources(item, currentPath, sources));
    return sources;
  }

  if (!node || typeof node !== 'object') return sources;

  for (const [key, value] of Object.entries(node)) {
    const nextPath = [...currentPath, key];
    if (key === 'Source' && currentPath.includes('CodeBlock') && typeof value === 'string') {
      sources.push(value);
    } else {
      collectSources(value, nextPath, sources);
    }
  }

  return sources;
};

const inspect = async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.resolve(xpzPath)));
  const xmlEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.xml'));
  if (!xmlEntry) throw new Error('La XPZ no contiene un XML exportado');

  const xmlBuffer = await xmlEntry.async('nodebuffer');
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false });
  const exportFile = parser.parse(xmlBuffer.toString('latin1')).ExportFile;

  const procedures = asArray(exportFile.GXObject)
    .filter((object) => object.Procedure)
    .map((object) => object.Procedure)
    .filter((procedure) => requestedNames.has(String(procedure.Info.Name).toUpperCase()));

  for (const procedure of procedures) {
    console.log(`\n===== ${procedure.Info.Name} =====`);
    console.log('RULES');
    console.log(String(procedure.Rules || '').trim());
    console.log('SOURCE');
    console.log(collectSources(procedure.Layout).join('\n').trim());
  }

  for (const gxObject of asArray(exportFile.GXObject)) {
    for (const [type, object] of Object.entries(gxObject)) {
      const name = String(object?.Info?.Name || '');
      if (type === 'Procedure' || !requestedNames.has(name.toUpperCase())) continue;

      console.log(`\n===== ${type} ${name} =====`);
      console.log('RULES');
      console.log(String(object.Rules || '').trim());
      console.log('SOURCE');
      console.log(collectSources(object).join('\n').trim());
    }
  }

  console.log('\n===== REFERENCES =====');
  for (const gxObject of asArray(exportFile.GXObject)) {
    for (const [type, object] of Object.entries(gxObject)) {
      const serialized = JSON.stringify(object);
      const matches = referenceTargets.filter((target) => new RegExp(`\\bP?${target}\\b`, 'i').test(serialized));
      if (!matches.length) continue;

      const name = object?.Info?.Name || '(sin nombre)';
      if (matches.some((target) => target.toUpperCase() === String(name).toUpperCase())) continue;
      console.log(`${type} ${name}: ${matches.join(', ')}`);
    }
  }
};

inspect().catch((error) => {
  console.error(error);
  process.exit(1);
});
