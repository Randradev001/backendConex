const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { nextCorrelative } = require('../services/gxCorrelatives.service');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const catalogos = {
  empresas: {
    table: 'DEFEMP',
    gxLevel: 1,
    // DEFEMP es la raiz multiempresa; sus hijos usan EmpCod desde la sesion.
    requiresEmpCod: false,
    rutFields: { number: 'EmpRut', verifier: 'EmpDV' },
    primaryKey: ['EmpCod'],
    columns: ['EmpCod', 'EmpNom', 'EmpGiro', 'Empdir', 'EmpRut', 'EmpDV', 'EmpSw', 'empreg', 'Empcom'],
    orderBy: ['EmpCod'],
    searchColumns: ['EmpNom', 'EmpRut'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      EmpNom: { type: 'text', length: 50, required: true },
      EmpGiro: { type: 'text', length: 35, required: true },
      Empdir: { type: 'text', length: 30, required: true },
      EmpRut: { type: 'int', required: true },
      EmpDV: { type: 'text', length: 1, required: true },
      EmpSw: { type: 'int', required: true, choices: [0, 1], insertDefault: 0 },
      empreg: { type: 'text', length: 4, required: true },
      Empcom: { type: 'text', length: 20, required: true }
    }
  },
  temporadas: {
    table: 'TEMP01',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TempCod'],
    columns: ['EmpCod', 'TempCod', 'TempDes', 'TempFecAbre', 'TempLogA', 'TempFecCierra', 'TempLogC', 'TempActiva'],
    orderBy: ['TempCod'],
    searchColumns: ['TempCod', 'TempDes'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TempCod: { type: 'text', length: 9, required: true },
      TempDes: { type: 'text', length: 20, required: true },
      TempFecAbre: { type: 'date', serverValueOnInsert: 'serverDate', serverManaged: true },
      TempLogA: { type: 'text', length: 10, serverValueOnInsert: 'contextLogin', serverManaged: true },
      TempFecCierra: { type: 'date' },
      TempLogC: { type: 'text', length: 10 },
      TempActiva: { type: 'int', choices: [0, 1], insertDefault: 1 }
    }
  },
  especies: {
    table: 'ESPECIES',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod'],
    columns: ['EmpCod', 'Especod', 'EspeNom', 'EspeDiaV', 'EspeSag', 'EspeNomC', 'EspePLU', 'EspeCMP', 'EspeNomExt', 'EspeSECod'],
    orderBy: ['Especod'],
    searchColumns: ['EspeNom', 'EspeNomC', 'EspeNomExt'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      EspeNom: { type: 'text', length: 20, required: true },
      EspeDiaV: { type: 'int' },
      EspeSag: { type: 'int' },
      EspeNomC: { type: 'text', length: 4, required: true },
      EspePLU: { type: 'text', length: 15 },
      EspeCMP: { type: 'int' },
      EspeNomExt: { type: 'text', length: 20 },
      EspeSECod: { type: 'text', length: 10 }
    }
  },
  variedades: {
    table: 'ESPECIES1',
    gxLevel: 2,
    parentTable: 'ESPECIES',
    parentKey: ['EmpCod', 'Especod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod', 'VarCod'],
    columns: ['EmpCod', 'Especod', 'VarCod', 'VarNom', 'varnomC', 'VarPLU', 'VarSECod'],
    orderBy: ['Especod', 'VarCod'],
    filters: [{ param: 'Especod', column: 'Especod', type: 'int', required: true }],
    searchColumns: ['VarNom', 'varnomC'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      VarCod: { type: 'int', required: true, min: 1 },
      VarNom: { type: 'text', length: 20, required: true },
      varnomC: { type: 'text', length: 4, required: true },
      VarPLU: { type: 'text', length: 15 },
      VarSECod: { type: 'text', length: 10 }
    }
  },
  calibres: {
    table: 'CALIBRES',
    gxLevel: 1,
    parentTable: 'ESPECIES',
    parentKey: ['EmpCod', 'Especod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod', 'Calibre'],
    // Calibre es clave fisica, pero GeneXus permite corregirlo conservando la clave anterior.
    mutablePrimaryKey: { Calibre: 'OriginalCalibre' },
    columns: ['EmpCod', 'Especod', 'Calibre', 'CalCod', 'CalOrden', 'calRecepcion'],
    orderBy: ['Especod', 'CalOrden', 'CalCod', 'Calibre'],
    filters: [{ param: 'Especod', column: 'Especod', type: 'int', required: true }],
    searchColumns: ['Calibre', 'CalCod', 'CalOrden'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      Calibre: { type: 'text', length: 10, required: true },
      CalCod: { type: 'int', min: 1, serverGenerated: true },
      CalOrden: { type: 'int', required: true, min: 1, max: 32767 },
      calRecepcion: { type: 'int', choices: [0, 1], insertDefault: 0 }
    }
  },
  envases: {
    table: 'ENVCAT',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'EnvCod'],
    columns: ['EmpCod', 'EnvCod', 'EnvNom', 'EnvPeso', 'EnvDestare', 'EnvPesoB', 'EnvUso', 'EnvnomC', 'EnvCMP', 'EnvNomExt', 'EnvSECod'],
    orderBy: ['EnvCod'],
    searchColumns: ['EnvNom', 'EnvnomC', 'EnvNomExt'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      EnvCod: { type: 'int', required: true, min: 1 },
      EnvNom: { type: 'text', length: 20, required: true },
      EnvPeso: { type: 'decimal', precision: 10, scale: 4, required: true, exclusiveMin: 0 },
      EnvDestare: { type: 'decimal', precision: 10, scale: 4 },
      EnvPesoB: { type: 'decimal', precision: 10, scale: 4 },
      EnvUso: { type: 'int', required: true, min: 1, insertDefault: 1 },
      EnvnomC: { type: 'text', length: 10 },
      EnvCMP: { type: 'int' },
      EnvNomExt: { type: 'text', length: 20 },
      EnvSECod: { type: 'text', length: 10 }
    }
  },
  categoriasEnvase: {
    table: 'ENVCAT1',
    gxLevel: 2,
    parentTable: 'ENVCAT',
    parentKey: ['EmpCod', 'EnvCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'EnvCod', 'Catcod'],
    columns: ['EmpCod', 'EnvCod', 'Catcod', 'CatNom', 'CatNomC', 'CatnomExt', 'CatSECod'],
    orderBy: ['EnvCod', 'Catcod'],
    filters: [{ param: 'EnvCod', column: 'EnvCod', type: 'int', required: true }],
    searchColumns: ['CatNom', 'CatNomC', 'CatnomExt'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      EnvCod: { type: 'int', required: true, min: 1 },
      Catcod: { type: 'int', required: true, min: 1 },
      CatNom: { type: 'text', length: 20, required: true },
      CatNomC: { type: 'text', length: 4, required: true },
      CatnomExt: { type: 'text', length: 20 },
      CatSECod: { type: 'text', length: 10 }
    }
  },
  comunas: {
    table: 'COMUNAS',
    columns: ['ComCod', 'Comdesc'],
    orderBy: ['Comdesc'],
    searchColumns: ['ComCod', 'Comdesc']
  },
  productores: {
    table: 'PRODUCTORES',
    gxLevel: 1,
    parentTable: 'Empresas',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    rutFields: { number: 'ProdRut', verifier: 'ProdDv' },
    primaryKey: ['EmpCod', 'ProdCod'],
    columns: ['EmpCod', 'ProdCod', 'ProdNom', 'ProdRut', 'ProdDv', 'ProdComuna', 'ProdProvincia', 'ProdPack', 'ProdPackCom', 'ProdPackProv', 'ProdCodExt', 'Prodnom2', 'ProdCodSAG', 'ProdSECod'],
    orderBy: ['ProdCod'],
    searchColumns: ['ProdCod', 'ProdNom', 'ProdRut', 'ProdCodSAG'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ProdCod: { type: 'text', length: 6, required: true },
      ProdNom: { type: 'text', length: 35, required: true },
      ProdRut: { type: 'int' },
      ProdDv: { type: 'text', length: 1 },
      ProdComuna: { type: 'text', length: 20 },
      ProdProvincia: { type: 'text', length: 20 },
      ProdPack: { type: 'text', length: 30 },
      ProdPackCom: { type: 'text', length: 20 },
      ProdPackProv: { type: 'text', length: 20 },
      ProdCodExt: { type: 'text', length: 10 },
      Prodnom2: { type: 'text', length: 20 },
      ProdCodSAG: { type: 'text', length: 10, required: true },
      ProdSECod: { type: 'text', length: 10 }
    }
  },
  cuarteles: {
    table: 'PRODUCTORES1',
    gxLevel: 2,
    parentTable: 'PRODUCTORES',
    parentKey: ['EmpCod', 'ProdCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'ProdCod', 'CuarCod'],
    columns: ['EmpCod', 'ProdCod', 'CuarCod', 'CuarNom', 'CuarnomC'],
    orderBy: ['ProdCod', 'CuarCod'],
    filters: [{ param: 'ProdCod', column: 'ProdCod', type: 'text', length: 6, required: true }],
    searchColumns: ['ProdCod', 'CuarNom', 'CuarnomC'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ProdCod: { type: 'text', length: 6, required: true },
      CuarCod: { type: 'int', required: true, min: 1 },
      CuarNom: { type: 'text', length: 35, required: true },
      CuarnomC: { type: 'text', length: 4, required: true }
    }
  },
  clientes: {
    table: 'CLIENTES',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    rutFields: { number: 'Clirut', verifier: 'CliDv' },
    primaryKey: ['EmpCod', 'CliCod'],
    columns: ['EmpCod', 'CliCod', 'Clirut', 'CliDv', 'CliNom', 'Clidirec', 'CliGiro', 'Cliciu', 'CliCom', 'CliFono', 'CliRegion'],
    orderBy: ['CliCod'],
    filters: [{ param: 'CliNom', column: 'CliNom', type: 'text', length: 40, operator: 'like' }],
    searchColumns: ['CliCod', 'Clirut', 'CliDv', 'CliNom', 'Clidirec', 'CliGiro', 'Cliciu', 'CliCom', 'CliFono', 'CliRegion'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      CliCod: { type: 'int', required: true, min: 1, max: 99999 },
      Clirut: { type: 'int', max: 999999999 },
      CliDv: { type: 'text', length: 1, uppercase: true },
      CliNom: { type: 'text', length: 40, required: true },
      Clidirec: { type: 'text', length: 40 },
      CliGiro: { type: 'text', length: 30 },
      Cliciu: { type: 'text', length: 30 },
      CliCom: { type: 'text', length: 30 },
      CliFono: { type: 'text', length: 30 },
      CliRegion: { type: 'text', length: 20 }
    },
    deleteDependencies: [
      { table: 'CAP001', fields: ['EmpCod', 'CliCod'] },
      { table: 'DESCLI_FP', fields: ['EmpCod', 'CliCod'] },
      { table: 'DESPCAJS', fields: ['EmpCod', 'CliCod'] },
      { table: 'FACTURA', fields: ['EmpCod', 'CliCod'] },
      { table: 'GUIASD', fields: ['EmpCod', 'CliCod'] },
      { table: 'GUIASD_Back', fields: ['EmpCod', 'CliCod'] },
      { table: 'LISTPRECIOS', fields: ['EmpCod', 'CliCod'] },
      { table: 'PACKLIST', fields: ['EmpCod', 'CliCod'] }
    ]
  },
  exportadoras: {
    table: 'EXPORT1',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    rutFields: { number: 'ExpRut', verifier: 'ExpDv' },
    primaryKey: ['EmpCod', 'ExpCod'],
    columns: ['EmpCod', 'ExpCod', 'ExpNom', 'ExpRut', 'ExpDv', 'EXPCodMP', 'EXPSECod'],
    orderBy: ['ExpCod'],
    searchColumns: ['ExpCod', 'ExpNom', 'ExpRut', 'ExpDv', 'EXPCodMP', 'EXPSECod'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ExpCod: { type: 'int', required: true, min: 1, max: 9999 },
      ExpNom: { type: 'text', length: 40, required: true },
      ExpRut: { type: 'int', required: true, min: 1, max: 999999999 },
      ExpDv: { type: 'text', length: 1, required: true, uppercase: true },
      EXPCodMP: { type: 'int', min: 0, max: 99999 },
      EXPSECod: { type: 'text', length: 10 }
    },
    deleteDependencies: [
      { table: 'EXPPROD', fields: ['EmpCod', 'ExpCod'] },
      { table: 'CAP001', fields: ['EmpCod', 'ExpCod'] },
      { table: 'CNTFOLIOS', fields: ['EmpCod', 'ExpCod'] },
      { table: 'DESORIGEN', fields: ['EmpCod', 'ExpCod'] },
      { table: 'FOLIOSPROC', fields: ['EmpCod', 'ExpCod'] },
      { table: 'ORDPROC', fields: ['EmpCod', 'ExpCod'] },
      { table: 'PACKLIST', fields: ['EmpCod', 'ExpCod'] },
      { table: 'PALETIZA01', fields: ['EmpCod', 'ExpCod'] }
    ]
  },
  exportadoraProductores: {
    table: 'EXPPROD',
    gxLevel: 2,
    parentTable: 'EXPORT1',
    parentKey: ['EmpCod', 'ExpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'ExpCod', 'ProdCod'],
    columns: ['EmpCod', 'ExpCod', 'ProdCod'],
    orderBy: ['ExpCod', 'ProdCod'],
    filters: [{ param: 'ExpCod', column: 'ExpCod', type: 'int', required: true }],
    searchColumns: ['ProdCod'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ExpCod: { type: 'int', required: true, min: 1, max: 9999 },
      ProdCod: { type: 'text', length: 6, required: true }
    }
  },
  consignatarios: {
    table: 'CONSIG',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    rutFields: { number: 'ConsRut', verifier: 'ConsDV' },
    primaryKey: ['EmpCod', 'ConsCod'],
    columns: ['EmpCod', 'ConsCod', 'ConsRut', 'ConsDV', 'ConsNom'],
    orderBy: ['ConsCod'],
    searchColumns: ['ConsCod', 'ConsRut', 'ConsDV', 'ConsNom'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ConsCod: { type: 'int', required: true, min: 1, max: 999 },
      ConsRut: { type: 'int', max: 999999999 },
      ConsDV: { type: 'text', length: 1, uppercase: true },
      ConsNom: { type: 'text', length: 30, required: true }
    },
    deleteDependencies: [
      { table: 'DESORIGEN', fields: ['EmpCod', 'ConsCod'] },
      { table: 'PACKLIST', fields: ['EmpCod', 'ConsCod'] }
    ]
  },
  agentes: {
    table: 'AGENTES',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    rutFields: { number: 'Agerut', verifier: 'AgeDv' },
    primaryKey: ['EmpCod', 'AgeCod'],
    columns: ['EmpCod', 'AgeCod', 'Agerut', 'AgeDv', 'AgeNom', 'AgecodMP'],
    orderBy: ['AgeCod'],
    searchColumns: ['AgeCod', 'Agerut', 'AgeDv', 'AgeNom', 'AgecodMP'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      AgeCod: { type: 'int', required: true, min: 1, max: 999 },
      Agerut: { type: 'int', required: true, min: 1, max: 999999999 },
      AgeDv: { type: 'text', length: 1, required: true, uppercase: true },
      AgeNom: { type: 'text', length: 30, required: true },
      AgecodMP: { type: 'int', max: 99999 }
    },
    deleteDependencies: [
      { table: 'DESORIGEN', fields: ['EmpCod', 'AgeCod'] },
      { table: 'PACKLIST', fields: ['EmpCod', 'AgeCod'] }
    ]
  },
  origenes: {
    table: 'ORIGEN',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'OriCod'],
    columns: ['EmpCod', 'OriCod', 'Orinom', 'OriEst'],
    orderBy: ['OriCod'],
    searchColumns: ['OriCod', 'Orinom', 'OriEst'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      OriCod: { type: 'int', required: true, min: 0, max: 99 },
      Orinom: { type: 'text', length: 35 },
      OriEst: { type: 'int', choices: [1, 2] }
    },
    deleteDependencies: [
      { table: 'MOVFRUT', fields: ['EmpCod', 'OriCod'] },
      { table: 'MOVFRUT1', fields: ['EmpCod', 'OriCod'] }
    ]
  },
  condiciones: {
    table: 'CONDICION',
    gxLevel: 1,
    primaryKey: ['ConCod'],
    columns: ['ConCod', 'ConNom', 'ConEst', 'ConNomC'],
    orderBy: ['ConCod'],
    searchColumns: ['ConCod', 'ConNom', 'ConNomC', 'ConEst'],
    fields: {
      ConCod: { type: 'int', required: true, min: 0, max: 99 },
      ConNom: { type: 'text', length: 15 },
      ConEst: { type: 'int', choices: [1, 2] },
      ConNomC: { type: 'text', length: 4 }
    }
  },
  plagasRecepcion: {
    table: 'MAPlagas',
    gxLevel: 1,
    parentTable: 'ESPECIES',
    parentKey: ['EmpCod', 'Especod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod', 'MAPlaCod'],
    columns: ['EmpCod', 'Especod', 'MAPlaCod', 'MAPlaTipo', 'MAPlaDes', 'MAPlaOrden', 'MAPlaActivo'],
    orderBy: ['Especod', 'MAPlaOrden', 'MAPlaCod'],
    filters: [{ param: 'Especod', column: 'Especod', type: 'int', required: true }],
    searchColumns: ['MAPlaTipo', 'MAPlaDes'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      MAPlaCod: { type: 'int', required: true, min: 1 },
      MAPlaTipo: { type: 'text', length: 10, required: true, choices: ['PLAGA', 'VIRUS', 'DIPTERO'] },
      MAPlaDes: { type: 'text', length: 60, required: true },
      MAPlaOrden: { type: 'int', required: true, min: 1 },
      MAPlaActivo: { type: 'int', choices: [0, 1], insertDefault: 1 }
    }
  },
  coloresRecepcion: {
    table: 'MAColores',
    gxLevel: 1,
    parentTable: 'ESPECIES',
    parentKey: ['EmpCod', 'Especod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod', 'MAColCod'],
    columns: ['EmpCod', 'Especod', 'MAColCod', 'MAColDes', 'MAColOrden', 'MAColPremium', 'MAColActivo'],
    orderBy: ['Especod', 'MAColOrden', 'MAColCod'],
    filters: [{ param: 'Especod', column: 'Especod', type: 'int', required: true }],
    searchColumns: ['MAColCod', 'MAColDes'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      MAColCod: { type: 'text', length: 2, required: true },
      MAColDes: { type: 'text', length: 40, required: true },
      MAColOrden: { type: 'int', required: true, min: 1 },
      MAColPremium: { type: 'int', choices: [0, 1], insertDefault: 1 },
      MAColActivo: { type: 'int', choices: [0, 1], insertDefault: 1 }
    }
  },
  destinos: {
    table: 'DESTINOS',
    gxLevel: 1,
    primaryKey: ['DestCod'],
    columns: ['DestCod', 'DestNom', 'DestCMP', 'DestNMP'],
    orderBy: ['DestCod'],
    searchColumns: ['DestCod', 'DestNom', 'DestCMP', 'DestNMP'],
    fields: {
      DestCod: { type: 'int', required: true, min: 1, max: 999 },
      DestNom: { type: 'text', length: 20, required: true },
      DestCMP: { type: 'int', min: 0, max: 9999 },
      DestNMP: { type: 'text', length: 30 }
    },
    deleteDependencies: [
      { table: 'DESORIGEN', fields: ['DestCod'] },
      { table: 'PACKLIST', fields: ['DestCod'] }
    ]
  },
  tiposDocumento: {
    table: 'TIPDOC',
    gxLevel: 1,
    primaryKey: ['TdCod'],
    columns: ['TdCod', 'TdNom', 'TdInter', 'TdBloq'],
    orderBy: ['TdCod'],
    searchColumns: ['TdCod', 'TdNom', 'TdInter', 'TdBloq'],
    fields: {
      TdCod: { type: 'int', required: true, min: 0, max: 99 },
      TdNom: { type: 'text', length: 20, required: true },
      TdInter: { type: 'int', choices: [0, 1], insertDefault: 0 },
      TdBloq: { type: 'int', choices: [0, 1], insertDefault: 0 }
    },
    deleteDependencies: [{ table: 'DESPCAJS', fields: ['TdCod'] }]
  },
  tiposMovimiento: {
    table: 'TIPMOV',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TMcod'],
    columns: ['EmpCod', 'TMcod', 'TMNom'],
    orderBy: ['TMcod'],
    searchColumns: ['TMcod', 'TMNom'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TMcod: { type: 'int', required: true, min: 0, max: 99 },
      TMNom: { type: 'text', length: 20 }
    },
    deleteDependencies: [
      { table: 'FCOMERCIAL', fields: ['EmpCod', 'TMcod'] },
      { table: 'MOVFRUT', fields: ['EmpCod', 'TMcod'] }
    ],
    deleteChildren: [{ table: 'TIPMOV1', fields: ['EmpCod', 'TMcod'] }]
  },
  subtiposMovimiento: {
    table: 'TIPMOV1',
    gxLevel: 2,
    parentTable: 'TIPMOV',
    parentKey: ['EmpCod', 'TMcod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TMcod', 'TMSCod'],
    columns: ['EmpCod', 'TMcod', 'TMSCod', 'TMSNom'],
    orderBy: ['TMcod', 'TMSCod'],
    filters: [{ param: 'TMcod', column: 'TMcod', type: 'int', required: true }],
    searchColumns: ['TMSCod', 'TMSNom'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TMcod: { type: 'int', required: true, min: 0, max: 99 },
      TMSCod: { type: 'int', required: true, min: 0, max: 99 },
      TMSNom: { type: 'text', length: 20 }
    },
    deleteDependencies: [
      { table: 'FCOMERCIAL', fields: ['EmpCod', 'TMcod', 'TMSCod'] },
      { table: 'MOVFRUT', fields: ['EmpCod', 'TMcod', 'TMSCod'] }
    ]
  },
  parametrosGenerales: {
    table: 'PARAMGEN',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    columnMap: { EmpCod: 'empcod', PARCod: 'parcod' },
    primaryKey: ['EmpCod', 'PARCod'],
    columns: ['EmpCod', 'PARCod', 'PARDes', 'PARValor1', 'PARValor2', 'PARValor3'],
    orderBy: ['PARCod'],
    searchColumns: ['PARCod', 'PARDes', 'PARValor1', 'PARValor2', 'PARValor3'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      PARCod: { type: 'int', required: true, min: 0, max: 9999 },
      PARDes: { type: 'text', length: 30 },
      PARValor1: { type: 'decimal', precision: 13, scale: 3 },
      PARValor2: { type: 'decimal', precision: 13, scale: 3 },
      PARValor3: { type: 'decimal', precision: 13, scale: 3 }
    },
    deleteChildren: [{ table: 'PARAMGE1', fields: ['EmpCod', 'PARCod'], columnMap: { EmpCod: 'empcod', PARCod: 'parcod' } }]
  },
  parametrosDetalle: {
    table: 'PARAMGE1',
    gxLevel: 2,
    parentTable: 'PARAMGEN',
    parentKey: ['EmpCod', 'PARCod'],
    requiresEmpCod: true,
    columnMap: { EmpCod: 'empcod', PARCod: 'parcod' },
    primaryKey: ['EmpCod', 'PARCod', 'PAR1Cod'],
    columns: ['EmpCod', 'PARCod', 'PAR1Cod', 'PAR1Des', 'PAR1Valor1', 'PAR1Valor2', 'PAR1Valor3', 'Par1Texto'],
    orderBy: ['PARCod', 'PAR1Cod'],
    filters: [{ param: 'PARCod', column: 'PARCod', type: 'int', required: true }],
    searchColumns: ['PAR1Cod', 'PAR1Des', 'PAR1Valor1', 'PAR1Valor2', 'PAR1Valor3', 'Par1Texto'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      PARCod: { type: 'int', required: true, min: 0, max: 9999 },
      PAR1Cod: { type: 'int', required: true, min: 0, max: 999 },
      PAR1Des: { type: 'text', length: 30 },
      PAR1Valor1: { type: 'decimal', precision: 13, scale: 3 },
      PAR1Valor2: { type: 'decimal', precision: 13, scale: 3 },
      PAR1Valor3: { type: 'decimal', precision: 13, scale: 3 },
      Par1Texto: { type: 'text', length: 40 }
    }
  },
  monedas: {
    table: 'MONEDAS',
    gxLevel: 1,
    primaryKey: ['MonCod'],
    columns: ['MonCod', 'MonDes', 'MonLogC'],
    orderBy: ['MonCod'],
    searchColumns: ['MonCod', 'MonDes', 'MonLogC'],
    fields: {
      MonCod: { type: 'int', required: true, min: 0, max: 99 },
      MonDes: { type: 'text', length: 20, required: true },
      MonLogC: { type: 'text', length: 10, serverValueOnInsert: 'contextLogin', serverManaged: true }
    },
    deleteDependencies: [
      { table: 'VALMEXT', fields: ['MonCod'] },
      { table: 'LISTPRECIOS', fields: ['MonCod'] }
    ]
  },
  valoresMoneda: {
    table: 'VALMEXT',
    gxLevel: 2,
    parentTable: 'MONEDAS',
    parentKey: ['MonCod'],
    primaryKey: ['MonCod', 'VMEFec'],
    columns: ['MonCod', 'VMEFec', 'VMEVal'],
    orderBy: ['MonCod', 'VMEFec'],
    filters: [
      { param: 'MonCod', column: 'MonCod', type: 'int', required: true },
      { param: 'FecD', column: 'VMEFec', type: 'date', operator: 'gte' },
      { param: 'FecH', column: 'VMEFec', type: 'date', operator: 'lte' }
    ],
    searchColumns: ['VMEFec', 'VMEVal'],
    fields: {
      MonCod: { type: 'int', required: true, min: 0, max: 99 },
      VMEFec: { type: 'date', required: true },
      VMEVal: { type: 'decimal', precision: 8, scale: 2, required: true, exclusiveMin: 0 }
    }
  },
  puertos: {
    table: 'PUERTOS',
    gxLevel: 1,
    primaryKey: ['PuCod'],
    columns: ['PuCod', 'PuNombre', 'PuNac', 'PuCodHomo'],
    orderBy: ['PuNombre', 'PuCod'],
    filters: [
      { param: 'PuNac', column: 'PuNac', type: 'int' },
      { param: 'PuNombre', column: 'PuNombre', type: 'text', length: 25, operator: 'like' }
    ],
    searchColumns: ['PuCod', 'PuNombre', 'PuNac', 'PuCodHomo'],
    fields: {
      PuCod: { type: 'int', required: true, min: 0, max: 999 },
      PuNombre: { type: 'text', length: 25, required: true },
      PuNac: { type: 'int', choices: [0, 1], insertDefault: 0 },
      PuCodHomo: { type: 'int', min: 0, max: 999 }
    }
  },
  causalesAnulacion: {
    table: 'CAUSAANUL',
    gxLevel: 1,
    primaryKey: ['CAnCod'],
    columns: ['CAnCod', 'CanNom', 'CanPE', 'CanLoginC', 'CanFecC'],
    orderBy: ['CAnCod'],
    searchColumns: ['CAnCod', 'CanNom', 'CanPE', 'CanLoginC', 'CanFecC'],
    fields: {
      CAnCod: { type: 'int', required: true, min: 0, max: 99 },
      CanNom: { type: 'text', length: 20 },
      CanPE: { type: 'int', choices: [0, 1], insertDefault: 0 },
      CanLoginC: { type: 'text', length: 10, serverValueOnInsert: 'contextLogin', serverManaged: true },
      CanFecC: { type: 'date', serverValueOnInsert: 'serverDate', serverManaged: true }
    },
    deleteDependencies: [{ table: 'ANUINS', fields: ['CAnCod'] }]
  },
  despachadoresAutorizados: {
    table: 'DESPAAUTO',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'DACod'],
    columns: ['EmpCod', 'DACod', 'DANombre', 'DAVig'],
    orderBy: ['DACod'],
    searchColumns: ['DACod', 'DANombre', 'DAVig'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      DACod: { type: 'int', required: true, min: 0, max: 99 },
      DANombre: { type: 'text', length: 30, required: true },
      DAVig: { type: 'int', choices: [0, 1], insertDefault: 1 }
    },
    deleteDependencies: [
      { table: 'DESORIGEN', fields: ['EmpCod', 'DACod'] },
      { table: 'PACKLIST', fields: ['EmpCod', 'DACod'] },
      { table: 'REPALETIZAJE', fields: ['EmpCod', 'DACod'] }
    ]
  },
  procedencias: {
    table: 'PROCEDENCIA',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'ProcCod'],
    columns: ['EmpCod', 'ProcCod', 'ProcNom', 'ProcEst'],
    orderBy: ['ProcCod'],
    searchColumns: ['ProcCod', 'ProcNom', 'ProcEst'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ProcCod: { type: 'int', required: true, min: 0, max: 99 },
      ProcNom: { type: 'text', length: 35 },
      ProcEst: { type: 'int', choices: [1, 2], insertDefault: 1 }
    }
  },
  secciones: {
    table: 'SECCIONES',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Seccod'],
    columns: ['EmpCod', 'Seccod', 'SecNom'],
    orderBy: ['Seccod'],
    searchColumns: ['Seccod', 'SecNom'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Seccod: { type: 'int', required: true, min: 0, max: 99 },
      SecNom: { type: 'text', length: 20, required: true }
    }
  },
  tiposEtiqueta: {
    table: 'TIPETI',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TEtCod'],
    columns: ['EmpCod', 'TEtCod', 'TEtDesc'],
    orderBy: ['TEtCod'],
    searchColumns: ['TEtCod', 'TEtDesc'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TEtCod: { type: 'int', required: true, min: 1, max: 999 },
      TEtDesc: { type: 'text', length: 20, required: true }
    },
    deleteDependencies: [
      { table: 'FOLIOSPROC', fields: ['EmpCod', 'TEtCod'] },
      { table: 'PROCUSDA1', fields: ['EmpCod', 'TEtCod'] }
    ]
  },
  configuracionesEtiqueta: {
    table: 'CONFIGETI',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'ConfCod', 'ConfLinea'],
    columns: ['EmpCod', 'ConfCod', 'ConfLinea', 'ConfText1a', 'ConfText1b', 'ConfLin1', 'ConfLogCrea', 'ConfFecC', 'ConfLin1b', 'ConfDato1a', 'ConfDato1b', 'ConfTipFecha', 'ConfSepFec', 'ConfTipEti'],
    orderBy: ['ConfCod', 'ConfLinea'],
    searchColumns: ['ConfCod', 'ConfText1a', 'ConfText1b', 'ConfTipEti'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ConfCod: { type: 'text', length: 10, required: true },
      ConfLinea: { type: 'int', required: true, min: 1 },
      ConfText1a: { type: 'text', length: 35 },
      ConfText1b: { type: 'text', length: 35 },
      ConfLin1: { type: 'text', length: 3 },
      ConfLogCrea: { type: 'text', length: 10, serverValueOnInsert: 'contextLogin', serverManaged: true },
      ConfFecC: { type: 'date', serverValueOnInsert: 'serverDate', serverManaged: true },
      ConfLin1b: { type: 'text', length: 3 },
      ConfDato1a: { type: 'int' },
      ConfDato1b: { type: 'int' },
      ConfTipFecha: { type: 'int' },
      ConfSepFec: { type: 'text', length: 1 },
      ConfTipEti: { type: 'text', length: 20 }
    }
  },
  ordenesProcesoAdm: {
    table: 'ORDPROC',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TempCod', 'Ordpnum'],
    columns: ['EmpCod', 'TempCod', 'Ordpnum', 'OrdpFecha', 'Especod', 'VarCod', 'OrdpTotEnv', 'OrdpTotKilos', 'OrdpEnvExp', 'OrdpKilosExp', 'OrdpEnvCom', 'OrdpKilosCom', 'OrdpDesecho', 'OrdpFecA', 'OrdpLoginA', 'OrdpEstado', 'OrdpFecC', 'OrdploginC', 'ProdCod', 'ExpCod', 'OrdpCodEti', 'OrdpTipEnv', 'OrdpHHFinP', 'OrdpHHIniP', 'OrdpETIxCal'],
    orderBy: ['TempCod', 'Ordpnum'],
    searchColumns: ['TempCod', 'Ordpnum', 'ProdCod', 'OrdpCodEti'],
    filters: [
      { param: 'TempCod', column: 'TempCod', type: 'text', length: 9 },
      { param: 'Especod', column: 'Especod', type: 'int' },
      { param: 'VarCod', column: 'VarCod', type: 'int' },
      { param: 'OrdpEstado', column: 'OrdpEstado', type: 'int' }
    ],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TempCod: { type: 'text', length: 9, required: true },
      Ordpnum: { type: 'int', required: true, min: 1 },
      OrdpFecha: { type: 'date' },
      Especod: { type: 'int', min: 1 },
      VarCod: { type: 'int', min: 1 },
      OrdpTotEnv: { type: 'int', min: 0 },
      OrdpTotKilos: { type: 'decimal', precision: 19, scale: 4, min: 0 },
      OrdpEnvExp: { type: 'int', min: 0 },
      OrdpKilosExp: { type: 'decimal', precision: 19, scale: 4, min: 0 },
      OrdpEnvCom: { type: 'int', min: 0 },
      OrdpKilosCom: { type: 'decimal', precision: 19, scale: 4, min: 0 },
      OrdpDesecho: { type: 'decimal', precision: 19, scale: 4, min: 0 },
      OrdpFecA: { type: 'date' },
      OrdpLoginA: { type: 'text', length: 10 },
      OrdpEstado: { type: 'int', choices: [0, 1, 4, 5, 8], insertDefault: 0 },
      OrdpFecC: { type: 'date' },
      OrdploginC: { type: 'text', length: 10 },
      ProdCod: { type: 'text', length: 6 },
      ExpCod: { type: 'int', min: 1 },
      OrdpCodEti: { type: 'text', length: 10 },
      OrdpTipEnv: { type: 'int', min: 1 },
      OrdpHHFinP: { type: 'date' },
      OrdpHHIniP: { type: 'date' },
      OrdpETIxCal: { type: 'int' }
    },
    deleteDependencies: [{ table: 'ORDPROC1', fields: ['EmpCod', 'TempCod', 'Ordpnum'] }]
  },
  tiposBasePallet: {
    table: 'TIPBPA',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TBPCod'],
    columns: ['EmpCod', 'TBPCod', 'TBPDesc', 'TBPBase', 'TBPDiv'],
    orderBy: ['TBPCod'],
    searchColumns: ['TBPCod', 'TBPDesc', 'TBPBase', 'TBPDiv'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TBPCod: { type: 'int', required: true, min: 1, max: 999 },
      TBPDesc: { type: 'text', length: 20, required: true },
      TBPBase: { type: 'int', min: 0, max: 99 },
      TBPDiv: { type: 'int', min: 0, max: 99 }
    },
    deleteDependencies: [
      { table: 'FOLDIAGRAMA1', fields: ['EmpCod', 'TBPCod'] },
      { table: 'FOLIOSPROC', fields: ['EmpCod', 'TBPCod'] },
      { table: 'PROCUSDA1', fields: ['EmpCod', 'TBPCod'] }
    ]
  },
  tiposAltura: {
    table: 'TIPALT',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TAlCod'],
    columns: ['EmpCod', 'TAlCod', 'TAlDesc'],
    orderBy: ['TAlCod'],
    searchColumns: ['TAlCod', 'TAlDesc'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TAlCod: { type: 'int', required: true, min: 1, max: 999 },
      TAlDesc: { type: 'text', length: 20, required: true }
    },
    deleteDependencies: [
      { table: 'FOLIOSPROC', fields: ['EmpCod', 'TAlCod'] },
      { table: 'PROCUSDA1', fields: ['EmpCod', 'TAlCod'] }
    ]
  }
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const findParam = (source, name) => {
  if (!source) return { found: false, value: undefined };
  if (hasOwn(source, name)) return { found: true, value: source[name] };

  const lowerName = name.toLowerCase();
  const matchingKey = Object.keys(source).find((key) => key.toLowerCase() === lowerName);
  if (!matchingKey) return { found: false, value: undefined };

  return { found: true, value: source[matchingKey] };
};

