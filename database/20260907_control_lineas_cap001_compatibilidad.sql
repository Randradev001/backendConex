/* Corrige instalaciones donde CAP001 fue creada como tabla auxiliar parcial. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.CAP001', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAP001
  (
    EmpCod smallint NULL,
    TempCod char(9) NULL,
    CAPCOD decimal(10,0) NULL,
    CAPNproc decimal(10,0) NULL,
    CAPFecLog datetime NULL,
    CliCod int NULL,
    ExpCod int NULL
  );
END;
ELSE
BEGIN
  IF COL_LENGTH(N'dbo.CAP001', N'TempCod') IS NULL
    ALTER TABLE dbo.CAP001 ADD TempCod char(9) NULL;
  IF COL_LENGTH(N'dbo.CAP001', N'CAPCOD') IS NULL
    ALTER TABLE dbo.CAP001 ADD CAPCOD decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.CAP001', N'CAPNproc') IS NULL
    ALTER TABLE dbo.CAP001 ADD CAPNproc decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.CAP001', N'CAPFecLog') IS NULL
    ALTER TABLE dbo.CAP001 ADD CAPFecLog datetime NULL;
END;

IF NOT EXISTS
(
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID(N'dbo.CAP001') AND name=N'IND_CAPORDPROC'
)
  CREATE INDEX IND_CAPORDPROC ON dbo.CAP001 (EmpCod, TempCod, CAPNproc);

SELECT
  COL_LENGTH(N'dbo.CAP001', N'TempCod') AS TempCodBytes,
  COL_LENGTH(N'dbo.CAP001', N'CAPCOD') AS CAPCODBytes,
  COL_LENGTH(N'dbo.CAP001', N'CAPNproc') AS CAPNprocBytes,
  COL_LENGTH(N'dbo.CAP001', N'CAPFecLog') AS CAPFecLogBytes,
  CASE WHEN EXISTS
  (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.CAP001') AND name=N'IND_CAPORDPROC'
  ) THEN 1 ELSE 0 END AS IndiceCreado;
