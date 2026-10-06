SET NOCOUNT ON;
SET XACT_ABORT ON;

/*
  Estructuras GX8 requeridas por la preparacion ZPL del agente remoto.
  El script solo crea tablas ausentes; una tabla parcial se informa para evitar
  alterar silenciosamente una estructura productiva desconocida.
*/

IF OBJECT_ID(N'dbo.ConfImpresoras', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ConfImpresoras (
    EmpCod smallint NOT NULL,
    CIMPID smallint NOT NULL,
    CIMPNombre char(50) NULL,
    CIMPIP char(15) NULL,
    CONSTRAINT PK_ConfImpresoras PRIMARY KEY (EmpCod, CIMPID)
  );
END
ELSE IF COL_LENGTH(N'dbo.ConfImpresoras', N'CIMPID') IS NULL
     OR COL_LENGTH(N'dbo.ConfImpresoras', N'CIMPIP') IS NULL
BEGIN
  THROW 50001, 'dbo.ConfImpresoras existe con una estructura incompatible; revisar antes de modificar.', 1;
END;

IF OBJECT_ID(N'dbo.ETIXCAL', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ETIXCAL (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    Ordpnum decimal(10,0) NOT NULL,
    Calibre char(10) NOT NULL,
    ConfCod char(10) NULL,
    CONSTRAINT PK_ETIXCAL PRIMARY KEY (EmpCod, TempCod, Ordpnum, Calibre)
  );
END
ELSE IF COL_LENGTH(N'dbo.ETIXCAL', N'ConfCod') IS NULL
BEGIN
  THROW 50002, 'dbo.ETIXCAL existe con una estructura incompatible; revisar antes de modificar.', 1;
END;

SELECT
  OBJECT_ID(N'dbo.ConfImpresoras', N'U') AS ConfImpresorasObjectId,
  OBJECT_ID(N'dbo.ETIXCAL', N'U') AS EtiXCalObjectId;

