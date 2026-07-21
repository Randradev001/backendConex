const crypto = require('crypto');

/**
 * Escapa caracteres especiales para evitar romper el XML.
 */
const escapeXml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Extrae el nodo CAF completo desde el XML original.
 * Este nodo se inserta dentro del DD del TED.
 */
const extractCafNode = (xmlContent) => {
  const cafMatch = xmlContent.match(/<CAF[\s\S]*?<\/CAF>/);

  if (!cafMatch) {
    throw new Error('No se encontró el nodo CAF dentro del XML');
  }

  return cafMatch[0];
};

/**
 * Extrae la llave privada RSASK desde el CAF.
 * Esta llave se usa para firmar el DD y generar el FRMT.
 */
const extractPrivateKey = (xmlContent) => {
  const rsaskMatch = xmlContent.match(/<RSASK>([\s\S]*?)<\/RSASK>/);

  if (!rsaskMatch) {
    throw new Error('No se encontró la llave privada RSASK dentro del CAF');
  }

  return rsaskMatch[1].trim();
};

/**
 * Genera timestamp formato SII:
 * YYYY-MM-DDTHH:mm:ss
 */
const getTimestampTed = () => {
  return new Date().toISOString().slice(0, 19);
};

/**
 * Construye el nodo DD.
 *
 * DD es el contenido que se firma para generar FRMT.
 */
const buildDdXml = ({
  rutEmisor,
  tipoDte,
  folio,
  fechaEmision,
  rutReceptor,
  razonSocialReceptor,
  montoTotal,
  itemNombre,
  cafXml,
  timestampTed
}) => {
  return [
    '<DD>',
    `<RE>${escapeXml(rutEmisor)}</RE>`,
    `<TD>${tipoDte}</TD>`,
    `<F>${folio}</F>`,
    `<FE>${fechaEmision}</FE>`,
    `<RR>${escapeXml(rutReceptor)}</RR>`,
    `<RSR>${escapeXml(razonSocialReceptor)}</RSR>`,
    `<MNT>${montoTotal}</MNT>`,
    `<IT1>${escapeXml(itemNombre)}</IT1>`,
    cafXml,
    `<TSTED>${timestampTed}</TSTED>`,
    '</DD>'
  ].join('');
};

/**
 * Firma el nodo DD usando la llave privada RSASK.
 *
 * Resultado:
 * FRMT en base64.
 */
const signDd = ({ ddXml, privateKeyPem }) => {
  const signer = crypto.createSign('RSA-SHA1');

  signer.update(ddXml, 'utf8');
  signer.end();

  return signer.sign(privateKeyPem, 'base64');
};

/**
 * Construye el TED completo:
 *
 * <TED>
 *   <DD>...</DD>
 *   <FRMT>...</FRMT>
 * </TED>
 */
const buildTed = ({
  cafXmlContent,
  rutEmisor,
  tipoDte,
  folio,
  fechaEmision,
  rutReceptor,
  razonSocialReceptor,
  montoTotal,
  itemNombre
}) => {
  const cafXml = extractCafNode(cafXmlContent);
  const privateKeyPem = extractPrivateKey(cafXmlContent);
  const timestampTed = getTimestampTed();

  const ddXml = buildDdXml({
    rutEmisor,
    tipoDte,
    folio,
    fechaEmision,
    rutReceptor,
    razonSocialReceptor,
    montoTotal,
    itemNombre,
    cafXml,
    timestampTed
  });

  const frmt = signDd({
    ddXml,
    privateKeyPem
  });

  const tedXml = [
    '<TED version="1.0">',
    ddXml,
    `<FRMT algoritmo="SHA1withRSA">${frmt}</FRMT>`,
    '</TED>'
  ].join('');

  return {
    tedXml,
    ddXml,
    frmt,
    timestampTed
  };
};

module.exports = {
  buildTed
};