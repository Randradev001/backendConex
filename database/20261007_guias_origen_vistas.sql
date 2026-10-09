/*
  Lecturas de origen para el modulo central de guias de APERP.
  Ejecutar en la base CONEX. No modifica tablas ni datos GeneXus.
  No otorga SELECT: conceder acceso solamente al principal de integracion aprobado.
*/
IF DB_NAME() NOT IN (N'CONEX', N'CONEX_MIGRACION')
    THROW 51000, N'Este script debe ejecutarse en una base CONEX autorizada.', 1;
IF OBJECT_ID(N'dbo.GUIASD', N'U') IS NULL OR OBJECT_ID(N'dbo.GUIASD1', N'U') IS NULL
    THROW 51001, N'Faltan GUIASD o GUIASD1.', 1;
IF OBJECT_ID(N'dbo.PACKLIST', N'U') IS NULL OR OBJECT_ID(N'dbo.CLIENTES', N'U') IS NULL
    THROW 51002, N'Faltan PACKLIST o CLIENTES.', 1;
IF SCHEMA_ID(N'integracion') IS NULL EXEC(N'CREATE SCHEMA integracion');
GO
CREATE OR ALTER VIEW integracion.vGuiaCabeceraOrigen AS
SELECT
    CAST(N'CONEX' AS varchar(10)) AS SistemaOrigen,
    G.EmpCod AS EmpresaOrigen,
    RTRIM(G.TempCod) AS TemporadaCodigo,
    G.GuiNumInt AS NumeroInternoOrigen,
    G.GuiNumLeg AS FolioLegado,
    CONVERT(date, G.GuiFecha) AS FechaGuia,
    G.CliCod AS ClienteOrigen,
    G.GuiNumPack AS PackingNumeroInterno,
    G.GuiEstado AS EstadoLegado,
    G.GuiTipos AS TipoLegado,
    G.GuiIndDesExp AS IndicadorTrasladoLegado,
    G.GuiTipDesExp AS TipoDespachoLegado,
    RTRIM(G.GuiDesde) AS DesdeTexto,
    RTRIM(G.GuiHasta) AS HastaTexto,
    RTRIM(G.GuiPatente) AS Patente,
    RTRIM(G.GuiRutChofer) AS RutChofer,
    RTRIM(G.GuiChofer) AS NombreChofer,
    RTRIM(G.GuiEmpTrans) AS TransportistaTexto,
    RTRIM(G.GuiHora) AS HoraSalidaTexto,
    G.GuiTotCajas AS TotalCajas,
    G.GuiTotal AS TotalLegado,
    G.GuiFecC AS FechaCreacionLegada
FROM dbo.GUIASD AS G;
GO
CREATE OR ALTER VIEW integracion.vGuiaDetalleOrigen AS
SELECT
    CAST(N'CONEX' AS varchar(10)) AS SistemaOrigen,
    D.EmpCod AS EmpresaOrigen,
    RTRIM(D.TempCod) AS TemporadaCodigo,
    D.GuiNumInt AS NumeroInternoOrigen,
    D.Gui1Corr AS NumeroLineaOrigen,
    RTRIM(D.Gui1Detalle1) AS DescripcionItem,
    RTRIM(D.Gui1Detalle2) AS DescripcionAdicional,
    D.Gui1Cant AS CantidadLegada,
    D.Gui1Cajas AS CajasLegadas,
    D.Gui1PrecU AS PrecioUnitarioLegado,
    D.Gui1Total AS TotalLineaLegado,
    D.Especod AS EspecieOrigen,
    RTRIM(D.Gui1Calibre) AS CalibreOrigen,
    D.EnvCod AS EnvaseOrigen
FROM dbo.GUIASD1 AS D;
GO
CREATE OR ALTER VIEW integracion.vPackingCabeceraOrigen AS
SELECT
    CAST(N'CONEX' AS varchar(10)) AS SistemaOrigen,
    P.EmpCod AS EmpresaOrigen,
    RTRIM(P.TempCod) AS TemporadaCodigo,
    P.PackNumI AS PackingNumeroInterno,
    P.PackNumG AS PackingNumeroExterno,
    CONVERT(date, P.PackFecha) AS FechaPacking,
    P.CliCod AS ClienteOrigen,
    P.PackEstado AS EstadoLegado,
    P.PackTotCajas AS TotalCajas,
    P.PackTotPal AS TotalPallets,
    P.PackKilos AS KilosNetos,
    P.PackKilosB AS KilosBrutos,
    RTRIM(P.PackPatente) AS Patente,
    RTRIM(P.PackChofer) AS NombreChofer,
    RTRIM(P.PackRutChofer) AS RutChofer,
    P.PackGuia AS GuiaRelacionadaLegada
FROM dbo.PACKLIST AS P;
GO
CREATE OR ALTER VIEW integracion.vClienteGuiaOrigen AS
SELECT
    CAST(N'CONEX' AS varchar(10)) AS SistemaOrigen,
    C.EmpCod AS EmpresaOrigen,
    C.CliCod AS ClienteOrigen,
    C.Clirut AS RutNumero,
    RTRIM(C.CliDv) AS RutDv,
    RTRIM(C.CliNom) AS Nombre,
    RTRIM(C.CliGiro) AS Giro,
    RTRIM(C.Clidirec) AS Direccion,
    RTRIM(C.CliCom) AS Comuna,
    RTRIM(C.Cliciu) AS Ciudad
FROM dbo.CLIENTES AS C;
GO
SELECT N'Cabecera' AS Vista, COUNT_BIG(*) AS Filas FROM integracion.vGuiaCabeceraOrigen
UNION ALL SELECT N'Detalle', COUNT_BIG(*) FROM integracion.vGuiaDetalleOrigen
UNION ALL SELECT N'Packing', COUNT_BIG(*) FROM integracion.vPackingCabeceraOrigen
UNION ALL SELECT N'Cliente', COUNT_BIG(*) FROM integracion.vClienteGuiaOrigen;
