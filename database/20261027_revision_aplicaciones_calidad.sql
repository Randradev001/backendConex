/* Historial auditable de aprobacion y rechazo de aplicaciones de calidad. */
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.CALRECEPREVISION', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CALRECEPREVISION (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    CalRevId bigint IDENTITY(1,1) NOT NULL,
    CalRevDecision char(1) NOT NULL,
    CalRevComentario varchar(1000) NOT NULL,
    CalRevLogin char(10) NOT NULL,
    CalRevFecha datetime NOT NULL CONSTRAINT DF_CALRECEPREVISION_Fecha DEFAULT (GETDATE()),
    CONSTRAINT PK_CALRECEPREVISION PRIMARY KEY (EmpCod, CalRecId, CalRevId),
    CONSTRAINT FK_CALRECEPREVISION_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId),
    CONSTRAINT CK_CALRECEPREVISION_Decision CHECK (CalRevDecision IN ('A','R')),
    CONSTRAINT CK_CALRECEPREVISION_Comentario CHECK (LEN(LTRIM(RTRIM(CalRevComentario))) > 0)
  );

  CREATE INDEX IX_CALRECEPREVISION_Ultima
    ON dbo.CALRECEPREVISION (EmpCod, CalRecId, CalRevId DESC)
    INCLUDE (CalRevDecision, CalRevComentario, CalRevLogin, CalRevFecha);
END;
GO
