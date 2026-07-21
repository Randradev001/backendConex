
const { getPool, sql } = require('../conectorMysql/conectorSqlServer');

const { generateBoletaDteXml } = require('../services/boletaXML.service');
const { XMLParser } = require('fast-xml-parser');

const { verifyCafFrmaWithSiiKey } = require('../utils/cafFrmaValidator');

const buildTedData = ({ data, total, cafXml }) => {
return {
RE: data.emisor.rut,
TD: 39,
F: data.folio,
FE: data.fechaEmision,
RR: data.receptor?.rut || '66666666-6',
RSR: data.receptor?.razonSocial || 'CONSUMIDOR FINAL',
MNT: total,
IT1: data.items[0]?.descripcion || 'ITEM',
CAF: cafXml || 'PENDIENTE_CAF_REAL',
TSTED: new Date().toISOString(),
FRMT: 'PENDIENTE_FIRMA_TED',
};
};
module.exports = { buildTedData };

const createBoletaDte = async (req, res) => {
  try {
    const data = req.body;

    const { xml, total } = generateBoletaDteXml(data);

    const pool = await getPool();

    const result = await pool.request()
      .input('tipoDte', sql.Int, 39)
      .input('folio', sql.Int, data.folio)
      .input('rutEmisor', sql.VarChar(20), data.emisor.rut)
      .input('rutReceptor', sql.VarChar(20), data.receptor?.rut || '66666666-6')
      .input('montoTotal', sql.Int, total)
      .input('xmlContent', sql.NVarChar(sql.MAX), xml)
      .input('estado', sql.VarChar(30), 'GENERADO')
      .query(`
        INSERT INTO fact_Documents
        (
          FactTipoDte,
          FactFolio,
          FactRutEmisor,
          FactRutReceptor,
          FactMontoTotal,
          XmlContent,
          Estado,
          CreatedAt,
          FactCompanyId
        )
        OUTPUT INSERTED.Id
        VALUES
        (
          @tipoDte,
          @folio,
          @rutEmisor,
          @rutReceptor,
          @montoTotal,
          @xmlContent,
          @estado,
          GETDATE(),
          (SELECT TOP 1 Id FROM Fact_Companies WHERE ComRut = @rutEmisor ORDER BY Id DESC)

        )
      `);

      /*
      
      
CREATE TABLE fact_Documents (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  FactTipoDte INT NOT NULL,
  FactFolio INT NOT NULL,
  FactRutEmisor VARCHAR(20) NOT NULL,
  FactRutReceptor VARCHAR(20) NULL,
  FactMontoTotal INT NOT NULL,
  XmlContent NVARCHAR(MAX) NOT NULL,
  Estado VARCHAR(30) NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
 
);

      */

    res.json({
      success: true,
      message: 'Boleta DTE XML generada y guardada',
      documentId: result.recordset[0].Id,
      total,
      xml,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generando XML DTE',
      error: error.message,
    });
  }
  console.log("Entró al endpoint DTE");
console.log(req.body);
};

const getDteById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT *
        FROM fact_Documents
        WHERE Id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'DTE no encontrado' });
    }
          res.json({ success: true, document: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error consultando DTE', error: error.message });
    }
  };


const getDtes = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT *
      FROM fact_Documents
      ORDER BY Id DESC
    `);
      res.json({ success: true, documents: result.recordset });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error listando DTEs', error: error.message });
    }
};

const createCompany = async (req, res) => {
  try {
    const data = req.body;
    const pool = await getPool();

console.log("Datos recibidos para crear empresa:", data);

    const result = await pool.request()
      .input('rut', sql.VarChar(20), data.rut)
      .input('razonSocial', sql.VarChar(200), data.razonSocial)
      .input('giro', sql.VarChar(200), data.giro || null)
      .input('direccion', sql.VarChar(200), data.direccion || null)
      .input('factComunaId', sql.Int, data.comunaId)
      .query(`
        INSERT INTO Fact_Companies
        (
          ComRut,
          ComRazonSocial,
          ComGiro,
          ComDireccion,
          FactComunaId
        )
        OUTPUT INSERTED.Id
        VALUES
        (
          @rut,
          @razonSocial,
          @giro,
          @direccion,
          @factComunaId
        )
      `);

    res.json({
      success: true,
      message: 'Empresa creada correctamente',
      companyId: result.recordset[0].Id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creando empresa',
      error: error.message,
    });
  }
};

const getCompanies = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT
        C.Id,
        C.ComRut,
        C.ComRazonSocial,
        C.ComGiro,
        C.ComDireccion,
        CO.ComNombre AS Comuna,
        CI.CitNombre AS Ciudad,
        R.RegNombre AS Region,
        P.CouNombre AS Pais,
        C.ComActiva,
        C.ComCreatedAt
      FROM Fact_Companies C
      INNER JOIN Fact_Comunas CO
        ON CO.Id = C.FactComunaId
      INNER JOIN Fact_Cities CI
        ON CI.Id = CO.FactCityId
      INNER JOIN Fact_Regions R
        ON R.Id = CI.FactRegionId
      INNER JOIN Fact_Countries P
        ON P.Id = R.FactCountryId
      ORDER BY C.Id DESC
    `);

    res.json({
      success: true,
      companies: result.recordset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error listando empresas',
      error: error.message,
    });
  }
};
const getComunas = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        Id,
        ComNombre
      FROM Fact_Comunas
      ORDER BY ComNombre ASC
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error obteniendo comunas:', error);

    return res.status(500).json({
      success: false,
      message: 'Error obteniendo comunas'
    });
  }
};




