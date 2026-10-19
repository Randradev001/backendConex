/*
  Acceso de un solo uso y vistas de precarga para el módulo de guías que vive en APERP.
  Ejecutar en CONEX. No modifica datos GeneXus.
*/
IF DB_NAME() NOT IN (N'CONEX', N'CONEX_MIGRACION')
  THROW 51020, N'Este script debe ejecutarse en una base CONEX autorizada.', 1;
IF SCHEMA_ID(N'integracion') IS NULL EXEC(N'CREATE SCHEMA integracion');
GO
IF OBJECT_ID(N'integracion.GuiaAcceso', N'U') IS NULL
CREATE TABLE integracion.GuiaAcceso (
  TokenHash char(64) NOT NULL,
  EmpCod int NOT NULL,
  UsuLogin varchar(40) NOT NULL,
  CreadoEn datetime2(0) NOT NULL CONSTRAINT DF_GuiaAcceso_Creado DEFAULT SYSUTCDATETIME(),
  ExpiraEn datetime2(0) NOT NULL,
  ConsumidoEn datetime2(0) NULL,
  CONSTRAINT PK_GuiaAcceso PRIMARY KEY (TokenHash)
);
GO
CREATE OR ALTER VIEW integracion.vPackingGuiaPrecarga AS
SELECT
  P.EmpCod AS EmpresaOrigen, RTRIM(P.TempCod) AS TemporadaCodigo,
  P.PackNumI AS PackingNumeroInterno, P.PackNumG AS DocumentoOrigenNumero,
  P.PackTipo AS TipoPacking, CONVERT(date,P.PackFecha) AS FechaDocumento,
  CONVERT(date,P.PackFecZar) AS FechaZarpe, RTRIM(P.PackHora) AS HoraSalida,
  P.CliCod AS ClienteOrigen, P.PackEstado AS EstadoOrigen, P.PackGuia AS GuiaRelacionada,
  P.PackTotCajas AS TotalCajas, P.PackTotPal AS TotalPallets,
  P.PackKilos AS KilosNetos, P.PackKilosB AS KilosBrutos,
  RTRIM(P.PackPatente) AS Patente, RTRIM(P.PackChofer) AS NombreChofer,
  RTRIM(P.PackRutChofer) AS RutChofer, RTRIM(P.PackTipCamion) AS TipoCamion,
  RTRIM(P.PackEmptrans) AS EmpresaTransporte, RTRIM(P.PAckNContenedor) AS Contenedor,
  RTRIM(P.PackMarcas) AS Marcas, RTRIM(P.PackConTram) AS Contramarcas,
  RTRIM(P.PackNSello1) AS Sello1, RTRIM(P.PackEmisor1) AS EmisorSello1,
  RTRIM(P.PackNSello2) AS Sello2, RTRIM(P.PackEmisor2) AS EmisorSello2,
  RTRIM(P.PackNTermografo) AS Termografo1, RTRIM(P.Packntermograf2) AS Termografo2,
  RTRIM(P.PackNumPalTer1) AS PalletTermografo1, RTRIM(P.PackNumPalTer2) AS PalletTermografo2,
  RTRIM(P.PackDus) AS DUS, RTRIM(P.PackSPSN) AS SPS,
  P.PackPuOr AS PuertoOrigenCodigo, P.PackPuDe AS PuertoDestinoCodigo,
  RTRIM(P.PackNave) AS Nave, P.packTipDesExp AS TipoDespachoDte,
  P.packIndDesExp AS IndicadorTrasladoDte,
  C.Clirut AS ReceptorRutNumero, RTRIM(C.CliDv) AS ReceptorRutDv,
  RTRIM(C.CliNom) AS ReceptorNombre, RTRIM(C.CliGiro) AS ReceptorGiro,
  RTRIM(C.Clidirec) AS ReceptorDireccion, RTRIM(C.CliCom) AS ReceptorComuna,
  RTRIM(C.Cliciu) AS ReceptorCiudad, RTRIM(C.CliFono) AS ReceptorTelefono,
  P.ExpCod AS ExportadoraCodigo, RTRIM(E.ExpNom) AS ExportadoraNombre,
  E.ExpRut AS ExportadoraRutNumero, RTRIM(E.ExpDv) AS ExportadoraRutDv,
  P.ConsCod AS ConsignatarioCodigo, RTRIM(CO.ConsNom) AS ConsignatarioNombre,
  P.DACod AS DespachadorCodigo, RTRIM(DA.DANombre) AS DespachadorNombre,
  P.DestCod AS DestinoCodigo, RTRIM(DE.DestNom) AS DestinoNombre,
  RTRIM(DE.DestCMP) AS PaisDestinoCodigo, P.AgeCod AS AgenteCodigo,
  RTRIM(A.AgeNom) AS AgenteNombre
