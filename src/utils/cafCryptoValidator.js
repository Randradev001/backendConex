const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const { XMLParser } = require('fast-xml-parser');

/**
 * Extrae el nodo DA y la firma FRMA desde el XML original.
 *
 * Importante:
 * Para validar firma no conviene reconstruir DA desde JSON,
 * porque los espacios y formato pueden afectar la validación.
 */
const extractCafSignatureParts = (xmlContent) => {
  const daMatch = xmlContent.match(/<DA>([\s\S]*?)<\/DA>/);
  const frmaMatch = xmlContent.match(/<FRMA[^>]*>([\s\S]*?)<\/FRMA>/);

  if (!daMatch) {
    return {
      success: false,
      message: 'No se encontró el nodo DA en el CAF'
    };
  }

  if (!frmaMatch) {
    return {
      success: false,
      message: 'No se encontró la firma FRMA en el CAF'
    };
  }

  return {
    success: true,
    daXml: daMatch[0],
    frmaBase64: frmaMatch[1].replace(/\s/g, '')
  };
};

/**
 * Construye una llave pública PEM usando RSAPK del CAF.
 *
 * RSAPK contiene:
 * - M: módulo RSA en base64
 * - E: exponente RSA en base64
 */
const buildPublicKeyPemFromCaf = (xmlContent) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true
  });

  const parsedXml = parser.parse(xmlContent);

  const rsapk = parsedXml?.AUTORIZACION?.CAF?.DA?.RSAPK;

  if (!rsapk?.M || !rsapk?.E) {
    return {
      success: false,
      message: 'No se encontró RSAPK con módulo y exponente'
    };
  }

  const key = new NodeRSA();

  key.importKey(
    {
      n: Buffer.from(rsapk.M, 'base64'),
      e: Buffer.from(rsapk.E, 'base64')
    },
    'components-public'
  );

  return {
    success: true,
    publicKeyPem: key.exportKey('public')
  };
};

/**
 * Valida la firma FRMA del CAF.
 *
 * Si retorna isValid = true:
 * - El nodo DA no fue alterado
 * - La firma FRMA coincide con la llave pública RSAPK
 *
 * Si retorna isValid = false:
 * - Puede estar alterado
 * - O puede haber problema de formato/canonicalización XML
 */
const verifyCafFrma = (xmlContent) => {
  try {
    const parts = extractCafSignatureParts(xmlContent);

    if (!parts.success) {
      return {
        success: false,
        isValid: false,
        message: parts.message
      };
    }

    const keyResult = buildPublicKeyPemFromCaf(xmlContent);

    if (!keyResult.success) {
      return {
        success: false,
        isValid: false,
        message: keyResult.message
      };
    }

    const verifier = crypto.createVerify('RSA-SHA1');

    verifier.update(parts.daXml, 'utf8');
    verifier.end();

    const isValid = verifier.verify(
      keyResult.publicKeyPem,
      parts.frmaBase64,
      'base64'
    );

    return {
      success: true,
      isValid,
      message: isValid
        ? 'Firma FRMA del CAF válida'
        : 'Firma FRMA del CAF inválida'
    };
  } catch (error) {
    return {
      success: false,
      isValid: false,
      message: error.message
    };
  }
};

module.exports = {
  verifyCafFrma
};