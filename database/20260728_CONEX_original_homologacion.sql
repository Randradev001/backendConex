/*
  Homologa la base CONEX original para el backend React/Node.

  Ejecutar conectado a una copia escribible de CONEX. El script conserva las
  tablas y datos GX8; solamente agrega soporte de autenticacion, roles y menu.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.DEFEMP', N'U') IS NULL
   OR OBJECT_ID(N'dbo.USUARIOS', N'U') IS NULL
   OR OBJECT_ID(N'dbo.ASIGSIST', N'U') IS NULL
   OR OBJECT_ID(N'dbo.ASIG', N'U') IS NULL
   OR OBJECT_ID(N'dbo.ASIGPROG', N'U') IS NULL
   OR OBJECT_ID(N'dbo.ASIGPROG1', N'U') IS NULL
BEGIN
  RAISERROR('La base seleccionada no corresponde al modelo CONEX GX8 esperado.', 16, 1);
  RETURN;
END;

BEGIN TRANSACTION;

/* Metadatos React. Son aditivos y no cambian las llaves ni reglas GX8. */
IF COL_LENGTH(N'dbo.SISTEMAS', N'SistFAIcons') IS NULL
  ALTER TABLE dbo.SISTEMAS ADD SistFAIcons varchar(30) NULL;

IF COL_LENGTH(N'dbo.MODULOS', N'ModFAIcons') IS NULL
  ALTER TABLE dbo.MODULOS ADD ModFAIcons varchar(30) NULL;

IF COL_LENGTH(N'dbo.PROGRAM', N'ProgIDmenu') IS NULL
  ALTER TABLE dbo.PROGRAM ADD ProgIDmenu varchar(20) NULL;

IF COL_LENGTH(N'dbo.PROGRAM', N'ProgTarget') IS NULL
  ALTER TABLE dbo.PROGRAM ADD ProgTarget varchar(120) NULL;

