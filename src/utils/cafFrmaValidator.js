const crypto = require('crypto');

/**
 * Extrae el nodo DA original y la firma FRMA desde el XML del CAF.
 *
 * Importante:
 * No reconstruimos DA desde JSON, porque para validar una firma
 * se necesita el contenido XML tal como viene en el archivo.
 */
const extractDaAndFrma = (xmlContent) => {
  const daMatch = xmlContent.match(/<DA>([\s\S]*?)<\/DA>/);
  const frmaMatch = xmlContent.match(/<FRMA[^>]*>([\s\S]*?)<\/FRMA>/);

  if (!daMatch) {
    return {
      success: false,
      isValid: false,
      message: 'No se encontró el nodo DA en el CAF'
    };
  }

  if (!frmaMatch) {
    return {
      success: false,
      isValid: false,
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
 * Valida la firma FRMA del CAF usando la llave pública del SII.
 *
 * FRMA = firma SHA1withRSA del SII sobre el nodo DA.
 */
const verifyCafFrmaWithSiiKey = ({ xmlContent, siiPublicKeyPem }) => {
  try {
    const parts = extractDaAndFrma(xmlContent);

    if (!parts.success) {
      return {
        success: false,
        isValid: false,
        message: parts.message
      };
    }

    const verifier = crypto.createVerify('RSA-SHA1');

    verifier.update(parts.daXml, 'utf8');
    verifier.end();

    const isValid = verifier.verify(
      siiPublicKeyPem,
      parts.frmaBase64,
      'base64'
    );

    return {
      success: true,
      isValid,
      message: isValid
        ? 'FRMA válida contra llave pública SII'
        : 'FRMA inválida contra llave pública SII'
    };
  } catch (error) {
    return {
      success: false,
      isValid: false,
      message: `Error validando FRMA: ${error.message}`
    };
  }
};

module.exports = {
  verifyCafFrmaWithSiiKey
};