const quoteName = (name) => `[${name}]`;

const getDbColumn = (config, fieldName) => config.columnMap?.[fieldName] || fieldName;

const getSelectColumn = (config, fieldName) => {
  const dbColumn = getDbColumn(config, fieldName);
  return dbColumn === fieldName ? quoteName(fieldName) : `${quoteName(dbColumn)} AS ${quoteName(fieldName)}`;
};

const getParam = (req, name) => {
  const queryParam = findParam(req.query, name);
  if (queryParam.found) return queryParam.value;

  const bodyParam = findParam(req.body, name);
  if (bodyParam.found) return bodyParam.value;

  return undefined;
};

const getContextEmpCod = (req) => {
  const empCod = Number(req.context?.empCod);
  if (!Number.isInteger(empCod) || empCod <= 0) {
    throw httpError(500, 'Contexto de empresa no configurado');
  }

  return empCod;
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getIntParam = (req, name, required = true) => {
  const value = getParam(req, name);

  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw httpError(400, `Parametro requerido: ${name}`);
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw httpError(400, `Parametro invalido: ${name} debe ser entero`);
  }

  return numberValue;
};

const getTextParam = (req, name) => {
  const value = getParam(req, name);
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
};

const getLimit = (req) => {
  const rawLimit = getParam(req, 'limit');
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') return DEFAULT_LIMIT;

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw httpError(400, 'Parametro invalido: limit debe ser entero positivo');
  }

  return Math.min(limit, MAX_LIMIT);
};