IF OBJECT_ID(N'dbo.UROLES', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UROLES (
    ROLCod char(10) NOT NULL,
    ROLNombre varchar(30) NOT NULL,
    ROLFCrea datetime2(0) NOT NULL CONSTRAINT DF_UROLES_ROLFCrea DEFAULT (SYSUTCDATETIME()),
    ROLUCrea char(10) NULL,
    CONSTRAINT PK_UROLES PRIMARY KEY (ROLCod)
  );
END;

/* USUARIOS es global en GX8. Esta tabla agrega el alcance por empresa. */
IF OBJECT_ID(N'dbo.SEGUSUEMP', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SEGUSUEMP (
    GECODEMP smallint NOT NULL,
    UsuLogin char(10) NOT NULL,
    UsuEstado smallint NOT NULL CONSTRAINT DF_SEGUSUEMP_Estado DEFAULT (1),
    UsuPerfil char(10) NULL,
    UsuTipo smallint NOT NULL CONSTRAINT DF_SEGUSUEMP_Tipo DEFAULT (0),
    EsPrincipal bit NOT NULL CONSTRAINT DF_SEGUSUEMP_Principal DEFAULT (0),
    FechaCrea datetime2(0) NOT NULL CONSTRAINT DF_SEGUSUEMP_Fecha DEFAULT (SYSUTCDATETIME()),
    UsuCrea char(10) NULL,
    CONSTRAINT PK_SEGUSUEMP PRIMARY KEY (GECODEMP, UsuLogin),
    CONSTRAINT FK_SEGUSUEMP_DEFEMP FOREIGN KEY (GECODEMP) REFERENCES dbo.DEFEMP (EmpCod),
    CONSTRAINT FK_SEGUSUEMP_USUARIOS FOREIGN KEY (UsuLogin) REFERENCES dbo.USUARIOS (UsuLogin)
  );
END;

IF OBJECT_ID(N'dbo.URolesPorUser', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.URolesPorUser (
    GECODEMP smallint NOT NULL,
    UsuLogin char(10) NOT NULL,
    ROLCod char(10) NOT NULL,
    RXUFecCrea datetime2(0) NOT NULL CONSTRAINT DF_URolesPorUser_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_URolesPorUser PRIMARY KEY (GECODEMP, UsuLogin, ROLCod),
    CONSTRAINT FK_URolesPorUser_SEGUSUEMP FOREIGN KEY (GECODEMP, UsuLogin)
      REFERENCES dbo.SEGUSUEMP (GECODEMP, UsuLogin),
    CONSTRAINT FK_URolesPorUser_UROLES FOREIGN KEY (ROLCod) REFERENCES dbo.UROLES (ROLCod)
  );
END;

/* La credencial pertenece a la identidad global; la empresa pertenece a la sesion. */
IF OBJECT_ID(N'dbo.SEGUSUCRED', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SEGUSUCRED (
    UsuLogin char(10) NOT NULL,
    PasswordSalt varchar(64) NOT NULL,
    PasswordHash varchar(256) NOT NULL,
    MigradoDesdeGX bit NOT NULL CONSTRAINT DF_SEGUSUCRED_Migrado DEFAULT (0),
    FechaCambio datetime2(0) NOT NULL CONSTRAINT DF_SEGUSUCRED_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_SEGUSUCRED PRIMARY KEY (UsuLogin),
    CONSTRAINT FK_SEGUSUCRED_USUARIOS FOREIGN KEY (UsuLogin) REFERENCES dbo.USUARIOS (UsuLogin)
  );
END;

IF OBJECT_ID(N'dbo.SEGSESION', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SEGSESION (
    TokenHash varchar(64) NOT NULL,
    UsuLogin char(10) NOT NULL,
    EmpCod smallint NOT NULL,
    FechaCreacion datetime2(0) NOT NULL,
    FechaExpiracion datetime2(0) NOT NULL,
    UltimoUso datetime2(0) NOT NULL,
    Revocada bit NOT NULL CONSTRAINT DF_SEGSESION_Revocada DEFAULT (0),
    CONSTRAINT PK_SEGSESION PRIMARY KEY (TokenHash),
    CONSTRAINT FK_SEGSESION_SEGUSUEMP FOREIGN KEY (EmpCod, UsuLogin)
      REFERENCES dbo.SEGUSUEMP (GECODEMP, UsuLogin)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.SEGSESION') AND name=N'IX_SEGSESION_Usuario')
  CREATE INDEX IX_SEGSESION_Usuario ON dbo.SEGSESION (UsuLogin, Revocada, FechaExpiracion);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.USUARIOS') AND name=N'IX_USUARIOS_UsuRut')
  CREATE INDEX IX_USUARIOS_UsuRut ON dbo.USUARIOS (UsuRut);

/* Deriva las empresas autorizadas desde las asignaciones vigentes del modelo GX8. */
;WITH Asignaciones AS (
  SELECT GECODEMP, RTRIM(AsgSisLogin) AS UsuLogin FROM dbo.ASIGSIST
  UNION
  SELECT GECODEMP, RTRIM(REPLACE(AsigUsu, CHAR(160), ' ')) FROM dbo.ASIG
  UNION
  SELECT GECODEMP, RTRIM(UsuLogin) FROM dbo.ASIGPROG
), UsuariosEmpresa AS (
  SELECT DISTINCT A.GECODEMP, U.UsuLogin
  FROM Asignaciones A
  INNER JOIN dbo.USUARIOS U ON RTRIM(U.UsuLogin)=A.UsuLogin
  INNER JOIN dbo.DEFEMP E ON E.EmpCod=A.GECODEMP
)
INSERT INTO dbo.SEGUSUEMP (GECODEMP, UsuLogin, UsuEstado, UsuPerfil, UsuTipo, EsPrincipal, UsuCrea)
SELECT UE.GECODEMP, UE.UsuLogin, 1, NULL, 0, 0, 'MIGRACION'
FROM UsuariosEmpresa UE
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.SEGUSUEMP T
  WHERE T.GECODEMP=UE.GECODEMP AND T.UsuLogin=UE.UsuLogin
);

UPDATE UE
SET EsPrincipal=CASE WHEN UE.GECODEMP=(
  SELECT MIN(P.GECODEMP) FROM dbo.SEGUSUEMP P WHERE P.UsuLogin=UE.UsuLogin AND P.UsuEstado=1
) THEN 1 ELSE 0 END
FROM dbo.SEGUSUEMP UE;

IF NOT EXISTS (SELECT 1 FROM dbo.UROLES WHERE RTRIM(ROLCod)='ADMINFULL')
  INSERT INTO dbo.UROLES (ROLCod, ROLNombre, ROLUCrea)
  VALUES ('ADMINFULL', 'Administrador acceso completo', 'MIGRACION');

COMMIT TRANSACTION;

SELECT
  DB_NAME() AS BaseDatos,
  (SELECT COUNT(*) FROM dbo.SEGUSUEMP) AS UsuariosEmpresa,
  (SELECT COUNT(*) FROM dbo.UROLES) AS Roles,
  (SELECT COUNT(*) FROM dbo.SISTEMAS) AS Sistemas,
  (SELECT COUNT(*) FROM dbo.MODULOS) AS Modulos,
  (SELECT COUNT(*) FROM dbo.PROGRAM) AS Programas;
