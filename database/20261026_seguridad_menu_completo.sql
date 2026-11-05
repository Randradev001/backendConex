/*
  Sincroniza el catalogo completo de Seguridad y Menu de CONEX.
  Fuente de referencia: jerarquia valida de CONEX local, 2026-10-26.
  No elimina catalogos ni permisos existentes. Excluye registros huerfanos de la fuente.

  ADMINFULL recibe todos los sistemas, modulos, programas y acciones.
  Para otorgar todo directamente a un usuario, complete @EmpCodUsuario y @UsuLogin.
*/

USE [CONEX];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @EmpCodUsuario smallint = NULL; -- Ejemplo: 1
DECLARE @UsuLogin varchar(10) = NULL;  -- Ejemplo: 'MANDRADE'

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @Sistemas TABLE (SistCod smallint PRIMARY KEY,SistNombre char(40) NULL,SistFecCrea datetime NULL,SistFAIcons varchar(30) NULL);
  INSERT INTO @Sistemas VALUES
  (1,N'Seguridad General',NULL,NULL),
  (10,N'Maestros Generales',NULL,NULL),
  (70,N'Control Bodega',NULL,NULL),
  (100,N'Control de Produccion Fruticola',NULL,NULL),
  (110,N'Ordenes de Proceso',CAST(N'2026-08-18 00:00:00.000' AS datetime),N'AccountTreeOutlined'),
  (120,N'Procesos SAG',CAST(N'2026-10-15 00:00:00.000' AS datetime),N'SafetyCertificateOutlined'),
  (130,N'Guias electronicas',CAST(N'2026-10-15 00:00:00.000' AS datetime),N'FileTextOutlined');

  UPDATE T SET T.SistNombre=S.SistNombre,T.SistFecCrea=COALESCE(T.SistFecCrea,S.SistFecCrea),T.SistFAIcons=S.SistFAIcons
  FROM dbo.SISTEMAS T JOIN @Sistemas S ON S.SistCod=T.SistCod;
  INSERT dbo.SISTEMAS (SistCod,SistNombre,SistFecCrea,SistFAIcons)
  SELECT S.SistCod,S.SistNombre,S.SistFecCrea,S.SistFAIcons FROM @Sistemas S
  WHERE NOT EXISTS (SELECT 1 FROM dbo.SISTEMAS T WHERE T.SistCod=S.SistCod);

  DECLARE @Modulos TABLE (SistCod smallint,Modcod smallint,ModTipo smallint NULL,Modprg char(15) NULL,ModDes char(30) NULL,ModFcrea datetime NULL,ModFAIcons varchar(30) NULL,PRIMARY KEY(SistCod,Modcod));
  INSERT INTO @Modulos VALUES
  (1,1,1,N'UISE0101',N'Seguridad',CAST(N'2004-06-16 00:00:00.000' AS datetime),NULL),
  (10,10,1,N'UIMG1010',N'Maestros Articulos Bodega',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (10,11,1,N'UIMG1011',N'Maestros Bodega',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (70,4,1,N'UIOC7004',N'Ordenes de Compra',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (70,6,1,N'UIMB7006',N'Movimientos de bodega',CAST(N'2017-07-09 00:00:00.000' AS datetime),NULL),
  (70,7,1,N'UISC7007',N'Solicitud de Consumos',CAST(N'2017-07-09 00:00:00.003' AS datetime),NULL),
  (70,8,1,N'UIPC7008',N'Procesos de Cierres',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (70,11,1,N'UCAB7011',N'Consultas Adm. Bodega',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (70,12,1,N'UCCG7012',N'Consultas de Gestion',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (70,13,1,N'UCST7013',N'Consultas de Stock',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (70,14,1,N'UPCT7014',N'Contabilizacion',CAST(N'2009-07-09 00:00:00.000' AS datetime),NULL),
  (100,1,1,N'UMAE10001',N'Mantenedores',CAST(N'2004-06-18 00:00:00.000' AS datetime),NULL),
  (100,2,1,N'UIPRO10002',N'Procesos Planta',CAST(N'2007-07-07 00:00:00.000' AS datetime),NULL),
  (100,6,1,N'uGETI10006',N'Etiquetado de Cajas',CAST(N'2009-09-07 00:00:00.000' AS datetime),NULL),
  (100,8,1,N'UILEC10008',N'Procesos de Lecturas',CAST(N'2009-12-05 00:00:00.000' AS datetime),NULL),
  (100,9,1,N'uIFAC10009',N'Facturacion de Guias',CAST(N'2011-11-25 00:00:00.000' AS datetime),NULL),
  (100,10,1,N'uCADM10010',N'Consultas ADM',CAST(N'2004-06-30 00:00:00.000' AS datetime),NULL),
  (100,15,1,N'uCPRO10015',N'Consultas de Procesos',CAST(N'2009-11-14 00:00:00.000' AS datetime),NULL),
  (100,20,1,N'uISAG10020',N'Procesos S.A.G',CAST(N'2005-08-09 00:00:00.000' AS datetime),NULL),
  (110,1,1,N'ORDENES_PROCESO',N'Mantenedores',CAST(N'2026-08-18 00:00:00.000' AS datetime),N'BuildOutlined'),
  (110,2,1,N'ORDENES_PROCESO',N'Operacional',CAST(N'2026-08-18 00:00:00.000' AS datetime),N'SettingsOutlined'),
  (110,3,1,N'ORDENES_PROCESO',N'Consultas',CAST(N'2026-08-18 00:00:00.000' AS datetime),N'SearchOutlined'),
  (120,1,1,N'PROCESOS_SAG',N'Operacional',CAST(N'2026-10-15 00:00:00.000' AS datetime),N'DeploymentUnitOutlined'),
  (130,1,1,N'GUIAS',N'Operacional',CAST(N'2026-10-15 00:00:00.000' AS datetime),N'DeploymentUnitOutlined');

  UPDATE T SET T.ModTipo=M.ModTipo,T.Modprg=M.Modprg,T.ModDes=M.ModDes,T.ModFcrea=COALESCE(T.ModFcrea,M.ModFcrea),T.ModFAIcons=M.ModFAIcons
  FROM dbo.MODULOS T JOIN @Modulos M ON M.SistCod=T.SistCod AND M.Modcod=T.Modcod;
  INSERT dbo.MODULOS (SistCod,Modcod,ModTipo,Modprg,ModDes,ModFcrea,ModFAIcons)
  SELECT M.SistCod,M.Modcod,M.ModTipo,M.Modprg,M.ModDes,M.ModFcrea,M.ModFAIcons FROM @Modulos M
  WHERE NOT EXISTS (SELECT 1 FROM dbo.MODULOS T WHERE T.SistCod=M.SistCod AND T.Modcod=M.Modcod);

  DECLARE @Programas TABLE (SistCod smallint,Modcod smallint,ProgCod smallint,ProgDes char(35) NULL,ProgFcrea datetime NULL,ProgTipo smallint NULL,ProgNomGX char(20) NULL,ProgIDmenu varchar(20) NULL,ProgTarget varchar(120) NULL,PRIMARY KEY(SistCod,Modcod,ProgCod));
  INSERT INTO @Programas VALUES
  (1,1,1,N'Definir Modulos',CAST(N'2009-08-14 00:00:00.000' AS datetime),1,N'wmodulos',NULL,NULL),
  (1,1,2,N'Definir Programas',CAST(N'2011-12-02 00:00:00.000' AS datetime),1,N'wprogram',NULL,NULL),
  (1,1,3,N'Definir Usuarios',CAST(N'2009-08-12 00:00:00.000' AS datetime),1,N'wusuarios',NULL,NULL),
  (1,1,4,N'Definir Niveles de Acceso',CAST(N'2003-08-11 00:00:00.000' AS datetime),1,N'wnivseg',NULL,NULL),
  (1,1,5,N'Asignar Modulos-Programas',CAST(N'2004-06-17 00:00:00.000' AS datetime),1,N'wasigprog',NULL,NULL),
  (1,1,6,N'Definicion de Empresa',CAST(N'2003-08-16 00:00:00.000' AS datetime),1,N'tdefemp',NULL,NULL),
  (1,1,7,N'Definicion de Sistemas             ',CAST(N'2008-10-28 00:00:00.000' AS datetime),1,N'tsistemas      ',NULL,NULL),
  (10,10,1,N'Mantener Familias                  ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wfamilia',NULL,NULL),
  (10,10,2,N'Manterner Grupos                   ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wgrupos',NULL,NULL),
  (10,10,3,N'Mantener Articulos                 ',CAST(N'2017-10-17 00:00:00.000' AS datetime),1,N'wmaeart',NULL,NULL),
  (10,10,4,N'Stock Criticos Sucursal/Bodega     ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wstminb',NULL,NULL),
  (10,10,5,N'Precios Especiales                 ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wprecesp',NULL,NULL),
  (10,10,6,N'Apertura de Stock                  ',CAST(N'2010-11-18 00:00:00.000' AS datetime),1,N'wAPERTUR',NULL,NULL),
  (10,10,7,N'Impresion de Codigos               ',CAST(N'2012-06-06 00:00:00.000' AS datetime),1,N'wIMPRECO',NULL,NULL),
  (10,10,8,N'Imprime Codigos por Stock          ',CAST(N'2012-06-06 00:00:00.000' AS datetime),1,N'wIETSTOC',NULL,NULL),
  (10,11,4,N'Tipos de Movimientos de Bodega',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'ttmov',NULL,NULL),
  (10,11,5,N'Correlativos de Doc-Proc',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'tgencor',NULL,NULL),
  (10,11,8,N'Tipos de Entidades',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wtipose',NULL,NULL),
  (10,11,9,N'Entidades',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wentidad',NULL,NULL),
  (10,11,10,N'Sucursales',CAST(N'2009-09-22 00:00:00.000' AS datetime),1,N'wsucu',NULL,NULL),
  (10,11,11,N'Bodegas',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wbodegas',NULL,NULL),
  (10,11,14,N'Tipos de Articulos por Valor',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wtipart',NULL,NULL),
  (10,11,15,N'Valores de Moneda',CAST(N'2010-11-09 00:00:00.000' AS datetime),1,N'wvalmon',NULL,NULL),
  (10,11,16,N'Objetivos de Ordenes de Compra',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'tobj',NULL,NULL),
  (10,11,17,N'Tipos de Entrega Proveedor',CAST(N'2010-01-04 00:00:00.000' AS datetime),1,N'ttipento',NULL,NULL),
  (10,11,18,N'Lugares de Entrega',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'tlugent',NULL,NULL),
  (10,11,20,N'Tipos de Orden de Compra',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'ttipoord',NULL,NULL),
  (10,11,21,N'Tipos de Pago',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'ttippoc',NULL,NULL),
  (10,11,22,N'Parametros Generales',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wparamge',NULL,NULL),
  (10,11,23,N'Centro Costo 1',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'tseccion',NULL,NULL),
  (10,11,24,N'Centro Costo 2',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wareacon',NULL,NULL),
  (10,11,25,N'Unidades de Medida',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'Wunimed',NULL,NULL),
  (10,11,26,N'Maestro de Personas',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wperson',NULL,NULL),
  (10,11,27,N'Maestro Movimientos Masivos',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wmovmas',NULL,NULL),
  (70,4,1,N'Ordenes de Compra                  ',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wordcomp',NULL,NULL),
  (70,4,2,N'Modificar/Anular Ordenes de Compra',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wmodoc',NULL,NULL),
  (70,4,3,N'Chequar Estado Ordenes de Compra   ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wcheqeoc',NULL,NULL),
  (70,4,4,N'Impresion Masiva de O.C.           ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wimprema',NULL,NULL),
  (70,4,6,N'Ajuste Saldo Orden Compra          ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wajusoc1',NULL,NULL),
  (70,4,7,N'Re Impresion de Orden de Compra    ',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wreimpoc',NULL,NULL),
  (70,6,1,N'Recepción de Articulos             ',CAST(N'2012-06-06 00:00:00.000' AS datetime),1,N'wmsucbod',NULL,NULL),
  (70,6,2,N'Salida de Articulos                ',CAST(N'2012-07-16 00:00:00.000' AS datetime),1,N'wSSucbod',NULL,NULL),
  (70,6,3,N'Guias de Despacho                  ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wguiasd',NULL,NULL),
  (70,6,4,N'Reasignar IOM a Salidas            ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wreguiom',NULL,NULL),
  (70,6,5,N'Revision de Facturas               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wrevfact',NULL,NULL),
  (70,6,6,N'Movimientos de Ingresos Especiales',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'WESMSUCB',NULL,NULL),
  (70,6,7,N'Movimientos de Salidas Especiales  ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'WESSUCBO',NULL,NULL),
  (70,6,8,N'Recepcion y Salida de Articulos    ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wmsucbod',NULL,NULL),
  (70,6,9,N'Devolucion Materiales I.O.M.       ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wdevmati',NULL,NULL),
  (70,6,10,N'Cambio de Precio Consumos por IO   ',CAST(N'2011-07-06 00:00:00.000' AS datetime),1,N'wCVALORI',NULL,NULL),
  (70,6,11,N'Capturas de salidas por solicitud  ',CAST(N'2012-09-28 00:00:00.000' AS datetime),1,N'wSALCB00',NULL,NULL),
  (70,6,12,N'Cargo EPP                          ',CAST(N'2017-06-13 00:00:00.000' AS datetime),1,N'wcargoepp',NULL,NULL),
  (70,6,13,N'Movimientos Masivos Bodega',CAST(N'2017-10-13 00:00:00.000' AS datetime),1,N'wcmasiva',NULL,NULL),
  (70,7,1,N'Generar Solicitud de consumo       ',CAST(N'2009-03-07 00:00:00.000' AS datetime),1,N'wsolcon',NULL,NULL),
  (70,8,1,N'Generar Procesos de Cierre         ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wgenprec',NULL,NULL),
  (70,8,2,N'Consultar Precios Promedios        ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wpreprom',NULL,NULL),
  (70,8,3,N'Meses de Proceso                   ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wmesespr',NULL,NULL),
  (70,8,4,N'Subir Valores Monedas              ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wsubvalm',NULL,NULL),
  (70,11,1,N'Ordenes de Compra                  ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wconsuoc',NULL,NULL),
  (70,11,2,N'Consumos por Centro de Costo       ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wconsare',NULL,NULL),
  (70,11,3,N'Ingresos por Centros de Costos     ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wrecarea',NULL,NULL),
  (70,11,4,N'Consumos por Persona               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wconsper',NULL,NULL),
  (70,11,5,N'Cartola de Articulos               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wcartola',NULL,NULL),
  (70,11,6,N'Compras por Articulo               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wcompxar',NULL,NULL),
  (70,11,7,N'Compras por Centro Costo           ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wcompras',NULL,NULL),
  (70,11,8,N'Revisión Guías No Facturadas       ',CAST(N'2011-10-06 00:00:00.000' AS datetime),1,N'wrecepgu',NULL,NULL),
  (70,11,9,N'Busqueda por IO                    ',CAST(N'2011-10-06 00:00:00.000' AS datetime),1,N'wbusiom',NULL,NULL),
  (70,11,10,N'Guias de Despacho por Centro Costo',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wguiasem',NULL,NULL),
  (70,11,11,N'Busqueda Guias Revisadas           ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wbusguia',NULL,NULL),
  (70,11,12,N'Busqueda de Centro de Costo 2      ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'WConArea',NULL,NULL),
  (70,11,13,N'Maestro de Artículos               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wConMaea',NULL,NULL),
  (70,11,15,N'Compras v/s Salidas                ',CAST(N'2011-10-06 00:00:00.000' AS datetime),1,N'wcompsal',NULL,NULL),
  (70,11,16,N'Busqueda de Documentos             ',CAST(N'2011-03-12 00:00:00.000' AS datetime),1,N'wBUSDOCP',NULL,NULL),
  (70,12,1,N'Consumos Valorizados               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wconsuva',NULL,NULL),
  (70,12,2,N'Ingresos Valorizados               ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wingreva',NULL,NULL),
  (70,12,3,N'Stock Valorizado                   ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wstval',NULL,NULL),
  (70,12,4,N'Consumos Valorizados Centro Costo  ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wconsval',NULL,NULL),
  (70,12,5,N'Stock con ultima compra-consumo    ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wstvalfe',NULL,NULL),
  (70,12,6,N'Detalle de Recepciones Valorizadas',CAST(N'2010-10-25 00:00:00.000' AS datetime),1,N'wRECXCCV',NULL,NULL),
  (70,13,1,N'Stock por Sucursal-Bodega          ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wstbodsb',NULL,NULL),
  (70,13,2,N'Stock por Tipo de Articulos        ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wstsbta',NULL,NULL),
  (70,13,10,N'Stock Minimos                      ',CAST(N'2011-08-22 00:00:00.000' AS datetime),1,N'wSTMINIM',NULL,NULL),
  (70,14,1,N'Conversion Contable                ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wconvcon',NULL,NULL),
  (70,14,2,N'Contabilizacion                    ',CAST(N'2009-07-09 00:00:00.000' AS datetime),1,N'wcontab',NULL,NULL),
  (100,1,1,N'Tipos de Documento',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'ttipdoc',NULL,NULL),
  (100,1,2,N'Tipos de Movimientos',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'ttipmov',NULL,NULL),
  (100,1,3,N'Especies - Variedades',CAST(N'2007-12-17 00:00:00.000' AS datetime),1,N'wespecies',NULL,NULL),
  (100,1,4,N'Especie - Calibres',CAST(N'2007-12-17 00:00:00.000' AS datetime),1,N'wcalibres',NULL,NULL),
  (100,1,5,N'Productores',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'wproductores',NULL,NULL),
  (100,1,6,N'Envases - Categorias',CAST(N'2008-01-05 00:00:00.000' AS datetime),1,N'wenvcat',NULL,NULL),
  (100,1,7,N'Condicion de Fruta',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'tcondicion',NULL,NULL),
  (100,1,8,N'Origenes de Ingreso',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'torigen',NULL,NULL),
  (100,1,9,N'Procedencias de Procesos',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'tprocedencia',NULL,NULL),
  (100,1,10,N'Secciones',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'tsecciones',NULL,NULL),
  (100,1,11,N'Destinos de Exportacion',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'tdestinos',NULL,NULL),
  (100,1,12,N'Clientes',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'wclientes',NULL,NULL),
  (100,1,13,N'Agentes',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'wagentes',NULL,NULL),
  (100,1,14,N'Consignatarios',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'wconsig',NULL,NULL),
  (100,1,15,N'Exportadoras',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'wexport',NULL,NULL),
  (100,1,16,N'Exportadoras v/s Productores',CAST(N'2007-05-02 00:00:00.000' AS datetime),1,N'wEXPORPROD',NULL,NULL),
  (100,1,17,N'Correlativos Documentos',CAST(N'2004-06-18 00:00:00.000' AS datetime),1,N'tgencor',NULL,NULL),
  (100,1,18,N'Temporadas',CAST(N'2007-05-11 00:00:00.000' AS datetime),1,N'wtempo',NULL,NULL),
  (100,1,19,N'Despachadores Autorizados',CAST(N'2007-05-23 00:00:00.000' AS datetime),1,N'tdespaauto',NULL,NULL),
  (100,1,20,N'Puertos Embarque/Destino',CAST(N'2007-05-23 00:00:00.000' AS datetime),1,N'wpuertos',NULL,NULL),
  (100,1,21,N'Causal de Anulacion Inspecciones',CAST(N'2007-10-10 00:00:00.000' AS datetime),1,N'tcausaanul',NULL,NULL),
  (100,1,22,N'Tipos de Etiquetas',CAST(N'2008-02-11 00:00:00.000' AS datetime),1,N'wtipeti',NULL,NULL),
  (100,1,23,N'Tipos de Bases de Pallet',CAST(N'2008-02-11 00:00:00.000' AS datetime),1,N'wtipbpal',NULL,NULL),
  (100,1,24,N'Tipos de Alturas',CAST(N'2008-02-11 00:00:00.000' AS datetime),1,N'wtipalt',NULL,NULL),
  (100,1,30,N'Parametros Generales',CAST(N'2011-10-04 00:00:00.000' AS datetime),1,N'wparamgen',NULL,NULL),
  (100,1,31,N'Monedas',CAST(N'2011-11-28 00:00:00.000' AS datetime),1,N'tmonedas',NULL,NULL),
  (100,1,32,N'Valores Monedas',CAST(N'2011-11-28 00:00:00.000' AS datetime),1,N'wvalmon',NULL,NULL),
  (100,1,40,N'Emisores de Guias',CAST(N'2012-11-19 00:00:00.000' AS datetime),1,N'tingdefemp',NULL,NULL),
  (100,2,1,N'Recepcion de Fruta',CAST(N'2009-08-20 00:00:00.000' AS datetime),1,N'wrecepciones',NULL,NULL),
  (100,2,2,N'Orden de Proceso',CAST(N'2009-08-21 00:00:00.000' AS datetime),1,N'wADMORDPROC',NULL,NULL),
  (100,2,4,N'Cambiar estado a Orden de Proceso',CAST(N'2009-09-04 00:00:00.000' AS datetime),1,N'wcestadoproc',NULL,NULL),
  (100,2,5,N'Cuadratura de Procesos',CAST(N'2009-09-27 00:00:00.000' AS datetime),1,N'wCUADRAPROC',NULL,NULL),
  (100,2,6,N'Control Fruta Comercial',CAST(N'2011-10-26 00:00:00.000' AS datetime),1,N'wFCOMERCIAL',NULL,NULL),
  (100,2,7,N'Re-Etiquetado Cajas',CAST(N'2012-11-14 00:00:00.000' AS datetime),1,N'wreetiquetado',NULL,NULL),
  (100,2,8,N'Paletizado de Cajas',CAST(N'2011-12-02 00:00:00.000' AS datetime),1,N'wPALETIZADO',NULL,NULL),
  (100,2,9,N'Ingreso de Folios Autorizados',CAST(N'2011-10-10 00:00:00.000' AS datetime),1,N'wGENFOLPALLET',NULL,NULL),
  (100,2,10,N'Ingreso de Tarjas',CAST(N'2005-06-16 00:00:00.000' AS datetime),1,N'wfoliosprocesado',NULL,NULL),
  (100,2,11,N'Repaletizaje Sin Inspeccion',CAST(N'2008-02-25 00:00:00.000' AS datetime),1,N'wrepafr',NULL,NULL),
  (100,2,13,N'Packing List',CAST(N'2009-09-04 00:00:00.000' AS datetime),1,N'wpackinglist',NULL,NULL),
  (100,2,14,N'Busqueda de Folios',CAST(N'2012-11-29 00:00:00.000' AS datetime),1,N'wbusfolio',NULL,NULL),
  (100,2,15,N'Despachos a Clientes',CAST(N'2007-10-11 00:00:00.000' AS datetime),1,N'wdespacli',NULL,NULL),
  (100,2,20,N'Guias de Despacho',CAST(N'2011-10-23 00:00:00.000' AS datetime),1,N'wguiasd',NULL,NULL),
  (100,2,30,N'Lectura manual de cajas',CAST(N'2011-10-25 00:00:00.000' AS datetime),1,N'wGENCAJAS',NULL,NULL),
  (100,2,31,N'Tablero de lotes',CAST(N'2026-08-11 00:00:00.000' AS datetime),1,N'wtablerolotesrecep',NULL,NULL),
  (100,2,32,N'Aplicaciones de calidad',CAST(N'2026-08-11 00:00:00.000' AS datetime),1,N'wctrlcalidadrecep',NULL,NULL),
  (100,6,1,N'Impresion de Etiquetas de la Linea',CAST(N'2009-09-07 00:00:00.000' AS datetime),1,N'wETI_LINEAVN',NULL,NULL),
  (100,6,2,N'Configuracion de Etiquetas Cajas',CAST(N'2009-09-07 00:00:00.000' AS datetime),1,N'wCONFETIQUETAS',NULL,NULL),
  (100,6,3,N'Grupos de Etiquetas',CAST(N'2011-11-19 00:00:00.000' AS datetime),1,N'wgetixcal',NULL,NULL),
  (100,6,10,N'Definir Lineas de Proceso',CAST(N'2014-11-05 00:00:00.000' AS datetime),1,N'wlineas',NULL,NULL),
  (100,6,11,N'Configuracion de Lineas de Proceso',CAST(N'2014-11-05 00:00:00.000' AS datetime),1,N'wlinconfig',NULL,NULL),
  (100,6,12,N'Impresoras por linea',CAST(N'2018-09-07 00:00:00.000' AS datetime),1,N'wconfimpresoras',N'eti-impresoras',NULL),
  (100,6,13,N'Ordenes de Impresion PLC',CAST(N'2018-09-07 00:00:00.000' AS datetime),1,N'wORDIMPREPLC',NULL,NULL),
  (100,8,1,N'Lectura de cajas',CAST(N'2012-10-27 00:00:00.000' AS datetime),1,N'wcapcajas02',NULL,NULL),
  (100,8,10,N'Regulariza Lectura de Cajas',CAST(N'2014-11-14 00:00:00.000' AS datetime),1,N'wcapcajas03',NULL,NULL),
  (100,9,1,N'Facturacion de Guias',CAST(N'2011-11-28 00:00:00.000' AS datetime),1,N'wfacturaguias',NULL,NULL),
  (100,9,2,N'Administracion de Documentos',CAST(N'2016-12-22 00:00:00.000' AS datetime),1,N'wfacturas',NULL,NULL),
  (100,9,10,N'Lista de Precios',CAST(N'2011-11-28 00:00:00.000' AS datetime),1,N'wLPRECIO',NULL,NULL),
  (100,10,1,N'Stock Ingresos Planta',CAST(N'2006-03-06 00:00:00.000' AS datetime),1,N'wstockgeni',NULL,NULL),
  (100,10,10,N'Fruta Procesada',CAST(N'2007-10-01 00:00:00.000' AS datetime),1,N'wconsprocesos',NULL,NULL),
  (100,10,11,N'Informacion para Exportadora',CAST(N'2008-02-13 00:00:00.000' AS datetime),1,N'winfoexp',NULL,NULL),
  (100,10,20,N'Existencia Fruta Inspeccionada',CAST(N'2007-05-17 00:00:00.000' AS datetime),1,N'wexisins',NULL,NULL),
  (100,10,21,N'Existencia SAG',CAST(N'2007-10-07 00:00:00.000' AS datetime),1,N'wexissag',NULL,NULL),
  (100,10,22,N'Existencia Procesos USDA',CAST(N'2007-12-22 00:00:00.000' AS datetime),1,N'wexisusda',NULL,NULL),
  (100,10,30,N'Despachado por Exportador',CAST(N'2007-11-30 00:00:00.000' AS datetime),1,N'wdesxexport',NULL,NULL),
  (100,10,31,N'Despachado por Agente',CAST(N'2007-12-01 00:00:00.000' AS datetime),1,N'wdesxagente',NULL,NULL),
  (100,10,32,N'Despachado por Consignatario',CAST(N'2007-12-01 00:00:00.000' AS datetime),1,N'wdesxconsig',NULL,NULL),
  (100,10,33,N'Despachado por Cliente',CAST(N'2011-12-15 00:00:00.000' AS datetime),1,N'wdespxcliente',NULL,NULL),
  (100,10,50,N'Existencia de Cajas Procesadas',CAST(N'2009-11-05 00:00:00.000' AS datetime),1,N'wEXISCS',NULL,NULL),
  (100,15,1,N'Recepcion de Fruta',CAST(N'2012-11-08 00:00:00.000' AS datetime),1,N'wcrecepfrut',NULL,NULL),
  (100,15,3,N'Ordenes de Proceso',CAST(N'2012-11-08 00:00:00.000' AS datetime),1,N'wcordprocesos',NULL,NULL),
  (100,15,5,N'Existencia de Cajas',CAST(N'2011-10-05 00:00:00.000' AS datetime),1,N'wEXISCS',NULL,NULL),
  (100,15,10,N'Informe de Proceso Consolidado',CAST(N'2012-11-08 00:00:00.000' AS datetime),1,N'wcinfoprod',NULL,NULL),
  (100,15,14,N'Fruta Comercial',CAST(N'2012-11-08 00:00:00.000' AS datetime),1,N'wcfrutcom',NULL,NULL),
  (100,15,15,N'Dashboard calidad recepcion',CAST(N'2026-08-12 00:00:00.000' AS datetime),1,N'wdashcalidadrecep',NULL,NULL),
  (100,20,1,N'Inspecciones',CAST(N'2005-08-29 00:00:00.000' AS datetime),1,N'winspecciones',NULL,NULL),
  (100,20,2,N'Repaletizajes',CAST(N'2007-05-03 00:00:00.000' AS datetime),1,N'wrepaletizajes',NULL,NULL),
  (100,20,3,N'Despachos Origen',CAST(N'2007-05-23 00:00:00.000' AS datetime),1,N'wdespachossag',NULL,NULL),
  (100,20,4,N'Anulaciones Folios Inspeccionados',CAST(N'2007-10-09 00:00:00.000' AS datetime),1,N'wanulaciones',NULL,NULL),
  (100,20,6,N'Archivos multipuertos',CAST(N'2009-01-07 00:00:00.000' AS datetime),1,NULL,NULL,NULL),
  (100,20,7,N'Diagramas',CAST(N'2012-12-11 00:00:00.000' AS datetime),1,N'wdiagramas',NULL,NULL),
  (100,20,8,N'Interplata',CAST(N'2016-04-29 00:00:00.000' AS datetime),1,N'WINTERPLANTA',NULL,NULL),
  (100,20,10,N'Procesos Fumigacion/Muestreo',CAST(N'2008-02-27 00:00:00.000' AS datetime),1,N'wprocesosUSDA',NULL,NULL),
  (100,20,11,N'Despachos Fumigacion/Muestreo',CAST(N'2008-02-27 00:00:00.000' AS datetime),1,N'wdespachosus',NULL,NULL),
  (110,1,1,N'Configuraciones de Etiquetas',CAST(N'2026-08-18 00:00:00.000' AS datetime),1,N'wconfigeti',N'op_mantenedores',NULL),
  (110,2,2,N'ADM Ordenes de Proceso',CAST(N'2026-08-18 00:00:00.000' AS datetime),1,N'wadmordproc',N'op_operacional',NULL),
  (120,1,1,N'Folios Procesados',CAST(N'2026-10-15 00:00:00.000' AS datetime),1,N'sagfolios',N'procesos_sag',NULL),
  (120,1,2,N'Inspecciones',CAST(N'2026-10-15 00:00:00.000' AS datetime),1,N'saginspecciones',N'procesos_sag',NULL),
  (120,1,3,N'Despachos SAG',CAST(N'2026-10-15 00:00:00.000' AS datetime),1,N'sagdespachos',N'procesos_sag',NULL),
  (130,1,1,N'Listado de guias',CAST(N'2026-10-15 00:00:00.000' AS datetime),1,N'/guias/electronicas',N'guias',NULL);

  UPDATE T SET T.ProgDes=P.ProgDes,T.ProgFcrea=COALESCE(T.ProgFcrea,P.ProgFcrea),T.ProgTipo=P.ProgTipo,T.ProgNomGX=P.ProgNomGX,T.ProgIDmenu=P.ProgIDmenu,T.ProgTarget=P.ProgTarget
  FROM dbo.PROGRAM T JOIN @Programas P ON P.SistCod=T.SistCod AND P.Modcod=T.Modcod AND P.ProgCod=T.ProgCod;
  INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgFcrea,ProgTipo,ProgNomGX,ProgIDmenu,ProgTarget)
  SELECT P.SistCod,P.Modcod,P.ProgCod,P.ProgDes,P.ProgFcrea,P.ProgTipo,P.ProgNomGX,P.ProgIDmenu,P.ProgTarget FROM @Programas P
  WHERE NOT EXISTS (SELECT 1 FROM dbo.PROGRAM T WHERE T.SistCod=P.SistCod AND T.Modcod=P.Modcod AND T.ProgCod=P.ProgCod);

  DECLARE @Acciones TABLE (SistCod smallint,Modcod smallint,ProgCod smallint,ProgOPCod smallint,ProgOPDes char(35) NULL,PRIMARY KEY(SistCod,Modcod,ProgCod,ProgOPCod));
  INSERT INTO @Acciones VALUES
  (1,1,1,1,N'Crea'),
  (1,1,1,2,N'Modifica'),
  (1,1,1,3,N'Elimina'),
  (1,1,2,1,N'Crea'),
  (1,1,2,2,N'Modifica'),
  (1,1,2,3,N'Elimina'),
  (1,1,2,5,N'Abre'),
  (1,1,3,1,N'crea'),
  (1,1,3,2,N'modifica'),
  (1,1,3,3,N'elimina'),
  (1,1,4,1,N'CREA'),
  (1,1,4,2,N'MODIFICA'),
  (1,1,4,3,N'ELIMINA'),
  (1,1,5,1,N'Asigna'),
  (10,10,3,1,N'CREA'),
  (10,10,3,2,N'MODIFICA'),
  (10,10,3,3,N'ELIMINA'),
  (10,10,3,4,N'CARGA ARTICULOS'),
  (10,11,9,1,N'CREA'),
  (10,11,9,2,N'MODIFICA'),
  (10,11,9,3,N'ELIMINA'),
  (10,11,21,1,N'CREA'),
  (10,11,21,2,N'MODIFICA'),
  (10,11,21,3,N'ELIMINA'),
  (10,11,22,1,N'CREA'),
  (10,11,22,2,N'MODIFICA'),
  (10,11,22,3,N'ELIMINA'),
  (10,11,23,1,N'CREA'),
  (10,11,23,2,N'MODIFICA'),
  (10,11,23,3,N'ELIMINA'),
  (10,11,24,1,N'CREA'),
  (10,11,24,2,N'MODIFICA'),
  (10,11,24,3,N'ELIMINA'),
  (10,11,25,1,N'CREA'),
  (10,11,25,2,N'MODIFICA'),
  (10,11,25,3,N'ELIMINA'),
  (10,11,26,1,N'crea'),
  (10,11,26,2,N'MODIFICA'),
  (10,11,26,3,N'ELIMINA'),
  (10,11,27,1,N'CREA'),
  (10,11,27,2,N'MODIFICA'),
  (10,11,27,3,N'ELIMINA'),
  (70,4,1,1,N'CREA'),
  (70,4,1,2,N'MODIFICA'),
  (70,4,1,3,N'ELIMINA'),
  (70,6,13,1,N'crea'),
  (70,6,13,2,N'modifica'),
  (70,6,13,3,N'elimina'),
  (100,1,30,1,N'Crear'),
  (100,1,30,2,N'Modificar'),
  (100,1,30,3,N'Eliminar'),
  (100,1,32,1,N'crea'),
  (100,1,32,2,N'modifica'),
  (100,1,32,3,N'elimina'),
  (100,2,1,1,N'crea'),
  (100,2,1,2,N'modifica'),
  (100,2,1,3,N'elimina'),
  (100,2,2,1,N'crea'),
  (100,2,2,2,N'modifica'),
  (100,2,2,3,N'elimina'),
  (100,2,6,1,N'crea'),
  (100,2,6,2,N'modifica'),
  (100,2,6,3,N'elimina'),
  (100,2,7,1,N'CREA'),
  (100,2,7,2,N'MODIFICAR'),
  (100,2,7,3,N'ELIMINAR'),
  (100,2,8,1,N'Crea'),
  (100,2,8,2,N'Modifica'),
  (100,2,8,3,N'Elimina'),
  (100,2,8,5,N'abrir'),
  (100,2,20,1,N'crea'),
  (100,2,20,2,N'modifica'),
  (100,2,20,3,N'elimina'),
  (100,2,32,1,N'crea'),
  (100,2,32,2,N'modifica'),
  (100,2,32,3,N'anula'),
  (100,6,2,1,N'crea'),
  (100,6,2,2,N'modifica'),
  (100,6,2,3,N'elimina'),
  (100,6,3,1,N'crea'),
  (100,6,3,2,N'modifica'),
  (100,6,3,3,N'elimina'),
  (100,6,10,1,N'crea'),
  (100,6,10,2,N'modificA'),
  (100,6,10,3,N'elimina'),
  (100,6,11,1,N'crea'),
  (100,6,11,2,N'modi'),
  (100,6,11,3,N'eli'),
  (100,6,12,1,N'Crear'),
  (100,6,12,2,N'Modificar'),
  (100,6,12,3,N'Eliminar'),
  (100,9,2,1,N'crea'),
  (100,9,2,2,N'modifica'),
  (100,9,2,3,N'elimina'),
  (100,9,10,1,N'Crea'),
  (100,9,10,2,N'Modifica'),
  (100,9,10,3,N'Elimina'),
  (100,20,7,1,N'crea'),
  (100,20,7,2,N'modifica'),
  (100,20,7,3,N'elimina'),
  (100,20,8,1,N'crea'),
  (100,20,8,2,N'modifica'),
  (100,20,8,3,N'elimina');

  UPDATE T SET T.ProgOPDes=A.ProgOPDes
  FROM dbo.PROGRAM1 T JOIN @Acciones A ON A.SistCod=T.SistCod AND A.Modcod=T.Modcod AND A.ProgCod=T.ProgCod AND A.ProgOPCod=T.ProgOPCod;
  INSERT dbo.PROGRAM1 (SistCod,Modcod,ProgCod,ProgOPCod,ProgOPDes)
  SELECT A.SistCod,A.Modcod,A.ProgCod,A.ProgOPCod,A.ProgOPDes FROM @Acciones A
  WHERE NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 T WHERE T.SistCod=A.SistCod AND T.Modcod=A.Modcod AND T.ProgCod=A.ProgCod AND T.ProgOPCod=A.ProgOPCod);

  IF NOT EXISTS (SELECT 1 FROM dbo.UROLES WHERE RTRIM(ROLCod)='ADMINFULL')
    INSERT dbo.UROLES (ROLCod,ROLNombre,ROLFCrea,ROLUCrea) VALUES ('ADMINFULL','Administrador acceso completo',SYSDATETIME(),'MIGRACION');

  INSERT dbo.ASIGSIST (GECODEMP,AsgSisLogin,SistCod)
  SELECT 0,'ADMINFULL',S.SistCod FROM @Sistemas S
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIGSIST A WHERE A.GECODEMP=0 AND RTRIM(A.AsgSisLogin)='ADMINFULL' AND A.SistCod=S.SistCod);

  INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
  SELECT 0,'ADMINFULL',M.SistCod,M.Modcod,'MIGRACION' FROM @Modulos M
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIG A WHERE A.GECODEMP=0 AND RTRIM(A.AsigUsu)='ADMINFULL' AND A.SistCod=M.SistCod AND A.AsigMod=M.Modcod);

  INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
  SELECT 0,'ADMINFULL',P.SistCod,P.Modcod,P.ProgCod,'MIGRACION' FROM @Programas P
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG A WHERE A.GECODEMP=0 AND RTRIM(A.UsuLogin)='ADMINFULL' AND A.SistCod=P.SistCod AND A.Modcod=P.Modcod AND A.ProgCod=P.ProgCod);

  INSERT dbo.ASIGPROG1 (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgOPCod)
  SELECT 0,'ADMINFULL',A.SistCod,A.Modcod,A.ProgCod,A.ProgOPCod FROM @Acciones A
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG1 X WHERE X.GECODEMP=0 AND RTRIM(X.UsuLogin)='ADMINFULL' AND X.SistCod=A.SistCod AND X.Modcod=A.Modcod AND X.ProgCod=A.ProgCod AND X.ProgOPCod=A.ProgOPCod);

  IF @EmpCodUsuario IS NOT NULL OR NULLIF(RTRIM(@UsuLogin),'') IS NOT NULL
  BEGIN
    IF @EmpCodUsuario IS NULL OR NULLIF(RTRIM(@UsuLogin),'') IS NULL
      RAISERROR(N'Debe completar @EmpCodUsuario y @UsuLogin juntos.',16,1);
    IF NOT EXISTS (SELECT 1 FROM dbo.SEGUSUEMP WHERE GECODEMP=@EmpCodUsuario AND RTRIM(UsuLogin)=RTRIM(@UsuLogin) AND UsuEstado=1)
      RAISERROR(N'El usuario no esta habilitado para la empresa indicada en SEGUSUEMP.',16,1);

    INSERT dbo.ASIGSIST (GECODEMP,AsgSisLogin,SistCod)
    SELECT @EmpCodUsuario,@UsuLogin,S.SistCod FROM @Sistemas S
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIGSIST A WHERE A.GECODEMP=@EmpCodUsuario AND RTRIM(A.AsgSisLogin)=RTRIM(@UsuLogin) AND A.SistCod=S.SistCod);

    INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
    SELECT @EmpCodUsuario,@UsuLogin,M.SistCod,M.Modcod,'MIGRACION' FROM @Modulos M
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIG A WHERE A.GECODEMP=@EmpCodUsuario AND RTRIM(A.AsigUsu)=RTRIM(@UsuLogin) AND A.SistCod=M.SistCod AND A.AsigMod=M.Modcod);

    INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
    SELECT @EmpCodUsuario,@UsuLogin,P.SistCod,P.Modcod,P.ProgCod,'MIGRACION' FROM @Programas P
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG A WHERE A.GECODEMP=@EmpCodUsuario AND RTRIM(A.UsuLogin)=RTRIM(@UsuLogin) AND A.SistCod=P.SistCod AND A.Modcod=P.Modcod AND A.ProgCod=P.ProgCod);

    INSERT dbo.ASIGPROG1 (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgOPCod)
    SELECT @EmpCodUsuario,@UsuLogin,A.SistCod,A.Modcod,A.ProgCod,A.ProgOPCod FROM @Acciones A
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG1 X WHERE X.GECODEMP=@EmpCodUsuario AND RTRIM(X.UsuLogin)=RTRIM(@UsuLogin) AND X.SistCod=A.SistCod AND X.Modcod=A.Modcod AND X.ProgCod=A.ProgCod AND X.ProgOPCod=A.ProgOPCod);
  END;

  IF (SELECT COUNT(*) FROM dbo.SISTEMAS S WHERE EXISTS (SELECT 1 FROM @Sistemas X WHERE X.SistCod=S.SistCod))<>7 RAISERROR(N'Validacion de sistemas incompleta.',16,1);
  IF (SELECT COUNT(*) FROM dbo.MODULOS M WHERE EXISTS (SELECT 1 FROM @Modulos X WHERE X.SistCod=M.SistCod AND X.Modcod=M.Modcod))<>24 RAISERROR(N'Validacion de modulos incompleta.',16,1);
  IF (SELECT COUNT(*) FROM dbo.PROGRAM P WHERE EXISTS (SELECT 1 FROM @Programas X WHERE X.SistCod=P.SistCod AND X.Modcod=P.Modcod AND X.ProgCod=P.ProgCod))<>173 RAISERROR(N'Validacion de programas incompleta.',16,1);
  IF (SELECT COUNT(*) FROM dbo.PROGRAM1 P WHERE EXISTS (SELECT 1 FROM @Acciones X WHERE X.SistCod=P.SistCod AND X.Modcod=P.Modcod AND X.ProgCod=P.ProgCod AND X.ProgOPCod=P.ProgOPCod))<>103 RAISERROR(N'Validacion de acciones incompleta.',16,1);

  SELECT
    (SELECT COUNT(*) FROM dbo.ASIGSIST WHERE GECODEMP=0 AND RTRIM(AsgSisLogin)='ADMINFULL') SistemasADMINFULL,
    (SELECT COUNT(*) FROM dbo.ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)='ADMINFULL') ModulosADMINFULL,
    (SELECT COUNT(*) FROM dbo.ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)='ADMINFULL') ProgramasADMINFULL,
    (SELECT COUNT(*) FROM dbo.ASIGPROG1 WHERE GECODEMP=0 AND RTRIM(UsuLogin)='ADMINFULL') AccionesADMINFULL;

  COMMIT TRANSACTION;
  PRINT N'Catalogo y permisos de menu actualizados correctamente.';
END TRY
BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  DECLARE @Mensaje nvarchar(2048)=ERROR_MESSAGE();
  RAISERROR(@Mensaje,16,1);
END CATCH;
