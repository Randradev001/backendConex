SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.PRINTJOBPREPARATION', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PRINTJOBPREPARATION (
    PreparationId uniqueidentifier NOT NULL,
    AgentId varchar(80) NOT NULL,
    InstallationId varchar(80) NOT NULL,
    LocalJobId decimal(18,0) NOT NULL,
    EmpCod smallint NOT NULL,
    LineId smallint NOT NULL,
    BoxNumber decimal(10,0) NOT NULL,
    PrinterId smallint NOT NULL,
    PrinterName varchar(50) NOT NULL,
    PrinterHost varchar(255) NOT NULL,
    PrinterPort int NOT NULL,
    LabelCode char(10) NOT NULL,
    LabelVersion int NOT NULL,
    Zpl nvarchar(max) NOT NULL,
    ZplSha256 char(64) NOT NULL,
    Status varchar(30) NOT NULL,
    ResultDetail nvarchar(1000) NULL,
    CreatedAt datetime NOT NULL,
    UpdatedAt datetime NOT NULL,
    LastResultAt datetime NULL,
    CONSTRAINT PK_PRINTJOBPREPARATION PRIMARY KEY (PreparationId),
    CONSTRAINT CK_PRINTJOBPREPARATION_Port CHECK (PrinterPort BETWEEN 1 AND 65535),
    CONSTRAINT CK_PRINTJOBPREPARATION_Status CHECK (Status IN (
      'prepared','printed','failed_before_send','uncertain','rejected_local'
    ))
  );

  CREATE UNIQUE INDEX UX_PRINTJOBPREPARATION_LocalJob
    ON dbo.PRINTJOBPREPARATION(InstallationId, LocalJobId);
  CREATE INDEX IX_PRINTJOBPREPARATION_AgentStatus
    ON dbo.PRINTJOBPREPARATION(AgentId, Status, UpdatedAt);
END;

PRINT 'PRINTJOBPREPARATION disponible.';
