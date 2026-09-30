const CORE_VERSION = 'conex-1';
const DPI_VALUES = new Set([152, 203, 300, 600]);
const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,49}$/i;

class ZplValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ZplValidationError';
    this.status = 400;
    this.code = 'INVALID_LABEL_DESIGN';
    this.details = details;
  }
}

const VARIABLE_SAMPLES = Object.freeze({
  calibre: '00LL',
  calibre_sin_ceros: 'XLD'
});

const numeric = (value, fallback = 0) => {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const integer = (value, fallback = 0) => Math.round(numeric(value, fallback));
const clampInteger = (value, min, max, fallback) => Math.min(max, Math.max(min, integer(value, fallback)));
const mmToDots = (mm, dpi) => Math.round(numeric(mm) * numeric(dpi) / 25.4);
const dotsToMm = (dots, dpi) => Number((numeric(dots) * 25.4 / numeric(dpi)).toFixed(3));

const newElementId = (index) => `zpl-${index + 1}`;
const rotationFromZpl = (value) => ({ N: 0, R: 90, I: 180, B: 270 }[String(value || 'N').toUpperCase()] ?? 0);
const rotationToZpl = (value) => ({ 0: 'N', 90: 'R', 180: 'I', 270: 'B' }[integer(value)] || 'N');

const tokenizeZpl = (source) => {
  const zpl = String(source ?? '');
  const tokens = [];
  let cursor = 0;
  while (cursor < zpl.length) {
    const caret = zpl.indexOf('^', cursor);
    const tilde = zpl.indexOf('~', cursor);
    let start;
    if (caret < 0) start = tilde;
    else if (tilde < 0) start = caret;
    else start = Math.min(caret, tilde);
    if (start < 0) break;
    if (start + 2 >= zpl.length) break;
    const nextCaret = zpl.indexOf('^', start + 3);
    const nextTilde = zpl.indexOf('~', start + 3);
    let end = zpl.length;
    if (nextCaret >= 0) end = nextCaret;
    if (nextTilde >= 0) end = Math.min(end, nextTilde);
    const raw = zpl.slice(start, end);
    tokens.push({
      prefix: zpl[start],
      code: zpl.slice(start + 1, start + 3).toUpperCase(),
      payload: zpl.slice(start + 3, end),
      raw,
      start,
      end
    });
    cursor = end;
  }
  return tokens;
};

const parsePair = (payload) => {
  const values = String(payload || '').split(',');
  return [integer(values[0]), integer(values[1])];
};

const parseFont = (token) => {
  const values = token.payload.split(',');
  const font = token.code === 'A0' ? '0' : token.code.slice(1, 2) || '0';
  const rotation = rotationFromZpl(values.shift()?.slice(0, 1));
  return {
    font,
    rotation,
    heightDots: Math.max(1, integer(values[0], 30)),
    widthDots: Math.max(1, integer(values[1], integer(values[0], 30)))
  };
};

const parseVariables = (content) => {
  const result = [];
  const seen = new Set();
  for (const match of String(content || '').matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)) {
    const name = match[1].toLowerCase();
    if (!seen.has(name)) {
      seen.add(name);
      result.push({ name, label: name, dataType: 'text', required: false, sampleValue: VARIABLE_SAMPLES[name] || name.toUpperCase() });
    }
  }
  return result;
};

