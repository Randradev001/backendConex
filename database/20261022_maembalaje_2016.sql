/*
  Estructura base del maestro de embalajes.
  Se conserva el nombre fisico solicitado y el alcance queda limitado a la
  tabla; no registra un programa ni crea una pantalla.
  Compatible con SQL Server 2016 y repetible.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.MAEmbalaje', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MAEmbalaje
  (
    EmpCod smallint NOT NULL,
    EmbCod smallint NOT NULL,
    EmbDes varchar(20) NOT NULL,
    CONSTRAINT PK_MAEmbalaje PRIMARY KEY (EmpCod, EmbCod)
  );
END;

COMMIT TRANSACTION;

SELECT EmpCod, EmbCod, EmbDes
FROM dbo.MAEmbalaje;