const bindFilter = (request, filter, value) => {
  if (filter.type === 'int') {
    const intValue = Number(value);
    if (!Number.isInteger(intValue)) {
      throw httpError(400, `Parametro invalido: ${filter.param} debe ser entero`);
    }
    request.input(filter.param, sql.Int, intValue);
    return;
  }

  if (filter.type === 'date') {
    const dateValue = parseDateValue(value);
    if (!dateValue || Number.isNaN(dateValue.getTime())) {
      throw httpError(400, `Parametro invalido: ${filter.param} debe ser fecha valida`);
    }
    request.input(filter.param, sql.Date, dateValue);
    return;
  }

  const textValue = String(value).trim();
  const boundValue = filter.operator === 'like' ? `%${textValue}%` : textValue;
  request.input(filter.param, sql.VarChar((filter.length || 50) + (filter.operator === 'like' ? 2 : 0)), boundValue);
};

const buildSearchClause = (request, config, q) => {
  if (!q || !config.searchColumns || config.searchColumns.length === 0) return null;

  request.input('q', sql.NVarChar(120), `%${q}%`);
  return `(${config.searchColumns.map((column) => `CAST(${quoteName(getDbColumn(config, column))} AS NVARCHAR(120)) LIKE @q`).join(' OR ')})`;
};

