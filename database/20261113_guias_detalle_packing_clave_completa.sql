/*
  La PK física de DESORIGEN2 incluye dor1Folio: Dor2Corr se repite entre pallets.
  Conserva esa clave en la precarga y agrega el folio a la trazabilidad.
  No modifica filas de packing, despacho, stock ni guías.
*/
IF DB_NAME() NOT IN (N'CONEX', N'CONEX_MIGRACION')
  THROW 51113, N'Ejecutar solamente en una base CONEX autorizada.', 1;
IF OBJECT_ID(N'dbo.DESORIGEN2', N'U') IS NULL
  THROW 51113, N'Falta la tabla DESORIGEN2.', 1;
GO
CREATE OR ALTER VIEW integracion.vPackingGuiaDetallePrecarga AS
SELECT
  P.EmpCod AS EmpresaOrigen, RTRIM(P.TempCod) AS TemporadaCodigo,
  P.PackNumI AS PackingNumeroInterno,
  CONCAT(D.DORNum,'/',RTRIM(D.dor1Folio),'/',D.Dor2Corr) AS LineaOrigen,
  CONCAT('DOR2-',D.DORNum,'-',RTRIM(D.dor1Folio),'-',D.Dor2Corr) AS ItemOrigen,
  RTRIM(D.dor1Folio) AS FolioProceso,
  RTRIM(COALESCE(ES.EspeNom,'')) AS Especie,
  RTRIM(COALESCE(VA.VarNom,'')) AS Variedad,
  RTRIM(COALESCE(EN.EnvNom,'')) AS Envase,
  RTRIM(COALESCE(CA.CatNom,'')) AS Categoria,
  RTRIM(D.Dor2cal) AS Calibre,
  CONCAT(
    RTRIM(COALESCE(ES.EspeNom,'')) COLLATE DATABASE_DEFAULT,
    ' ' COLLATE DATABASE_DEFAULT,
    RTRIM(COALESCE(VA.VarNom,'')) COLLATE DATABASE_DEFAULT,
    ' ' COLLATE DATABASE_DEFAULT,
    RTRIM(COALESCE(EN.EnvNom,'')) COLLATE DATABASE_DEFAULT,
    ' ' COLLATE DATABASE_DEFAULT,
    RTRIM(D.Dor2cal) COLLATE DATABASE_DEFAULT
  ) AS Descripcion,
  D.Dor2Cajas AS Cajas, D.Dor2Kilos AS Kilos,
  D.Dor2Prod AS ProductorCodigo, PR.ProdRut AS ProductorRut,
  D.Dor2espe AS EspecieCodigo, D.Dor2var AS VariedadCodigo,
  D.Dor2env AS EnvaseCodigo, D.Dor2cat AS CategoriaCodigo
FROM dbo.PACKLIST P
INNER JOIN dbo.DESORIGEN H ON H.EmpCod=P.EmpCod
  AND H.TempCod COLLATE DATABASE_DEFAULT=P.TempCod COLLATE DATABASE_DEFAULT
  AND H.DorTipPlani=P.PackTipo AND H.DORNumf=P.PackNumG
INNER JOIN dbo.DESORIGEN2 D ON D.EmpCod=H.EmpCod
  AND D.TempCod COLLATE DATABASE_DEFAULT=H.TempCod COLLATE DATABASE_DEFAULT
  AND D.DorTipPlani=H.DorTipPlani AND D.DORNum=H.DORNum
LEFT JOIN dbo.ESPECIES ES ON ES.EmpCod=D.EmpCod AND ES.Especod=D.Dor2espe
LEFT JOIN dbo.ESPECIES1 VA ON VA.EmpCod=D.EmpCod AND VA.Especod=D.Dor2espe AND VA.VarCod=D.Dor2var
LEFT JOIN dbo.ENVCAT EN ON EN.EmpCod=D.EmpCod AND EN.EnvCod=D.Dor2env
LEFT JOIN dbo.ENVCAT1 CA ON CA.EmpCod=D.EmpCod AND CA.EnvCod=D.Dor2env AND CA.Catcod=D.Dor2cat
LEFT JOIN dbo.PRODUCTORES PR ON PR.EmpCod=D.EmpCod
  AND PR.ProdCod COLLATE DATABASE_DEFAULT=D.Dor2Prod COLLATE DATABASE_DEFAULT
WHERE P.PackTipo BETWEEN 1 AND 3;
GO
IF EXISTS (
  SELECT EmpresaOrigen,TemporadaCodigo,PackingNumeroInterno,LineaOrigen
  FROM integracion.vPackingGuiaDetallePrecarga
  GROUP BY EmpresaOrigen,TemporadaCodigo,PackingNumeroInterno,LineaOrigen HAVING COUNT(*)>1
)
  THROW 51113, N'La precarga conserva duplicados: revisar claves y joins antes de generar guías.', 1;
SELECT COUNT(*) AS FilasDetalle FROM integracion.vPackingGuiaDetallePrecarga;
GO
