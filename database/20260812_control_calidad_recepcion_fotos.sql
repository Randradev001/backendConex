/* Fotografias binarias asociadas al control de calidad de recepcion. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.CALRECEPFOTO','U') IS NULL
BEGIN
  CREATE TABLE dbo.CALRECEPFOTO (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    CalFotoId bigint IDENTITY(1,1) NOT NULL,
    CalFotoNombre varchar(255) NOT NULL,
    CalFotoMime varchar(50) NOT NULL,
    CalFotoTamano int NOT NULL,
    CalFotoContenido varbinary(max) NOT NULL,
    CalFotoOrden smallint NOT NULL,
    CalFotoLoginC char(10) NOT NULL,
    CalFotoFecC datetime NOT NULL CONSTRAINT DF_CALRECEPFOTO_FecC DEFAULT(GETDATE()),
    CONSTRAINT PK_CALRECEPFOTO PRIMARY KEY(EmpCod,CalRecId,CalFotoId),
    CONSTRAINT FK_CALRECEPFOTO_Control FOREIGN KEY(EmpCod,CalRecId)
      REFERENCES dbo.CALRECEP(EmpCod,CalRecId) ON DELETE CASCADE,
    CONSTRAINT CK_CALRECEPFOTO_Tamano CHECK(CalFotoTamano>0 AND CalFotoTamano<=5242880),
    CONSTRAINT CK_CALRECEPFOTO_Orden CHECK(CalFotoOrden>0)
  );
  CREATE INDEX IX_CALRECEPFOTO_Control ON dbo.CALRECEPFOTO(EmpCod,CalRecId,CalFotoOrden,CalFotoId);
END;

COMMIT TRANSACTION;