const parseZpl = (input, options = {}) => {
  const originalZpl = String(input ?? '');
  if (!originalZpl.trim()) throw new ZplValidationError('El ZPL esta vacio.');
  const tokens = tokenizeZpl(originalZpl);
  const xa = tokens.find((token) => token.prefix === '^' && token.code === 'XA');
  const xz = [...tokens].reverse().find((token) => token.prefix === '^' && token.code === 'XZ');
  if (!xa || !xz || xa.start >= xz.start) throw new ZplValidationError('El ZPL debe contener un bloque ^XA ... ^XZ valido.');

  const dpi = DPI_VALUES.has(Number(options.dpi)) ? Number(options.dpi) : 203;
  let widthDots = Math.max(1, integer(options.widthDots, mmToDots(options.widthMm || 100, dpi)));
  let heightDots = Math.max(1, integer(options.heightDots, mmToDots(options.heightMm || 50, dpi)));
  let position = { x: 0, y: 0, mode: 'FO', start: null };
  let font = { font: '0', rotation: 0, heightDots: 30, widthDots: 30 };
  let fieldRotation = 0;
  let reversed = false;
  let by = { moduleWidth: 2, ratio: 3, heightDots: 50 };
  let bySourceStart = null;
  let pending = null;
  let content = '';
  const elements = [];
  const supported = new Set(['XA', 'XZ', 'PW', 'LL', 'FO', 'FT', 'FD', 'FS', 'A0', 'GB', 'BC', 'BQ', 'BY', 'FW', 'FR', 'GF', 'XG']);
  const passthroughCommands = [];

  const beginField = (token) => {
    if (position.start === null) position.start = token.start;
    return position.start;
  };

  const flush = (end) => {
    if (!pending && !content) {
      position.start = null;
      reversed = false;
      return;
    }
    const sourceStart = position.start ?? pending?.start ?? end;
    const base = {
      id: newElementId(elements.length),
      xDots: position.x,
      yDots: position.y,
      widthDots: 1,
      heightDots: 1,
      rotation: pending?.rotation ?? font.rotation ?? fieldRotation,
      positionMode: position.mode,
      reversed,
      zIndex: elements.length,
      visible: true,
      locked: false,
      dirty: false,
      source: { start: sourceStart, end, original: originalZpl.slice(sourceStart, end) }
    };
    let element;
    if (pending?.type === 'box') {
      const [width, height, thickness, color, rounding] = pending.values;
      const line = width === 0 || height === 0;
      element = {
        ...base,
        type: line ? 'line' : 'rectangle',
        widthDots: Math.max(1, width || thickness || 1),
        heightDots: Math.max(1, height || thickness || 1),
        thicknessDots: Math.max(1, thickness || 1),
        color: color || 'B',
        cornerRounding: Math.max(0, rounding || 0),
        direction: width === 0 ? 'vertical' : 'horizontal'
      };
    } else if (pending?.type === 'barcode') {
      const params = pending.values;
      element = {
        ...base,
        type: 'barcode',
        symbology: 'code128',
        content,
        widthDots: Math.max(40, content.length * by.moduleWidth * 11),
        heightDots: Math.max(1, integer(params[1], by.heightDots)),
        moduleWidth: by.moduleWidth,
        ratio: by.ratio,
        humanReadable: String(params[2] || 'Y').toUpperCase() === 'Y'
      };
    } else if (pending?.type === 'qr') {
      const params = pending.values;
      const magnification = clampInteger(params[2], 1, 10, 4);
      element = {
        ...base,
        type: 'qr',
        content: content.replace(/^[A-Z]{1,2},/i, ''),
        widthDots: 29 * magnification,
        heightDots: 29 * magnification,
        magnification,
        errorCorrection: 'M'
      };
    } else if (pending?.type === 'image') {
      element = {
        ...base,
        type: 'image',
        graphicKind: pending.graphicKind,
        rawZpl: pending.raw,
        printerResourceName: pending.resourceName || null,
        unresolved: pending.graphicKind === 'stored-xg',
        widthDots: Math.max(1, pending.widthDots || 1),
        heightDots: Math.max(1, pending.heightDots || 1)
      };
    } else {
      element = {
        ...base,
        type: 'text',
        content,
        font: font.font,
        fontHeightDots: font.heightDots,
        fontWidthDots: font.widthDots,
        widthDots: Math.max(font.widthDots, content.length * font.widthDots),
        heightDots: font.heightDots
      };
    }
    elements.push(element);
    pending = null;
    content = '';
    position.start = null;
    reversed = false;
  };

  for (const token of tokens) {
    if (token.start < xa.start || token.start > xz.start) continue;
    if (token.code === 'PW') widthDots = Math.max(1, integer(token.payload, widthDots));
    else if (token.code === 'LL') heightDots = Math.max(1, integer(token.payload, heightDots));
    else if (token.code === 'FO' || token.code === 'FT') {
      const [x, y] = parsePair(token.payload);
      position = { x, y, mode: token.code, start: token.start };
    } else if (token.code === 'FW') {
      fieldRotation = rotationFromZpl(token.payload.slice(0, 1));
    } else if (token.code === 'FR') reversed = true;
    else if (token.code[0] === 'A' && token.prefix === '^') font = parseFont(token);
    else if (token.code === 'BY') {
      const values = token.payload.split(',');
      bySourceStart = token.start;
      by = {
        moduleWidth: clampInteger(values[0], 1, 10, by.moduleWidth),
        ratio: numeric(values[1], by.ratio),
        heightDots: Math.max(1, integer(values[2], by.heightDots))
      };
    } else if (token.code === 'GB') {
      beginField(token);
      const values = token.payload.split(',');
      pending = { type: 'box', start: token.start, values: [integer(values[0]), integer(values[1]), integer(values[2], 1), values[3], integer(values[4])] };
    } else if (token.code === 'BC') {
      if (bySourceStart !== null && bySourceStart < (position.start ?? token.start)) position.start = bySourceStart;
      bySourceStart = null;
      beginField(token);
      pending = { type: 'barcode', start: token.start, rotation: rotationFromZpl(token.payload.slice(0, 1)), values: token.payload.split(',') };
    } else if (token.code === 'BQ') {
      beginField(token);
      pending = { type: 'qr', start: token.start, rotation: rotationFromZpl(token.payload.slice(0, 1)), values: token.payload.split(',') };
    } else if (token.code === 'GF') {
      beginField(token);
      const values = token.payload.split(',');
      pending = { type: 'image', start: token.start, graphicKind: 'inline-gf', raw: token.raw, widthDots: integer(values[3]) * 8 };
    } else if (token.code === 'XG') {
      beginField(token);
      pending = { type: 'image', start: token.start, graphicKind: 'stored-xg', raw: token.raw, resourceName: token.payload.split(',')[0] };
    } else if (token.code === 'FD') content = token.payload;
    else if (token.code === 'FS') flush(token.end);
    else if (!supported.has(token.code) && token.code[0] !== 'A') {
      passthroughCommands.push({ code: `${token.prefix}${token.code}`, start: token.start, end: token.end, raw: token.raw });
    }
  }
  if (pending || content) flush(xz.start);

  const variables = parseVariables(elements.map((element) => element.content || '').join('\n'));
  return {
    schemaVersion: 1,
    name: String(options.name || 'Etiqueta importada').slice(0, 100),
    description: String(options.description || '').slice(0, 250),
    widthMm: dotsToMm(widthDots, dpi),
    heightMm: dotsToMm(heightDots, dpi),
    dpi,
    widthDots,
    heightDots,
    elements,
    variables,
    importState: {
      parserVersion: CORE_VERSION,
      originalZpl,
      sourceElements: elements.map((element) => ({ id: element.id, ...element.source })),
      passthroughCommands,
      roundTripMode: 'patch'
    }
  };
};

