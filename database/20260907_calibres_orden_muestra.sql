/* Orden editable de calibres para captura y graficos de recepcion. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.CALIBRES', N'U') IS NULL
  THROW 50000, 'No existe dbo.CALIBRES.', 1;

IF COL_LENGTH('dbo.CALIBRES', 'CalOrden') IS NULL
  ALTER TABLE dbo.CALIBRES ADD CalOrden smallint NULL;

EXEC sys.sp_executesql N'
  ;WITH OrdenInicial AS (
    SELECT EmpCod,Especod,Calibre,CalOrden,
      ROW_NUMBER() OVER (PARTITION BY EmpCod,Especod ORDER BY
        CASE WHEN CalCod IS NULL THEN 1 ELSE 0 END,CalCod,Calibre) AS Fila
    FROM dbo.CALIBRES
  )
  UPDATE OrdenInicial
  SET CalOrden=CONVERT(smallint,CASE WHEN Fila>32766 THEN 32767 ELSE Fila END)
  WHERE CalOrden IS NULL OR CalOrden<=0;

  ALTER TABLE dbo.CALIBRES ALTER COLUMN CalOrden smallint NOT NULL;
';

IF NOT EXISTS (
  SELECT 1
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  WHERE dc.parent_object_id=OBJECT_ID(N'dbo.CALIBRES') AND c.name=N'CalOrden'
)
  EXEC sys.sp_executesql N'ALTER TABLE dbo.CALIBRES ADD CONSTRAINT DF_CALIBRES_CalOrden DEFAULT (32767) FOR CalOrden;';

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id=OBJECT_ID(N'dbo.CALIBRES') AND name=N'CK_CALIBRES_CalOrden'
)
  EXEC sys.sp_executesql N'ALTER TABLE dbo.CALIBRES ADD CONSTRAINT CK_CALIBRES_CalOrden CHECK (CalOrden BETWEEN 1 AND 32767);';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CALIBRES') AND name=N'IX_CALIBRES_OrdenMuestra')
  EXEC sys.sp_executesql N'CREATE INDEX IX_CALIBRES_OrdenMuestra ON dbo.CALIBRES(EmpCod,Especod,CalOrden,CalCod) INCLUDE (Calibre,calRecepcion);';

COMMIT TRANSACTION;

GO

SELECT EmpCod,Especod,Calibre,CalCod,CalOrden,calRecepcion
FROM dbo.CALIBRES
ORDER BY EmpCod,Especod,CalOrden,CalCod,Calibre;