FROM dbo.PACKLIST P
LEFT JOIN dbo.CLIENTES C ON C.EmpCod=P.EmpCod AND C.CliCod=P.CliCod
LEFT JOIN dbo.EXPORT1 E ON E.EmpCod=P.EmpCod AND E.ExpCod=P.ExpCod
LEFT JOIN dbo.CONSIG CO ON CO.EmpCod=P.EmpCod AND CO.ConsCod=P.ConsCod
LEFT JOIN dbo.DESPAAUTO DA ON DA.EmpCod=P.EmpCod AND DA.DACod=P.DACod
LEFT JOIN dbo.DESTINOS DE ON DE.DestCod=P.DestCod
LEFT JOIN dbo.AGENTES A ON A.EmpCod=P.EmpCod AND A.AgeCod=P.AgeCod;
GO
CREATE OR ALTER VIEW integracion.vPackingGuiaDetallePrecarga AS
SELECT
  P.EmpCod AS EmpresaOrigen, RTRIM(P.TempCod) AS TemporadaCodigo,
  P.PackNumI AS PackingNumeroInterno, D.Dor2Corr AS LineaOrigen,
  CONCAT('DOR2-',D.DORNum,'-',D.Dor2Corr) AS ItemOrigen,
  RTRIM(COALESCE(ES.EspeNom,'')) AS Especie,
  RTRIM(COALESCE(VA.VarNom,'')) AS Variedad,
  RTRIM(COALESCE(EN.EnvNom,'')) AS Envase,
  RTRIM(COALESCE(CA.CatNom,'')) AS Categoria,
  RTRIM(D.Dor2cal) AS Calibre,
  CONCAT(RTRIM(COALESCE(ES.EspeNom,'')),' ',RTRIM(COALESCE(VA.VarNom,'')),' ',RTRIM(COALESCE(EN.EnvNom,'')),' ',RTRIM(D.Dor2cal)) AS Descripcion,
  D.Dor2Cajas AS Cajas, D.Dor2Kilos AS Kilos,
  D.Dor2Prod AS ProductorCodigo, PR.ProdRut AS ProductorRut
FROM dbo.PACKLIST P
INNER JOIN dbo.DESORIGEN H ON H.EmpCod=P.EmpCod AND H.TempCod=P.TempCod
  AND H.DorTipPlani=P.PackTipo AND H.DORNumf=P.PackNumG
INNER JOIN dbo.DESORIGEN2 D ON D.EmpCod=H.EmpCod AND D.TempCod=H.TempCod
  AND D.DorTipPlani=H.DorTipPlani AND D.DORNum=H.DORNum
LEFT JOIN dbo.ESPECIES ES ON ES.EmpCod=D.EmpCod AND ES.Especod=D.Dor2espe
LEFT JOIN dbo.ESPECIES1 VA ON VA.EmpCod=D.EmpCod AND VA.Especod=D.Dor2espe AND VA.VarCod=D.Dor2var
LEFT JOIN dbo.ENVCAT EN ON EN.EmpCod=D.EmpCod AND EN.EnvCod=D.Dor2env
LEFT JOIN dbo.ENVCAT1 CA ON CA.EmpCod=D.EmpCod AND CA.EnvCod=D.Dor2env AND CA.Catcod=D.Dor2cat
LEFT JOIN dbo.PRODUCTORES PR ON PR.EmpCod=D.EmpCod AND PR.ProdCod=D.Dor2Prod
WHERE P.PackTipo BETWEEN 1 AND 3;
GO
CREATE OR ALTER VIEW integracion.vDespachoComercialGuiaPrecarga AS
SELECT
  H.EmpCod AS EmpresaOrigen, RTRIM(H.TempCod) AS TemporadaCodigo,
  H.DesOTNumI AS DespachoNumeroInterno, H.DesOTNumG AS DespachoNumeroExterno,
  CONVERT(date,H.DesOTFecha) AS FechaDocumento, H.CliCod AS ClienteOrigen,
  H.DesOTTipo AS TipoDespachoOrigen, H.DesOTNguiInt AS GuiaRelacionada,
  H.DesOTIndi AS IndicadorTrasladoDte, H.DesOTTotCaj AS TotalCajas,
  H.DesOTTotKil AS TotalKilos, C.Clirut AS ReceptorRutNumero,
  RTRIM(C.CliDv) AS ReceptorRutDv, RTRIM(C.CliNom) AS ReceptorNombre,
  RTRIM(C.CliGiro) AS ReceptorGiro, RTRIM(C.Clidirec) AS ReceptorDireccion,
  RTRIM(C.CliCom) AS ReceptorComuna, RTRIM(C.Cliciu) AS ReceptorCiudad,
  RTRIM(C.CliFono) AS ReceptorTelefono
FROM dbo.DESCLI_FP H
LEFT JOIN dbo.CLIENTES C ON C.EmpCod=H.EmpCod AND C.CliCod=H.CliCod
WHERE H.DesOTTipo=3;
GO
CREATE OR ALTER VIEW integracion.vDespachoComercialGuiaDetallePrecarga AS
SELECT
  D.EmpCod AS EmpresaOrigen, RTRIM(D.TempCod) AS TemporadaCodigo,
  D.DesOTNumI AS DespachoNumeroInterno, D.DesOT1Cor AS LineaOrigen,
  CONCAT('DESOT-',D.DesOTNumI,'-',D.DesOT1Cor) AS ItemOrigen,
  D.DesOT1Espe AS EspecieCodigo, RTRIM(COALESCE(E.EspeNom,'')) AS Especie,
  D.DesOT1Cajas AS Cajas, D.DesOT1Kilos AS Kilos,
  D.DesOT1Folio AS FolioProceso
FROM dbo.DESCLI_FP1 D
INNER JOIN dbo.DESCLI_FP H ON H.EmpCod=D.EmpCod AND H.TempCod=D.TempCod AND H.DesOTNumI=D.DesOTNumI
LEFT JOIN dbo.ESPECIES E ON E.EmpCod=D.EmpCod AND E.Especod=D.DesOT1Espe
WHERE H.DesOTTipo=3;
GO