const escapeFieldData = (value) => String(value ?? '')
  .replace(/\\/g, '\\5C')
  .replace(/\^/g, '\\5E')
  .replace(/~/g, '\\7E');

const variableMap = (document, values = {}, useSamples = false) => Object.fromEntries(
  (document.variables || []).map((variable) => {
    const supplied = Object.prototype.hasOwnProperty.call(values, variable.name) ? values[variable.name] : undefined;
    const storedSample = String(variable.sampleValue ?? '').trim();
    const isGenericSample = storedSample.toUpperCase() === String(variable.name || '').toUpperCase();
    const sample = !storedSample || isGenericSample ? VARIABLE_SAMPLES[variable.name] || storedSample : storedSample;
    const fallback = useSamples ? sample || variable.defaultValue || `{{${variable.name}}}` : variable.defaultValue ?? `{{${variable.name}}}`;
    return [variable.name, supplied ?? fallback];
  })
);

const resolveContent = (content, document, values, useSamples) => {
  const resolved = variableMap(document, values, useSamples);
  return String(content ?? '').replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (match, name) => (
    Object.prototype.hasOwnProperty.call(resolved, name.toLowerCase()) ? String(resolved[name.toLowerCase()]) : match
  ));
};

const compileElement = (element, document, options = {}) => {
  const position = `^${element.positionMode === 'FT' ? 'FT' : 'FO'}${integer(element.xDots)},${integer(element.yDots)}`;
  const reverse = element.reversed ? '^FR' : '';
  const rotation = rotationToZpl(element.rotation);
  const content = escapeFieldData(resolveContent(element.content, document, options.variableValues, options.useSamples));
  if (element.type === 'text') {
    const font = String(element.font || '0').slice(0, 1).toUpperCase();
    return `${position}^A${font}${rotation},${Math.max(1, integer(element.fontHeightDots, 30))},${Math.max(1, integer(element.fontWidthDots, element.fontHeightDots || 30))}${reverse}^FH\\^FD${content}^FS`;
  }
  if (element.type === 'barcode') {
    const human = element.humanReadable === false ? 'N' : 'Y';
    return `^BY${clampInteger(element.moduleWidth, 1, 10, 2)},${numeric(element.ratio, 3)},${Math.max(1, integer(element.heightDots, 50))}${position}^BC${rotation},${Math.max(1, integer(element.heightDots, 50))},${human},N${reverse}^FH\\^FD${content}^FS`;
  }
  if (element.type === 'qr') {
    return `${position}^BQ${rotation},2,${clampInteger(element.magnification, 1, 10, 4)}${reverse}^FH\\^FDLA,${content}^FS`;
  }
  if (element.type === 'rectangle') {
    return `${position}^GB${Math.max(1, integer(element.widthDots))},${Math.max(1, integer(element.heightDots))},${Math.max(1, integer(element.thicknessDots, 1))},${element.color || 'B'},${Math.max(0, integer(element.cornerRounding))}^FS`;
  }
  if (element.type === 'line') {
    const vertical = element.direction === 'vertical';
    return `${position}^GB${vertical ? 0 : Math.max(1, integer(element.widthDots))},${vertical ? Math.max(1, integer(element.heightDots)) : 0},${Math.max(1, integer(element.thicknessDots, 1))},B,0^FS`;
  }
  if (element.type === 'image' && element.rawZpl) return `${position}${element.rawZpl}^FS`;
  if (element.type === 'raw-zpl') return String(element.raw || '');
  throw new ZplValidationError(`Tipo de elemento no soportado: ${element.type}`);
};

