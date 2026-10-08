/*
  Script historico del modulo completo.
  Para la base real BDCONEXCO ejecutar 20260723_BDCONEXCO_security_support.sql,
  que conserva las tablas de negocio ya existentes.
*/
IF DB_ID(N'BDCONEXCO') IS NULL
BEGIN
  THROW 50001, 'La base BDCONEXCO no esta adjunta en SQL Server.', 1;
END;
GO

USE [BDCONEXCO];
GO

IF OBJECT_ID(N'dbo.SISTEMAS', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SISTEMAS (
    SistCod numeric(4,0) NOT NULL,
    SistNombre varchar(40) NOT NULL,
    SistFecCrea date NULL,
    CONSTRAINT PK_SISTEMAS PRIMARY KEY (SistCod)
  );
END;
GO

IF OBJECT_ID(N'dbo.MODULOS', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MODULOS (
    SistCod numeric(4,0) NOT NULL,
    Modcod numeric(3,0) NOT NULL,
    ModDes varchar(30) NOT NULL,
    ModTipo numeric(1,0) NULL,
    Modprg varchar(15) NULL,
    ModFcrea date NULL,
    CONSTRAINT PK_MODULOS PRIMARY KEY (SistCod, Modcod)
  );
END;
GO

IF OBJECT_ID(N'dbo.PROGRAM', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PROGRAM (
    SistCod numeric(4,0) NOT NULL,
    Modcod numeric(3,0) NOT NULL,
    ProgCod numeric(3,0) NOT NULL,
    ProgDes varchar(35) NOT NULL,
    ProgNomGX varchar(100) NULL,
    ProgTipo numeric(1,0) NULL,
    ProgFcrea date NULL,
    CONSTRAINT PK_PROGRAM PRIMARY KEY (SistCod, Modcod, ProgCod)
  );
END;
GO

/* Segundo nivel de la transaccion GeneXus Program. */
IF OBJECT_ID(N'dbo.PROGRAM1', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PROGRAM1 (
    SistCod numeric(4,0) NOT NULL,
    Modcod numeric(3,0) NOT NULL,
    ProgCod numeric(3,0) NOT NULL,
    ProgOPCod numeric(4,0) NOT NULL,
    ProgOPDes varchar(35) NOT NULL,
    CONSTRAINT PK_PROGRAM1 PRIMARY KEY (SistCod, Modcod, ProgCod, ProgOPCod)
  );
END;
GO

IF OBJECT_ID(N'dbo.USUARIOS', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.USUARIOS (
    UsuLogin varchar(10) NOT NULL,
    Usunom varchar(35) NOT NULL,
    UsuClave varchar(8) NULL,
    UsuRut numeric(9,0) NULL,
    UsuDV char(1) NULL,
    UsuCorreo varchar(30) NULL,
    UsuCargo varchar(30) NULL,
    UsuNseg numeric(3,0) NULL,
    UsuExpira date NULL,
    usucrea varchar(10) NULL,
    CONSTRAINT PK_USUARIOS PRIMARY KEY (UsuLogin)
  );
END;
GO

IF OBJECT_ID(N'dbo.NIVSEG', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.NIVSEG (
    NSegMod numeric(3,0) NOT NULL,
    NSegDMod varchar(30) NULL,
    NSegProg numeric(3,0) NOT NULL,
    NsegDes varchar(35) NULL,
    NsegIns numeric(3,0) NULL,
    NsegUPD numeric(3,0) NULL,
    NsegDel numeric(3,0) NULL,
    NsegPRC numeric(3,0) NULL,
    NsegLogA varchar(10) NULL,
    CONSTRAINT PK_NIVSEG PRIMARY KEY (NSegMod, NSegProg)
  );
END;
GO

IF OBJECT_ID(N'dbo.ASIGSIST', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ASIGSIST (
    GECODEMP numeric(3,0) NOT NULL,
    AsgSisLogin varchar(10) NOT NULL,
    SistCod numeric(4,0) NOT NULL,
    CONSTRAINT PK_ASIGSIST PRIMARY KEY (GECODEMP, AsgSisLogin, SistCod)
  );
END;
GO

IF OBJECT_ID(N'dbo.ASIG', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ASIG (
    GECODEMP numeric(3,0) NOT NULL,
    AsigUsu varchar(10) NOT NULL,
    SistCod numeric(4,0) NOT NULL,
    AsigMod numeric(3,0) NOT NULL,
    AsigDes varchar(30) NULL,
    AsigAsig varchar(10) NULL,
    CONSTRAINT PK_ASIG PRIMARY KEY (GECODEMP, AsigUsu, SistCod, AsigMod)
  );
END;
GO

IF OBJECT_ID(N'dbo.ASIGPROG', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ASIGPROG (
    GECODEMP numeric(3,0) NOT NULL,
    UsuLogin varchar(10) NOT NULL,
    SistCod numeric(4,0) NOT NULL,
    Modcod numeric(3,0) NOT NULL,
    ProgCod numeric(3,0) NOT NULL,
    ProgUsuC varchar(10) NULL,
    CONSTRAINT PK_ASIGPROG PRIMARY KEY (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod)
  );
END;
GO

/* Alineacion no destructiva si se ejecuto una version preliminar del script. */
IF COL_LENGTH('dbo.NIVSEG', 'NSegDMod') IS NULL ALTER TABLE dbo.NIVSEG ADD NSegDMod varchar(30) NULL;
IF COL_LENGTH('dbo.NIVSEG', 'NsegLogA') IS NULL ALTER TABLE dbo.NIVSEG ADD NsegLogA varchar(10) NULL;
IF COL_LENGTH('dbo.ASIG', 'AsigAsig') IS NULL ALTER TABLE dbo.ASIG ADD AsigAsig varchar(10) NULL;
IF COL_LENGTH('dbo.ASIGPROG', 'ProgUsuC') IS NULL ALTER TABLE dbo.ASIGPROG ADD ProgUsuC varchar(10) NULL;
GO

/* Segundo nivel de la transaccion GeneXus AsigProg; equivale a las acciones de VA2. */
IF OBJECT_ID(N'dbo.ASIGPROG1', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ASIGPROG1 (
    GECODEMP numeric(3,0) NOT NULL,
    UsuLogin varchar(10) NOT NULL,
    SistCod numeric(4,0) NOT NULL,
    Modcod numeric(3,0) NOT NULL,
    ProgCod numeric(3,0) NOT NULL,
    ProgOPCod numeric(4,0) NOT NULL,
    CONSTRAINT PK_ASIGPROG1 PRIMARY KEY (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod)
  );
END;
GO

/* Credenciales modernas separadas para no romper la convivencia con GeneXus 8. */
IF OBJECT_ID(N'dbo.SEGUSUCRED', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SEGUSUCRED (
    GECODEMP numeric(10,0) NOT NULL,
    UsuLogin varchar(10) NOT NULL,
    PasswordSalt varchar(64) NOT NULL,
    PasswordHash varchar(256) NOT NULL,
    MigradoDesdeGX bit NOT NULL CONSTRAINT DF_SEGUSUCRED_Migrado DEFAULT (0),
    FechaCambio datetime2(0) NOT NULL,
    CONSTRAINT PK_SEGUSUCRED PRIMARY KEY (GECODEMP, UsuLogin)
  );
END;
GO

IF OBJECT_ID(N'dbo.SEGSESION', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SEGSESION (
    TokenHash varchar(64) NOT NULL,
    UsuLogin varchar(10) NOT NULL,
    EmpCod numeric(10,0) NOT NULL,
    FechaCreacion datetime2(0) NOT NULL,
    FechaExpiracion datetime2(0) NOT NULL,
    UltimoUso datetime2(0) NOT NULL,
    Revocada bit NOT NULL CONSTRAINT DF_SEGSESION_Revocada DEFAULT (0),
    CONSTRAINT PK_SEGSESION PRIMARY KEY (TokenHash)
  );
  CREATE INDEX IX_SEGSESION_Usuario ON dbo.SEGSESION (UsuLogin, Revocada, FechaExpiracion);
END;
GO

/*
Datos minimos opcionales para una instalacion vacia. No ejecutar sobre BDCONEXCO
sin reemplazar los valores por una empresa real.

INSERT INTO USUARIOS (GECODEMP, UsuLogin, Usunom, UsuClave, UsuRut, UsuDV, UsuCargo, usucrea, UsuCorreo, UsuEstado, UsuPerfil, UsuTipo)
VALUES (100, 'MIGRACION', 'Usuario de migracion', 'CONEX123', 0, ' ', ' ', 'MIGRACION', ' ', 1, ' ', 1);
INSERT INTO SISTEMAS (SistCod, SistNombre) VALUES (1, 'CONEX');
INSERT INTO ASIGSIST (GECODEMP, AsgSisLogin, SistCod) VALUES (100, 'MIGRACION', 1);
*/