const uploadCaf = async (req, res) => {
  try {
    /**
     * ============================================================
     * 1. VALIDAR DATOS DE ENTRADA
     * ============================================================
     */
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar una empresa'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Debe subir un archivo CAF XML'
      });
    }

    /**
     * El archivo CAF viene desde multer como buffer.
     * Lo convertimos a texto para parsearlo y luego guardarlo.
     */
    const xmlContent = req.file.buffer.toString('utf8');

    /**
     * ============================================================
     * 2. PARSEAR XML
     * ============================================================
     */
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      trimValues: true
    });

    let parsedXml;

    try {
      parsedXml = parser.parse(xmlContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'El archivo no es un XML válido',
        error: parseError.message
      });
    }

    /**
     * ============================================================
     * 3. VALIDAR ESTRUCTURA BASE DEL CAF
     * ============================================================
     *
     * Estructura esperada:
     *
     * AUTORIZACION
     * └── CAF
     *     └── DA
     */
    const autorizacion = parsedXml?.AUTORIZACION;
    const caf = autorizacion?.CAF;
    const da = caf?.DA;

    if (!autorizacion || !caf || !da) {
      return res.status(400).json({
        success: false,
        message: 'El archivo XML no tiene estructura válida de CAF'
      });
    }

    /**
     * ============================================================
     * 4. EXTRAER DATOS PRINCIPALES DEL CAF
     * ============================================================
     */
    const rutEmisor = da.RE;
    const razonSocial = da.RS;
    const tipoDte = Number(da.TD);
    const folioDesde = Number(da.RNG?.D);
    const folioHasta = Number(da.RNG?.H);
    const fechaAutorizacion = da.FA;
    const idk = da.IDK ? Number(da.IDK) : null;

    if (!rutEmisor || !tipoDte || !folioDesde || !folioHasta || !fechaAutorizacion) {
      return res.status(400).json({
        success: false,
        message: 'No fue posible leer los datos principales del CAF'
      });
    }

    /**
     * IDK identifica la llave pública SII que debería validar FRMA.
     */
    if (!idk) {
      return res.status(400).json({
        success: false,
        message: 'El CAF no contiene IDK'
      });
    }

    /**
     * ============================================================
     * 5. VALIDAR PRESENCIA DE FIRMA Y LLAVES
     * ============================================================
     *
     * FRMA:
     * Firma del SII sobre DA.
     *
     * RSASK:
     * Llave privada usada para firmar el TED.
     *
     * RSAPUBK / RSAPK:
     * Llave pública asociada al CAF.
     */
    if (!caf.FRMA) {
      return res.status(400).json({
        success: false,
        message: 'El CAF no contiene firma FRMA'
      });
    }

    if (!autorizacion.RSASK) {
      return res.status(400).json({
        success: false,
        message: 'El CAF no contiene llave privada RSASK'
      });
    }

    if (!autorizacion.RSAPUBK && !da.RSAPK) {
      return res.status(400).json({
        success: false,
        message: 'El CAF no contiene llave pública'
      });
    }

    /**
     * ============================================================
     * 6. VALIDAR TIPO DTE PERMITIDO
     * ============================================================
     *
     * Por ahora sólo permitimos boleta electrónica tipo 39.
     */
    const allowedDteTypes = [39];

    if (!allowedDteTypes.includes(tipoDte)) {
      return res.status(400).json({
        success: false,
        message: `Tipo DTE no permitido para este módulo. Tipo recibido: ${tipoDte}`
      });
    }

    /**
     * ============================================================
     * 7. VALIDAR RANGO DE FOLIOS
     * ============================================================
     */
    if (folioDesde <= 0 || folioHasta <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Los folios del CAF deben ser mayores a cero'
      });
    }

    if (folioDesde > folioHasta) {
      return res.status(400).json({
        success: false,
        message: 'El rango de folios del CAF no es válido'
      });
    }

    /**
     * ============================================================
     * 8. VALIDAR FECHA DE AUTORIZACIÓN Y VENCIMIENTO
     * ============================================================
     */
    const fechaAut = new Date(fechaAutorizacion);

    if (Number.isNaN(fechaAut.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de autorización del CAF no es válida'
      });
    }

    const fechaVencimiento = new Date(fechaAut);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 6);

    if (new Date() > fechaVencimiento) {
      return res.status(400).json({
        success: false,
        message: 'El CAF se encuentra vencido',
        detail: {
          fechaAutorizacion,
          fechaVencimiento
        }
      });
    }

    /**
     * ============================================================
     * 9. CONECTAR A BASE DE DATOS
     * ============================================================
     */
    const pool = await getPool();

    /**
     * ============================================================
     * 10. VALIDAR QUE LA EMPRESA EXISTA
     * ============================================================
     */
    const companyResult = await pool
      .request()
      .input('CompanyId', sql.Int, Number(companyId))
      .query(`
        SELECT 
          Id,
          ComRut,
          ComRazonSocial
        FROM Fact_Companies
        WHERE Id = @CompanyId
      `);

    if (companyResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'La empresa seleccionada no existe'
      });
    }

    const company = companyResult.recordset[0];

    /**
     * Normaliza RUT para comparar.
     *
     * Ejemplo:
     * 76.286.392-8 => 76286392-8
     */
    const normalizeRut = (rut = '') => {
      return String(rut)
        .replace(/\./g, '')
        .replace(/\s/g, '')
        .toUpperCase()
        .trim();
    };

    /**
     * ============================================================
     * 11. VALIDAR RUT DEL CAF CONTRA EMPRESA
     * ============================================================
     */
    if (normalizeRut(rutEmisor) !== normalizeRut(company.ComRut)) {
      return res.status(400).json({
        success: false,
        message: 'El RUT del CAF no corresponde a la empresa seleccionada',
        detail: {
          rutEmpresa: company.ComRut,
          rutCaf: rutEmisor
        }
      });
    }

    /**
     * ============================================================
     * 12. VALIDAR DUPLICIDAD EXACTA
     * ============================================================
     *
     * Evita subir dos veces el mismo CAF.
     */
    const sameCafResult = await pool
      .request()
      .input('CompanyId', sql.Int, Number(companyId))
      .input('TipoDte', sql.Int, tipoDte)
      .input('RutEmisor', sql.VarChar(20), rutEmisor)
      .input('FolioDesde', sql.Int, folioDesde)
      .input('FolioHasta', sql.Int, folioHasta)
      .input('FechaAutorizacion', sql.Date, fechaAutorizacion)
      .query(`
        SELECT TOP 1 Id
        FROM Fact_CafFiles
        WHERE FactCompanyId = @CompanyId
          AND TipoDte = @TipoDte
          AND RutEmisor = @RutEmisor
          AND FolioDesde = @FolioDesde
          AND FolioHasta = @FolioHasta
          AND FechaAutorizacion = @FechaAutorizacion
      `);

    if (sameCafResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este CAF ya fue cargado anteriormente'
      });
    }

    /**
     * ============================================================
     * 13. VALIDAR SOLAPAMIENTO DE FOLIOS
     * ============================================================
     *
     * Evita tener dos CAF activos con rangos cruzados.
     */
    const overlapResult = await pool
      .request()
      .input('CompanyId', sql.Int, Number(companyId))
      .input('TipoDte', sql.Int, tipoDte)
      .input('FolioDesde', sql.Int, folioDesde)
      .input('FolioHasta', sql.Int, folioHasta)
      .query(`
        SELECT 
          Id,
          TipoDte,
          FolioDesde,
          FolioHasta,
          FolioActual,
          FechaAutorizacion
        FROM Fact_CafFiles
        WHERE FactCompanyId = @CompanyId
          AND TipoDte = @TipoDte
          AND Activo = 1
          AND (
            @FolioDesde BETWEEN FolioDesde AND FolioHasta
            OR @FolioHasta BETWEEN FolioDesde AND FolioHasta
            OR FolioDesde BETWEEN @FolioDesde AND @FolioHasta
            OR FolioHasta BETWEEN @FolioDesde AND @FolioHasta
          )
      `);

    if (overlapResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El rango de folios del CAF se sobrepone con otro CAF activo',
        overlaps: overlapResult.recordset
      });
    }

    /**
     * ============================================================
     * 14. VALIDACIÓN CRIPTOGRÁFICA FRMA
     * ============================================================
     *
     * Si existe llave pública SII para el IDK + ambiente:
     * - Se valida FRMA.
     *
     * Si no existe:
     * - Se guarda como PENDING_CRYPTO.
     */
    const environment = 'CERTIFICACION';

    let validationStatus = 'PENDING_CRYPTO';
    let validationMessage =
      `CAF validado funcionalmente. Validación criptográfica FRMA pendiente por llave pública SII IDK ${idk}.`;

    const siiKeyResult = await pool
      .request()
      .input('Idk', sql.Int, idk)
      .input('Environment', sql.VarChar(20), environment)
      .query(`
        SELECT TOP 1 PublicKeyPem
        FROM Fact_SiiPublicKeys
        WHERE Idk = @Idk
          AND Environment = @Environment
          AND Activo = 1
      `);

    if (siiKeyResult.recordset.length > 0) {
      const siiPublicKeyPem = siiKeyResult.recordset[0].PublicKeyPem;

      const frmaValidation = verifyCafFrmaWithSiiKey({
        xmlContent,
        siiPublicKeyPem
      });

      /**
       * Si existe llave pública SII pero la validación falla,
       * rechazamos el CAF.
       */
      if (!frmaValidation.success || !frmaValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'El CAF no pasó la validación criptográfica FRMA',
          detail: frmaValidation.message
        });
      }

      validationStatus = 'CRYPTO_VALIDATED';
      validationMessage =
        `CAF validado funcional y criptográficamente contra llave pública SII IDK ${idk}.`;
    }

    /**
     * ============================================================
     * 15. GUARDAR CAF
     * ============================================================
     *
     * FolioActual representa el próximo folio disponible.
     *
     * Ejemplo:
     * FolioDesde = 1
     * FolioHasta = 50
     * FolioActual = 1
     */
    await pool
      .request()
      .input('CompanyId', sql.Int, Number(companyId))
      .input('TipoDte', sql.Int, tipoDte)
      .input('RutEmisor', sql.VarChar(20), rutEmisor)
      .input('FolioDesde', sql.Int, folioDesde)
      .input('FolioHasta', sql.Int, folioHasta)
      .input('FolioActual', sql.Int, folioDesde)
      .input('FechaAutorizacion', sql.Date, fechaAutorizacion)
      .input('FechaVencimiento', sql.Date, fechaVencimiento)
      .input('Idk', sql.Int, idk)
      .input('XmlContent', sql.NVarChar(sql.MAX), xmlContent)
      .input('Activo', sql.Bit, true)
      .input('ValidationStatus', sql.VarChar(50), validationStatus)
      .input('ValidationMessage', sql.NVarChar(500), validationMessage)
      .query(`
        INSERT INTO Fact_CafFiles (
          FactCompanyId,
          TipoDte,
          RutEmisor,
          FolioDesde,
          FolioHasta,
          FolioActual,
          FechaAutorizacion,
          FechaVencimiento,
          Idk,
          XmlContent,
          Activo,
          ValidationStatus,
          ValidationMessage
        )
        VALUES (
          @CompanyId,
          @TipoDte,
          @RutEmisor,
          @FolioDesde,
          @FolioHasta,
          @FolioActual,
          @FechaAutorizacion,
          @FechaVencimiento,
          @Idk,
          @XmlContent,
          @Activo,
          @ValidationStatus,
          @ValidationMessage
        )
      `);

    /**
     * ============================================================
     * 16. RESPUESTA EXITOSA
     * ============================================================
     */
    return res.status(201).json({
      success: true,
      message:
        validationStatus === 'CRYPTO_VALIDATED'
          ? 'CAF cargado y validado criptográficamente.'
          : 'CAF cargado correctamente. Validación criptográfica pendiente.',
      caf: {
        companyId: Number(companyId),
        rutEmisor,
        razonSocial,
        tipoDte,
        folioDesde,
        folioHasta,
        folioActual: folioDesde,
        fechaAutorizacion,
        fechaVencimiento,
        idk,
        environment,
        validationStatus,
        validationMessage
      }
    });
  } catch (error) {
    console.error('Error cargando CAF:', error);

    return res.status(500).json({
      success: false,
      message: 'Error cargando CAF',
      error: error.message
    });
  }
};

module.exports = {
  uploadCaf
};

const getCafFiles = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
       *
      FROM Fact_CafFiles cf
      INNER JOIN Fact_Companies c ON c.Id = cf.Id
      ORDER BY cf.CreatedAt DESC
    `);

    return res.status(200).json({
      success: true,
      cafFiles: result.recordset
    });
  } catch (error) {
    console.error('Error obteniendo CAF:', error);

    return res.status(500).json({
      success: false,
      message: 'Error obteniendo CAF',
      error: error.message
    });
  }
};

module.exports = { createBoletaDte, getDteById, getDtes, createCompany, getCompanies, getComunas, uploadCaf,getCafFiles };