const validateDocument = (raw) => {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) errors.push('El documento debe ser un objeto JSON.');
  const document = raw && typeof raw === 'object' ? raw : {};
  const dpi = Number(document.dpi);
  if (!DPI_VALUES.has(dpi)) errors.push('El DPI debe ser 152, 203, 300 o 600.');
  if (!Number.isFinite(Number(document.widthMm)) || Number(document.widthMm) <= 0 || Number(document.widthMm) > 381) errors.push('El ancho debe estar entre 0 y 381 mm.');
  if (!Number.isFinite(Number(document.heightMm)) || Number(document.heightMm) <= 0 || Number(document.heightMm) > 381) errors.push('El alto debe estar entre 0 y 381 mm.');
  if (!Array.isArray(document.elements)) errors.push('La lista de elementos es obligatoria.');
  else if (document.elements.length > 500) errors.push('La etiqueta admite hasta 500 elementos.');
  else {
    const elementIds = new Set();
    const supportedTypes = new Set(['text', 'barcode', 'qr', 'rectangle', 'line', 'image', 'raw-zpl']);
    for (const [index, element] of document.elements.entries()) {
      const id = String(element?.id || '').trim();
      if (!id) errors.push(`El elemento ${index + 1} no tiene identificador.`);
      else if (elementIds.has(id)) errors.push(`Identificador de elemento duplicado: ${id}.`);
      elementIds.add(id);
      if (!supportedTypes.has(element?.type)) errors.push(`Tipo de elemento no valido: ${element?.type || '(vacio)'}.`);
      for (const coordinate of ['xDots', 'yDots']) {
        if (!Number.isFinite(Number(element?.[coordinate]))) errors.push(`El elemento ${id || index + 1} tiene ${coordinate} invalido.`);
      }
    }
  }
  if (!Array.isArray(document.variables)) errors.push('La lista de variables es obligatoria.');
  else {
    const names = new Set();
    for (const variable of document.variables) {
      const name = String(variable?.name || '').toLowerCase();
      if (!VARIABLE_NAME.test(name)) errors.push(`Nombre de variable no valido: ${name || '(vacio)'}.`);
      if (names.has(name)) errors.push(`Variable duplicada: ${name}.`);
      names.add(name);
    }
  }
  if (errors.length) throw new ZplValidationError('El diseño de etiqueta no es valido.', errors);
  return {
    ...document,
    schemaVersion: 1,
    name: String(document.name || 'Etiqueta').trim().slice(0, 100),
    description: String(document.description || '').trim().slice(0, 250),
    dpi,
    widthMm: Number(document.widthMm),
    heightMm: Number(document.heightMm),
    widthDots: Math.max(1, integer(document.widthDots, mmToDots(document.widthMm, dpi))),
    heightDots: Math.max(1, integer(document.heightDots, mmToDots(document.heightMm, dpi)))
  };
};

