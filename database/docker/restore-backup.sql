SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID(N'CONEX') IS NOT NULL
BEGIN
  PRINT 'La base CONEX ya existe; no se restaura nuevamente.';
  RETURN;
END;

DECLARE @BackupPath nvarchar(4000) = N'/docker/backup/CONEX.bak';

CREATE TABLE #BackupFiles (
  LogicalName nvarchar(128) NOT NULL,
  PhysicalName nvarchar(260) NOT NULL,
  [Type] char(1) NOT NULL,
  FileGroupName nvarchar(128) NULL,
  Size numeric(20,0) NOT NULL,
  MaxSize numeric(20,0) NOT NULL,
  FileID bigint NOT NULL,
  CreateLSN numeric(25,0) NOT NULL,
  DropLSN numeric(25,0) NULL,
  UniqueID uniqueidentifier NOT NULL,
  ReadOnlyLSN numeric(25,0) NULL,
  ReadWriteLSN numeric(25,0) NULL,
  BackupSizeInBytes bigint NULL,
  SourceBlockSize int NULL,
  FileGroupID int NULL,
  LogGroupGUID uniqueidentifier NULL,
  DifferentialBaseLSN numeric(25,0) NULL,
  DifferentialBaseGUID uniqueidentifier NULL,
  IsReadOnly bit NULL,
  IsPresent bit NULL,
  TDEThumbprint varbinary(32) NULL,
  SnapshotURL nvarchar(360) NULL
);

DECLARE @FileListSql nvarchar(max) =
  N'RESTORE FILELISTONLY FROM DISK = N''' + REPLACE(@BackupPath, '''', '''''') + N''';';
INSERT INTO #BackupFiles EXEC (@FileListSql);

DECLARE @MoveClauses nvarchar(max) = N'';
DECLARE @LogicalName nvarchar(128);
DECLARE @FileType char(1);
DECLARE @FileId bigint;
DECLARE backup_files CURSOR LOCAL FAST_FORWARD FOR
  SELECT LogicalName, [Type], FileID FROM #BackupFiles ORDER BY FileID;

OPEN backup_files;
FETCH NEXT FROM backup_files INTO @LogicalName, @FileType, @FileId;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @MoveClauses = @MoveClauses
    + N', MOVE N''' + REPLACE(@LogicalName, '''', '''''') + N''' TO N''/var/opt/mssql/data/CONEX_'
    + CONVERT(nvarchar(20), @FileId)
    + CASE WHEN @FileType = 'L' THEN N'.ldf''' ELSE N'.mdf''' END;
  FETCH NEXT FROM backup_files INTO @LogicalName, @FileType, @FileId;
END;
CLOSE backup_files;
DEALLOCATE backup_files;

DECLARE @RestoreSql nvarchar(max) =
  N'RESTORE DATABASE [CONEX] FROM DISK = N''' + REPLACE(@BackupPath, '''', '''''')
  + N''' WITH RECOVERY, REPLACE, STATS = 10' + @MoveClauses + N';';

EXEC (@RestoreSql);
ALTER DATABASE [CONEX] SET COMPATIBILITY_LEVEL = 130;

DBCC CHECKDB (N'CONEX') WITH NO_INFOMSGS;
PRINT 'Respaldo restaurado y DBCC CHECKDB completado.';
