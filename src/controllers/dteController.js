
const { getPool, sql } = require('../conectorMysql/conectorSqlServer');

const { generateBoletaDteXml } = require('../services/boletaXML.service');


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

module.exports = { createBoletaDte, getDteById, getDtes, createCompany, getCompanies, getComunas };

