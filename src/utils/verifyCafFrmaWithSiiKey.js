const crypto = require('crypto');

/**
 * Extrae el nodo DA original y la firma FRMA.
 *
 * Importante:
 * Para validar firmas no conviene reconstruir DA desde JSON,
 * porque cualquier cambio de espacios o formato puede alterar la verificación.
 */
const extractDaAndFrma = (xmlContent) => {
  const daMatch = xmlContent.match(/<DA>([\s\S]*?)<\/DA>/);
  const frmaMatch = xmlContent.match(/<FRMA[^>]*>([\s\S]*?)<\/FRMA>/);

  if (!daMatch) {
    return {
      success: false,
      message: 'No se encontró el nodo DA'
    };
  }

  if (!frmaMatch) {
    return {
      success: false,
      message: 'No se encontró la firma FRMA'
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
      message: error.message
    };
  }
};

module.exports = {
  verifyCafFrmaWithSiiKey
};