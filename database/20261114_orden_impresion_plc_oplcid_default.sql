/*
  The PLC inserts only OPLCIMP and OPLCProc.  OPLCID was historical decimal
  data without IDENTITY or a default, so those inserts could not persist.
*/
IF OBJECT_ID(N'dbo.SeqOrdenImpresion', N'SO') IS NULL
BEGIN
  DECLARE @NextId decimal(10,0);
  DECLARE @CreateSequence nvarchar(max);
  SELECT @NextId=ISNULL(MAX(OPLCID),0)+1 FROM dbo.OrdenImpresion;
  SET @CreateSequence=N'CREATE SEQUENCE dbo.SeqOrdenImpresion AS decimal(10,0) START WITH '
    + CONVERT(nvarchar(20),@NextId) + N' INCREMENT BY 1;';
  EXEC(@CreateSequence);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.default_constraints d
  INNER JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id
  WHERE d.parent_object_id=OBJECT_ID(N'dbo.OrdenImpresion') AND c.name=N'OPLCID'
)
  ALTER TABLE dbo.OrdenImpresion
    ADD CONSTRAINT DF_OrdenImpresion_OPLCID DEFAULT (NEXT VALUE FOR dbo.SeqOrdenImpresion) FOR OPLCID;
GO
