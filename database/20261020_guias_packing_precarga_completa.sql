/*
  Completa la vista de precarga del Packing List con los textos operacionales
  que el generador GeneXus conservaba en PACKLIST.
*/
IF DB_NAME() NOT IN (N'CONEX', N'CONEX_MIGRACION')
  THROW 51020, N'Este script debe ejecutarse en una base CONEX autorizada.', 1;
IF SCHEMA_ID(N'integracion') IS NULL EXEC(N'CREATE SCHEMA integracion');
GO
IF OBJECT_ID(N'integracion.PackingGuiaDatos', N'U') IS NULL
CREATE TABLE integracion.PackingGuiaDatos (
  EmpCod smallint NOT NULL,
  TempCod char(9) NOT NULL,
  PackNumI decimal(10,0) NOT NULL,
  TransportistaNombre nvarchar(150) NULL,
  TransportistaRut nvarchar(20) NULL,
  PatenteCarro nvarchar(20) NULL,
  FechaLlegada date NULL,
  OrigenDireccion nvarchar(200) NULL,
  OrigenComuna nvarchar(100) NULL,
  DestinoDireccion nvarchar(200) NULL,
  DestinoComuna nvarchar(100) NULL,
  ActualizadoEn datetime2(0) NOT NULL CONSTRAINT DF_PackingGuiaDatos_Actualizado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PackingGuiaDatos PRIMARY KEY (EmpCod, TempCod, PackNumI),
  CONSTRAINT FK_PackingGuiaDatos_Packing FOREIGN KEY (EmpCod, TempCod, PackNumI)
    REFERENCES dbo.PACKLIST (EmpCod, TempCod, PackNumI)
);
GO
CREATE OR ALTER VIEW integracion.vPackingGuiaPrecarga AS
SELECT
  P.EmpCod AS EmpresaOrigen, RTRIM(P.TempCod) AS TemporadaCodigo,
  P.PackNumI AS PackingNumeroInterno, P.PackNumG AS DocumentoOrigenNumero,
  P.PackTipo AS TipoPacking, CONVERT(date,P.PackFecha) AS FechaDocumento,
  CONVERT(date,P.PackFecZar) AS FechaZarpe, RTRIM(P.PackHora) AS HoraSalida,
  COALESCE(NULLIF(RTRIM(X.OrigenDireccion),''),RTRIM(EM.Empdir)) AS OrigenDireccion,
  COALESCE(NULLIF(RTRIM(X.OrigenComuna),''),RTRIM(EM.Empcom)) AS OrigenComuna,
  RTRIM(EM.Empprov) AS OrigenProvincia,
  P.CliCod AS ClienteOrigen, P.PackEstado AS EstadoOrigen, P.PackGuia AS GuiaRelacionada,
  P.PackTotCajas AS TotalCajas, P.PackTotPal AS TotalPallets,
  P.PackKilos AS KilosNetos, P.PackKilosB AS KilosBrutos,
  RTRIM(P.PackPatente) AS Patente, RTRIM(P.PackChofer) AS NombreChofer,
  RTRIM(P.PackRutChofer) AS RutChofer, RTRIM(P.PackTipCamion) AS TipoCamion,
  COALESCE(NULLIF(RTRIM(X.TransportistaNombre),''),RTRIM(P.PackEmptrans)) AS EmpresaTransporte,
  RTRIM(X.TransportistaRut) AS RutTransportista, RTRIM(X.PatenteCarro) AS PatenteCarro,
  X.FechaLlegada, RTRIM(P.PAckNContenedor) AS Contenedor,
  RTRIM(P.PackMarcas) AS Marcas, RTRIM(P.PackConTram) AS Contramarcas,
  RTRIM(P.PackObs1) AS Observacion1, RTRIM(P.PackObs2) AS Observacion2,
  RTRIM(P.PackTipoDesp) AS TipoDespachoTexto,
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
  COALESCE(NULLIF(RTRIM(X.DestinoDireccion),''),RTRIM(C.Clidirec)) AS DestinoDireccion,
  COALESCE(NULLIF(RTRIM(X.DestinoComuna),''),RTRIM(C.CliCom)) AS DestinoComuna,
  P.ExpCod AS ExportadoraCodigo, RTRIM(E.ExpNom) AS ExportadoraNombre,
  E.ExpRut AS ExportadoraRutNumero, RTRIM(E.ExpDv) AS ExportadoraRutDv,
  P.ConsCod AS ConsignatarioCodigo, RTRIM(CO.ConsNom) AS ConsignatarioNombre,
  P.DACod AS DespachadorCodigo, RTRIM(DA.DANombre) AS DespachadorNombre,
  P.DestCod AS DestinoCodigo, RTRIM(DE.DestNom) AS DestinoNombre,
  RTRIM(DE.DestCMP) AS PaisDestinoCodigo, P.AgeCod AS AgenteCodigo,
  RTRIM(A.AgeNom) AS AgenteNombre
FROM dbo.PACKLIST P
LEFT JOIN dbo.DEFEMP EM ON EM.EmpCod=P.EmpCod
LEFT JOIN integracion.PackingGuiaDatos X ON X.EmpCod=P.EmpCod AND X.TempCod=P.TempCod AND X.PackNumI=P.PackNumI
LEFT JOIN dbo.CLIENTES C ON C.EmpCod=P.EmpCod AND C.CliCod=P.CliCod
LEFT JOIN dbo.EXPORT1 E ON E.EmpCod=P.EmpCod AND E.ExpCod=P.ExpCod
LEFT JOIN dbo.CONSIG CO ON CO.EmpCod=P.EmpCod AND CO.ConsCod=P.ConsCod
LEFT JOIN dbo.DESPAAUTO DA ON DA.EmpCod=P.EmpCod AND DA.DACod=P.DACod
LEFT JOIN dbo.DESTINOS DE ON DE.DestCod=P.DestCod
LEFT JOIN dbo.AGENTES A ON A.EmpCod=P.EmpCod AND A.AgeCod=P.AgeCod;
GO