const generateZpl = (rawDocument, options = {}) => {
  const document = validateDocument(rawDocument);
  const currentIds = new Set(document.elements.map((element) => element.id));
  const original = document.importState?.originalZpl;
  const sourceElements = document.importState?.sourceElements || [];
  if (original && document.importState?.roundTripMode === 'patch') {
    const replacements = [];
    for (const source of sourceElements) {
      const element = document.elements.find((candidate) => candidate.id === source.id);
      if (!element) replacements.push({ start: source.start, end: source.end, value: '' });
      else if (element.dirty || options.variableValues || options.useSamples) {
        replacements.push({ start: source.start, end: source.end, value: compileElement(element, document, options) });
      }
    }
    let output = original;
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
      output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end);
    }
    const additions = document.elements.filter((element) => !sourceElements.some((source) => source.id === element.id));
    if (additions.length) {
      const insertion = additions.map((element) => compileElement(element, document, options)).join('\n');
      const closing = output.toUpperCase().lastIndexOf('^XZ');
      output = closing >= 0 ? `${output.slice(0, closing)}${insertion}\n${output.slice(closing)}` : `${output}\n${insertion}`;
    }
    if (!replacements.length && !additions.length && sourceElements.every((source) => currentIds.has(source.id))) return original;
    return output;
  }
  const fields = document.elements
    .filter((element) => element.visible !== false)
    .sort((left, right) => numeric(left.zIndex) - numeric(right.zIndex))
    .map((element) => compileElement(element, document, options));
  return ['^XA', `^PW${document.widthDots}`, `^LL${document.heightDots}`, ...fields, '^XZ'].join('\n');
};

module.exports = {
  CORE_VERSION,
  DPI_VALUES,
  VARIABLE_SAMPLES,
  ZplValidationError,
  mmToDots,
  dotsToMm,
  tokenizeZpl,
  parseZpl,
  validateDocument,
  generateZpl,
  escapeFieldData,
  resolveContent
};
