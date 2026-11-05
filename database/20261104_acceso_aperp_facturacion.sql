SET NOCOUNT ON;

IF OBJECT_ID(N'integracion.GuiaAcceso', N'U') IS NULL
  THROW 50001, 'Debe instalar primero integracion.GuiaAcceso.', 1;

IF COL_LENGTH('integracion.GuiaAcceso', 'Destino') IS NULL
BEGIN
  ALTER TABLE integracion.GuiaAcceso ADD Destino varchar(20) NULL;
  EXEC(N'UPDATE integracion.GuiaAcceso SET Destino=''GUIAS'' WHERE Destino IS NULL;');
  EXEC(N'ALTER TABLE integracion.GuiaAcceso ALTER COLUMN Destino varchar(20) NOT NULL;');
  EXEC(N'ALTER TABLE integracion.GuiaAcceso ADD CONSTRAINT DF_GuiaAcceso_Destino DEFAULT (''GUIAS'') FOR Destino;');
END;