const listCatalog = (catalogName) => async (req, res) => {
  const config = catalogos[catalogName];

  try {
    const pool = await getPool();
    if (catalogName === 'ordenesProcesoAdm') {
      const request = pool.request().input('EmpCod', sql.SmallInt, getContextEmpCod(req)).input('TempCod', sql.Char(9), getParam(req, 'TempCod') || null).input('Limit', sql.Int, getLimit(req));
      const result = await request.query(`SELECT TOP (@Limit) o.*, RTRIM(p.ProdNom) ProdNom, RTRIM(x.ExpNom) ExpNom,
        STUFF((SELECT ', ' + CAST(d.Ordp1Nlote AS varchar(20)) + ' (' + CAST(d.Ordp1Env AS varchar(20)) + ' env, ' + CAST(d.Ordp1Kilos AS varchar(30)) + ' kg)' FROM ORDPROC1 d WHERE d.EmpCod=o.EmpCod AND d.TempCod=o.TempCod AND d.Ordpnum=o.Ordpnum ORDER BY d.Ordp1Nlote FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') lotesUsados,
        STUFF((SELECT ', ' + CAST(d.Ordp1Nlote AS varchar(20)) + ' - ' + COALESCE(CAST(q.CalRecPorCalidad AS varchar(20)),'-') + '%' FROM ORDPROC1 d OUTER APPLY (SELECT TOP 1 c.CalRecPorCalidad FROM CALRECEP c WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.Mov1Nlote=d.Ordp1Nlote AND c.CalRecEstado='F' ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC) q WHERE d.EmpCod=o.EmpCod AND d.TempCod=o.TempCod AND d.Ordpnum=o.Ordpnum ORDER BY d.Ordp1Nlote FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') calidadLotes
        FROM ORDPROC o
        LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod AND p.ProdCod=o.ProdCod
        LEFT JOIN EXPORT1 x ON x.EmpCod=o.EmpCod AND x.ExpCod=o.ExpCod
        WHERE o.EmpCod=@EmpCod AND (@TempCod IS NULL OR o.TempCod=@TempCod) ORDER BY o.OrdpFecha DESC,o.Ordpnum DESC`);
      return res.json({ success: true, catalog: catalogName, count: result.recordset.length, data: result.recordset });
    }
    const request = pool.request();
    const where = [];
    const limit = getLimit(req);

    request.input('limit', sql.Int, limit);

    if (config.requiresEmpCod) {
      request.input('empCod', sql.Int, getContextEmpCod(req));
      where.push(`${quoteName(getDbColumn(config, 'EmpCod'))} = @empCod`);
    }

    for (const filter of config.filters || []) {
      const value = getParam(req, filter.param);
      const hasValue = value !== undefined && value !== null && value !== '';

      if (!hasValue && filter.required) {
        throw httpError(400, `Parametro requerido: ${filter.param}`);
      }

      if (!hasValue) continue;

      bindFilter(request, filter, value);
      const operator = {
        like: 'LIKE',
        gte: '>=',
        lte: '<=',
        gt: '>',
        lt: '<'
      }[filter.operator] || '=';
      where.push(`${quoteName(getDbColumn(config, filter.column))} ${operator} @${filter.param}`);
    }

    const q = getTextParam(req, 'q');
    const searchClause = buildSearchClause(request, config, q);
    if (searchClause) where.push(searchClause);

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT TOP (@limit)
        ${config.columns.map((column) => getSelectColumn(config, column)).join(',\n        ')}
      FROM ${quoteName(config.table)}
      ${whereSql}
      ORDER BY ${config.orderBy.map((column) => quoteName(getDbColumn(config, column))).join(', ')}
    `;

    const result = await request.query(query);

    return res.json({
      success: true,
      catalog: catalogName,
      count: result.recordset.length,
      data: result.recordset
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      catalog: catalogName,
      message: status === 500 ? 'Error consultando maestro' : error.message,
      error: error.message
    });
  }
};

const listExportadoraProductores = async (req, res) => {
  const catalogName = 'exportadoraProductores';

  try {
    const pool = await getPool();
    const request = pool.request();
    const empCod = getContextEmpCod(req);
    const expCod = getIntParam(req, 'ExpCod');
    const limit = getLimit(req);
    const q = getTextParam(req, 'q');

    request.input('empCod', sql.Int, empCod);
    request.input('expCod', sql.Int, expCod);
    request.input('limit', sql.Int, limit);

    const where = ['ep.[EmpCod] = @empCod', 'ep.[ExpCod] = @expCod'];
    if (q) {
      request.input('q', sql.NVarChar(120), `%${q}%`);
      where.push('(CAST(ep.[ProdCod] AS NVARCHAR(120)) LIKE @q OR CAST(p.[ProdNom] AS NVARCHAR(120)) LIKE @q)');
    }

    const result = await request.query(`
      SELECT TOP (@limit)
        ep.[EmpCod], ep.[ExpCod], ep.[ProdCod], p.[ProdNom], p.[ProdComuna]
      FROM [EXPPROD] ep
      LEFT JOIN [PRODUCTORES] p
        ON p.[EmpCod] = ep.[EmpCod]
       AND p.[ProdCod] = ep.[ProdCod]
      WHERE ${where.join(' AND ')}
      ORDER BY ep.[ProdCod]
    `);

    return res.json({
      success: true,
      catalog: catalogName,
      count: result.recordset.length,
      data: result.recordset
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      catalog: catalogName,
      message: status === 500 ? 'Error consultando productores de exportadora' : error.message,
      error: error.message
    });
  }
};

const hasWriteParam = (req, name) => {
  if (findParam(req.body, name).found) return true;
  if (findParam(req.query, name).found) return true;
  return false;
};

const getWriteParam = (req, name) => {
  const bodyParam = findParam(req.body, name);
  if (bodyParam.found) return bodyParam.value;

  const queryParam = findParam(req.query, name);
  if (queryParam.found) return queryParam.value;

  return undefined;
};

const hasCatalogWriteParam = (req, config, name) => (
  (name === 'EmpCod' && config.requiresEmpCod) || hasWriteParam(req, name)
);

const getCatalogWriteParam = (req, config, name) => {
  if (name === 'EmpCod' && config.requiresEmpCod) return getContextEmpCod(req);
  return getWriteParam(req, name);
};

const getSqlType = (field) => {
  if (field.type === 'int') return sql.Int;
  if (field.type === 'date') return sql.Date;
  if (field.type === 'decimal') return sql.Decimal(field.precision || 18, field.scale ?? 4);
  return sql.VarChar(field.length || 255);
};

const buildDate = (year, month, day) => {
  const dateValue = new Date(Date.UTC(year, month - 1, day));
  if (
    dateValue.getUTCFullYear() !== year ||
    dateValue.getUTCMonth() !== month - 1 ||
    dateValue.getUTCDate() !== day
  ) {
    return null;
  }
  return dateValue;
};

const parseDateValue = (value) => {
  if (value instanceof Date) return value;

  const textValue = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(textValue);
  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const compactMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(textValue);
  if (compactMatch) {
    return buildDate(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]));
  }

  return new Date(textValue);
};

const validateChoice = (fieldName, field, value) => {
  if (!field.choices || value === null) return;

  const isAllowed = field.choices.some((choice) => String(choice) === String(value));
  if (!isAllowed) {
    throw httpError(400, `Campo invalido: ${fieldName} valor no permitido`);
  }
};

const validateRange = (fieldName, field, value) => {
  if (value === null) return;

  if (field.min !== undefined && value < field.min) {
    throw httpError(400, `Campo invalido: ${fieldName} debe ser mayor o igual a ${field.min}`);
  }

  if (field.exclusiveMin !== undefined && value <= field.exclusiveMin) {
    throw httpError(400, `Campo invalido: ${fieldName} debe ser mayor a ${field.exclusiveMin}`);
  }

  if (field.max !== undefined && value > field.max) {
    throw httpError(400, `Campo invalido: ${fieldName} debe ser menor o igual a ${field.max}`);
  }
};

const normalizeValue = (fieldName, field, value, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `Campo requerido: ${fieldName}`);
    return null;
  }

  if (field.type === 'int') {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue)) {
      throw httpError(400, `Campo invalido: ${fieldName} debe ser entero`);
    }
    validateChoice(fieldName, field, numberValue);
    validateRange(fieldName, field, numberValue);
    return numberValue;
  }

  if (field.type === 'date') {
    const dateValue = parseDateValue(value);
    if (!dateValue || Number.isNaN(dateValue.getTime())) {
      throw httpError(400, `Campo invalido: ${fieldName} debe ser fecha valida`);
    }
    return dateValue;
  }

  if (field.type === 'decimal') {
    const numberValue = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(numberValue)) {
      throw httpError(400, `Campo invalido: ${fieldName} debe ser numerico`);
    }
    validateChoice(fieldName, field, numberValue);
    validateRange(fieldName, field, numberValue);
    return numberValue;
  }

  const textValue = String(value).trim();
  if (textValue === '') {
    if (required) throw httpError(400, `Campo requerido: ${fieldName}`);
    return null;
  }
  if (field.length && textValue.length > field.length) {
    throw httpError(400, `Campo invalido: ${fieldName} maximo ${field.length} caracteres`);
  }
  const normalizedText = field.uppercase ? textValue.toUpperCase() : textValue;
  validateChoice(fieldName, field, normalizedText);

  return normalizedText;
};

const bindField = (request, paramName, fieldName, field, value, required = false) => {
  const normalizedValue = normalizeValue(fieldName, field, value, required);
  request.input(paramName, getSqlType(field), normalizedValue);
  return normalizedValue;
};

const getWritableCatalog = (catalogName) => {
  const config = catalogos[catalogName];
  if (!config || !config.fields || !config.primaryKey) {
    throw httpError(500, `Catalogo no configurado para escritura: ${catalogName}`);
  }
  return config;
};

const getKeyPayload = (req, config) => config.primaryKey.reduce((payload, column) => {
  payload[column] = getCatalogWriteParam(req, config, column);
  return payload;
}, {});

const getInsertValue = (req, config, column, field) => {
  if (field.serverValueOnInsert === 'serverDate') return new Date();
  if (field.serverValueOnInsert === 'contextLogin') return req.context?.login || 'MIGRACION';

  const suppliedValue = getCatalogWriteParam(req, config, column);
  if (suppliedValue !== undefined && suppliedValue !== null && suppliedValue !== '') return suppliedValue;

  return field.insertDefault !== undefined ? field.insertDefault : suppliedValue;
};

const getConfiguredDefault = (definition) => {
  if (definition.serverValue === 'serverDate') return new Date();
  return definition.value;
};

const calculateRutVerifier = (rut) => {
  let value = Number(rut);
  let factor = 2;
  let sum = 0;

  while (value > 0) {
    sum += (value % 10) * factor;
    value = Math.floor(value / 10);
    factor = factor === 7 ? 2 : factor + 1;
  }

  const result = 11 - (sum % 11);
  if (result === 11) return '0';
  if (result === 10) return 'K';
  return String(result);
};

const validateRut = (config, values) => {
  if (!config.rutFields) return;

  const numberField = config.rutFields.number;
  const verifierField = config.rutFields.verifier;
  const rut = values[numberField];
  const verifier = values[verifierField];
  const touchesRut = rut !== undefined || verifier !== undefined;

  if (!touchesRut || (rut === null && verifier === null)) return;
  if (rut === undefined || rut === null || verifier === undefined || verifier === null) {
    throw httpError(400, 'Debe informar RUT y digito verificador');
  }

  if (calculateRutVerifier(rut) !== String(verifier).trim().toUpperCase()) {
    throw httpError(400, 'RUT incorrecto');
  }
};

const sendWriteError = (res, catalogName, error, defaultMessage) => {
  let status = error.status || 500;
  let message = status === 500 ? defaultMessage : error.message;

  if (error.number === 2601 || error.number === 2627) {
    status = 409;
    message = 'Registro duplicado';
  }

  if (error.number === 547) {
    status = 409;
    message = 'Registro relacionado o llave foranea invalida';
  }

  return res.status(status).json({
    success: false,
    catalog: catalogName,
    message,
    error: error.message
  });
};

const insertCatalog = (catalogName) => async (req, res) => {
  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    const request = pool.request();
    const columns = Object.keys(config.fields).filter((column) => !config.fields[column].serverGenerated);
    const normalizedValues = {};

    for (const column of columns) {
      const field = config.fields[column];
      const isRequired = config.primaryKey.includes(column) || field.required === true;
      normalizedValues[column] = bindField(request, column, column, field, getInsertValue(req, config, column, field), isRequired);
    }

    validateRut(config, normalizedValues);

    const extraColumns = Object.entries(config.insertDefaults || {});
    for (const [column, definition] of extraColumns) {
      bindField(request, `default_${column}`, column, definition, getConfiguredDefault(definition), true);
    }

    const query = `
      INSERT INTO ${quoteName(config.table)}
        (${[
          ...columns.map((column) => quoteName(getDbColumn(config, column))),
          ...extraColumns.map(([column]) => quoteName(column))
        ].join(', ')})
      VALUES
        (${[
          ...columns.map((column) => `@${column}`),
          ...extraColumns.map(([column]) => `@default_${column}`)
        ].join(', ')})
    `;

    await request.query(query);

    return res.status(201).json({
      success: true,
      catalog: catalogName,
      message: 'Registro creado',
      key: getKeyPayload(req, config)
    });
  } catch (error) {
    return sendWriteError(res, catalogName, error, 'Error insertando maestro');
  }
};

const updateCatalog = (catalogName) => async (req, res) => {
  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    const request = pool.request();
    const normalizedValues = {};

    const mutablePrimaryKey = config.mutablePrimaryKey || {};

    for (const column of config.primaryKey) {
      const originalParam = mutablePrimaryKey[column];
      const originalValue = originalParam ? getWriteParam(req, originalParam) : undefined;
      const keyValue = originalValue === undefined ? getCatalogWriteParam(req, config, column) : originalValue;
      bindField(request, `key_${column}`, column, config.fields[column], keyValue, true);
    }

    const updateColumns = Object.keys(config.fields).filter((column) => (
      (!config.primaryKey.includes(column) || Boolean(mutablePrimaryKey[column])) &&
      !config.fields[column].serverGenerated &&
      !config.fields[column].serverManaged &&
      hasCatalogWriteParam(req, config, column)
    ));

    if (updateColumns.length === 0) {
      throw httpError(400, 'Debe informar al menos un campo para actualizar');
    }

    for (const column of updateColumns) {
      normalizedValues[column] = bindField(
        request,
        column,
        column,
        config.fields[column],
        getCatalogWriteParam(req, config, column),
        config.fields[column].required === true
      );
    }

    validateRut(config, normalizedValues);

    const query = `
      UPDATE ${quoteName(config.table)}
      SET ${updateColumns.map((column) => `${quoteName(getDbColumn(config, column))} = @${column}`).join(', ')}
      WHERE ${config.primaryKey.map((column) => `${quoteName(getDbColumn(config, column))} = @key_${column}`).join(' AND ')}
    `;

    const result = await request.query(query);

    return res.json({
      success: true,
      catalog: catalogName,
      message: 'Registro actualizado',
      rowsAffected: result.rowsAffected[0] || 0,
      key: getKeyPayload(req, config)
    });
  } catch (error) {
    return sendWriteError(res, catalogName, error, 'Error actualizando maestro');
  }
};

const assertDeleteDependencies = async (transaction, req, config) => {
  for (const dependency of config.deleteDependencies || []) {
    const request = new sql.Request(transaction);
    const where = [];

    for (const fieldName of dependency.fields) {
      const field = config.fields[fieldName];
      const paramName = `dependency_${fieldName}`;
      bindField(request, paramName, fieldName, field, getCatalogWriteParam(req, config, fieldName), true);
      where.push(`${quoteName(fieldName)} = @${paramName}`);
    }

    // La base GX8 no declara estas relaciones como FK; se conservan antes de eliminar.
    const result = await request.query(`
      SELECT TOP (1) 1 AS [Exists]
      FROM ${quoteName(dependency.table)}
      WHERE ${where.join(' AND ')}
    `);

    if (result.recordset.length > 0) {
      throw httpError(409, `No se puede eliminar: el registro esta utilizado en ${dependency.table}`);
    }
  }
};

const deleteCatalog = (catalogName) => async (req, res) => {
  let transaction;
  let transactionStarted = false;

  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    transactionStarted = true;

    await assertDeleteDependencies(transaction, req, config);

    for (const child of config.deleteChildren || []) {
      const childRequest = new sql.Request(transaction);
      const childWhere = [];

      for (const fieldName of child.fields) {
        const field = config.fields[fieldName];
        const paramName = `child_${fieldName}`;
        bindField(childRequest, paramName, fieldName, field, getCatalogWriteParam(req, config, fieldName), true);
        const childColumn = child.columnMap?.[fieldName] || fieldName;
        childWhere.push(`${quoteName(childColumn)} = @${paramName}`);
      }

      // Los niveles 2 de una Transaction GX se eliminan junto con su cabecera.
      await childRequest.query(`
        DELETE FROM ${quoteName(child.table)}
        WHERE ${childWhere.join(' AND ')}
      `);
    }

    const request = new sql.Request(transaction);

    for (const column of config.primaryKey) {
      bindField(request, `key_${column}`, column, config.fields[column], getCatalogWriteParam(req, config, column), true);
    }

    const query = `
      DELETE FROM ${quoteName(config.table)}
      WHERE ${config.primaryKey.map((column) => `${quoteName(getDbColumn(config, column))} = @key_${column}`).join(' AND ')}
    `;

    const result = await request.query(query);
    await transaction.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      catalog: catalogName,
      message: 'Registro eliminado',
      rowsAffected: result.rowsAffected[0] || 0,
      key: getKeyPayload(req, config)
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(`Error revirtiendo eliminacion de ${catalogName}`, rollbackError);
      }
    }
    return sendWriteError(res, catalogName, error, 'Error eliminando maestro');
  }
};

const insertCalibre = async (req, res) => {
  const catalogName = 'calibres';
  let transaction;
  let transactionStarted = false;

  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    const calCod = await nextCorrelative({
      transaction,
      empCod: getContextEmpCod(req),
      code: 'CAL',
      digits: 5
    });
    if (calCod > 999) {
      throw httpError(409, 'Correlativo CalCod excede el largo Numeric(3) definido en GX8');
    }

    const request = new sql.Request(transaction);
    const columns = Object.keys(config.fields);

    for (const column of columns) {
      const field = config.fields[column];
      const rawValue = column === 'CalCod' ? calCod : getInsertValue(req, config, column, field);
      bindField(request, column, column, field, rawValue, true);
    }

    await request.query(`
      INSERT INTO [${config.table}]
        (${columns.map(quoteName).join(', ')})
      VALUES
        (${columns.map((column) => `@${column}`).join(', ')})
    `);

    await transaction.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      catalog: catalogName,
      message: 'Registro creado',
      key: getKeyPayload(req, config),
      CalCod: calCod
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error revirtiendo insercion de calibre', rollbackError);
      }
    }

    return sendWriteError(res, catalogName, error, 'Error insertando maestro');
  }
};

const getCatalogos = (req, res) => {
  res.json({
    success: true,
    catalogs: Object.keys(catalogos)
  });
};

module.exports = {
  getCatalogos,
  listEmpresas: listCatalog('empresas'),
  insertEmpresa: insertCatalog('empresas'),
  updateEmpresa: updateCatalog('empresas'),
  deleteEmpresa: deleteCatalog('empresas'),
  listTemporadas: listCatalog('temporadas'),
  insertTemporada: insertCatalog('temporadas'),
  updateTemporada: updateCatalog('temporadas'),
  deleteTemporada: deleteCatalog('temporadas'),
  listEspecies: listCatalog('especies'),
  insertEspecie: insertCatalog('especies'),
  updateEspecie: updateCatalog('especies'),
  deleteEspecie: deleteCatalog('especies'),
  listVariedades: listCatalog('variedades'),
  insertVariedad: insertCatalog('variedades'),
  updateVariedad: updateCatalog('variedades'),
  deleteVariedad: deleteCatalog('variedades'),
  listCalibres: listCatalog('calibres'),
  insertCalibre,
  updateCalibre: updateCatalog('calibres'),
  deleteCalibre: deleteCatalog('calibres'),
  listPlagasRecepcion: listCatalog('plagasRecepcion'),
  insertPlagaRecepcion: insertCatalog('plagasRecepcion'),
  updatePlagaRecepcion: updateCatalog('plagasRecepcion'),
  deletePlagaRecepcion: deleteCatalog('plagasRecepcion'),
  listColoresRecepcion: listCatalog('coloresRecepcion'),
  insertColorRecepcion: insertCatalog('coloresRecepcion'),
  updateColorRecepcion: updateCatalog('coloresRecepcion'),
  deleteColorRecepcion: deleteCatalog('coloresRecepcion'),
  listEnvases: listCatalog('envases'),
  insertEnvase: insertCatalog('envases'),
  updateEnvase: updateCatalog('envases'),
  deleteEnvase: deleteCatalog('envases'),
  listCategoriasEnvase: listCatalog('categoriasEnvase'),
  insertCategoriaEnvase: insertCatalog('categoriasEnvase'),
  updateCategoriaEnvase: updateCatalog('categoriasEnvase'),
  deleteCategoriaEnvase: deleteCatalog('categoriasEnvase'),
  listComunas: listCatalog('comunas'),
  listProductores: listCatalog('productores'),
  insertProductor: insertCatalog('productores'),
  updateProductor: updateCatalog('productores'),
  deleteProductor: deleteCatalog('productores'),
  listCuarteles: listCatalog('cuarteles'),
  insertCuartel: insertCatalog('cuarteles'),
  updateCuartel: updateCatalog('cuarteles'),
  deleteCuartel: deleteCatalog('cuarteles'),
  listClientes: listCatalog('clientes'),
  insertCliente: insertCatalog('clientes'),
  updateCliente: updateCatalog('clientes'),
  deleteCliente: deleteCatalog('clientes'),
  listExportadoras: listCatalog('exportadoras'),
  insertExportadora: insertCatalog('exportadoras'),
  updateExportadora: updateCatalog('exportadoras'),
  deleteExportadora: deleteCatalog('exportadoras'),
  listExportadoraProductores,
  insertExportadoraProductor: insertCatalog('exportadoraProductores'),
  updateExportadoraProductor: updateCatalog('exportadoraProductores'),
  deleteExportadoraProductor: deleteCatalog('exportadoraProductores'),
  listConsignatarios: listCatalog('consignatarios'),
  insertConsignatario: insertCatalog('consignatarios'),
  updateConsignatario: updateCatalog('consignatarios'),
  deleteConsignatario: deleteCatalog('consignatarios'),
  listAgentes: listCatalog('agentes'),
  insertAgente: insertCatalog('agentes'),
  updateAgente: updateCatalog('agentes'),
  deleteAgente: deleteCatalog('agentes'),
  listOrigenes: listCatalog('origenes'),
  insertOrigen: insertCatalog('origenes'),
  updateOrigen: updateCatalog('origenes'),
  deleteOrigen: deleteCatalog('origenes'),
  listCondiciones: listCatalog('condiciones'),
  insertCondicion: insertCatalog('condiciones'),
  updateCondicion: updateCatalog('condiciones'),
  deleteCondicion: deleteCatalog('condiciones'),
  listDestinos: listCatalog('destinos'),
  insertDestino: insertCatalog('destinos'),
  updateDestino: updateCatalog('destinos'),
  deleteDestino: deleteCatalog('destinos'),
  listTiposDocumento: listCatalog('tiposDocumento'),
  insertTipoDocumento: insertCatalog('tiposDocumento'),
  updateTipoDocumento: updateCatalog('tiposDocumento'),
  deleteTipoDocumento: deleteCatalog('tiposDocumento'),
  listTiposMovimiento: listCatalog('tiposMovimiento'),
  insertTipoMovimiento: insertCatalog('tiposMovimiento'),
  updateTipoMovimiento: updateCatalog('tiposMovimiento'),
  deleteTipoMovimiento: deleteCatalog('tiposMovimiento'),
  listSubtiposMovimiento: listCatalog('subtiposMovimiento'),
  insertSubtipoMovimiento: insertCatalog('subtiposMovimiento'),
  updateSubtipoMovimiento: updateCatalog('subtiposMovimiento'),
  deleteSubtipoMovimiento: deleteCatalog('subtiposMovimiento'),
  listParametrosGenerales: listCatalog('parametrosGenerales'),
  insertParametroGeneral: insertCatalog('parametrosGenerales'),
  updateParametroGeneral: updateCatalog('parametrosGenerales'),
  deleteParametroGeneral: deleteCatalog('parametrosGenerales'),
  listParametrosDetalle: listCatalog('parametrosDetalle'),
  insertParametroDetalle: insertCatalog('parametrosDetalle'),
  updateParametroDetalle: updateCatalog('parametrosDetalle'),
  deleteParametroDetalle: deleteCatalog('parametrosDetalle'),
  listMonedas: listCatalog('monedas'),
  insertMoneda: insertCatalog('monedas'),
  updateMoneda: updateCatalog('monedas'),
  deleteMoneda: deleteCatalog('monedas'),
  listValoresMoneda: listCatalog('valoresMoneda'),
  insertValorMoneda: insertCatalog('valoresMoneda'),
  updateValorMoneda: updateCatalog('valoresMoneda'),
  deleteValorMoneda: deleteCatalog('valoresMoneda'),
  listPuertos: listCatalog('puertos'),
  insertPuerto: insertCatalog('puertos'),
  updatePuerto: updateCatalog('puertos'),
  deletePuerto: deleteCatalog('puertos'),
  listCausalesAnulacion: listCatalog('causalesAnulacion'),
  insertCausalAnulacion: insertCatalog('causalesAnulacion'),
  updateCausalAnulacion: updateCatalog('causalesAnulacion'),
  deleteCausalAnulacion: deleteCatalog('causalesAnulacion'),
  listDespachadoresAutorizados: listCatalog('despachadoresAutorizados'),
  insertDespachadorAutorizado: insertCatalog('despachadoresAutorizados'),
  updateDespachadorAutorizado: updateCatalog('despachadoresAutorizados'),
  deleteDespachadorAutorizado: deleteCatalog('despachadoresAutorizados'),
  listProcedencias: listCatalog('procedencias'),
  insertProcedencia: insertCatalog('procedencias'),
  updateProcedencia: updateCatalog('procedencias'),
  deleteProcedencia: deleteCatalog('procedencias'),
  listSecciones: listCatalog('secciones'),
  insertSeccion: insertCatalog('secciones'),
  updateSeccion: updateCatalog('secciones'),
  deleteSeccion: deleteCatalog('secciones'),
  listTiposEtiqueta: listCatalog('tiposEtiqueta'),
  insertTipoEtiqueta: insertCatalog('tiposEtiqueta'),
  updateTipoEtiqueta: updateCatalog('tiposEtiqueta'),
  deleteTipoEtiqueta: deleteCatalog('tiposEtiqueta'),
  listConfiguracionesEtiqueta: listCatalog('configuracionesEtiqueta'),
  insertConfiguracionEtiqueta: insertCatalog('configuracionesEtiqueta'),
  updateConfiguracionEtiqueta: updateCatalog('configuracionesEtiqueta'),
  deleteConfiguracionEtiqueta: deleteCatalog('configuracionesEtiqueta'),
  listOrdenesProcesoAdm: listCatalog('ordenesProcesoAdm'),
  insertOrdenesProcesoAdm: insertCatalog('ordenesProcesoAdm'),
  updateOrdenesProcesoAdm: updateCatalog('ordenesProcesoAdm'),
  deleteOrdenesProcesoAdm: deleteCatalog('ordenesProcesoAdm'),
  listTiposBasePallet: listCatalog('tiposBasePallet'),
  insertTipoBasePallet: insertCatalog('tiposBasePallet'),
  updateTipoBasePallet: updateCatalog('tiposBasePallet'),
  deleteTipoBasePallet: deleteCatalog('tiposBasePallet'),
  listTiposAltura: listCatalog('tiposAltura'),
  insertTipoAltura: insertCatalog('tiposAltura'),
  updateTipoAltura: updateCatalog('tiposAltura'),
  deleteTipoAltura: deleteCatalog('tiposAltura')
};
