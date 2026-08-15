const controller = require('../src/controllers/maestrosController');
const { getPool } = require('../src/conectorMysql/conectorSqlServer');

const context = { empCod: 1, login: 'MIGRACION' };

const invoke = (label, handler, body = {}, query = {}) => new Promise((resolve, reject) => {
  const req = { body, query, context };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      if (this.statusCode >= 400 || payload.success === false) {
        reject(new Error(`${label}: ${payload.error || payload.message}`));
      } else {
        console.log(`${label}: OK`);
        resolve(payload);
      }
      return payload;
    }
  };

  Promise.resolve(handler(req, res)).catch(reject);
});

const cleanup = async () => {
  const pool = await getPool();
  await pool.request().query(`
    DELETE FROM [EXPPROD] WHERE [EmpCod]=1 AND [ExpCod]=9999;
    DELETE FROM [EXPORT1] WHERE [EmpCod]=1 AND [ExpCod]=9999;
    DELETE FROM [TIPMOV1] WHERE [EmpCod]=1 AND [TMcod]=98;
    DELETE FROM [TIPMOV] WHERE [EmpCod]=1 AND [TMcod]=98;
    DELETE FROM [PARAMGE1] WHERE [empcod]=1 AND [parcod]=9999;
    DELETE FROM [PARAMGEN] WHERE [empcod]=1 AND [parcod]=9999;
    DELETE FROM [VALMEXT] WHERE [MonCod]=99;
    DELETE FROM [MONEDAS] WHERE [MonCod]=99;
    DELETE FROM [TIPDOC] WHERE [TdCod]=98;
    DELETE FROM [PUERTOS] WHERE [PuCod]=998;
    DELETE FROM [CAUSAANUL] WHERE [CAnCod]=99;
    DELETE FROM [DESPAAUTO] WHERE [EmpCod]=1 AND [DACod]=99;
    DELETE FROM [PROCEDENCIA] WHERE [EmpCod]=1 AND [ProcCod]=99;
    DELETE FROM [SECCIONES] WHERE [EmpCod]=1 AND [Seccod]=99;
    DELETE FROM [TIPETI] WHERE [EmpCod]=1 AND [TEtCod]=999;
    DELETE FROM [TIPBPA] WHERE [EmpCod]=1 AND [TBPCod]=999;
    DELETE FROM [TIPALT] WHERE [EmpCod]=1 AND [TAlCod]=999;
  `);
};

const insertAndUpdateSimpleMasters = async () => {
  await invoke('TIPDOC insert', controller.insertTipoDocumento, { TdCod: 98, TdNom: 'PRUEBA IA', TdInter: 1, TdBloq: 0 });
  await invoke('TIPDOC update', controller.updateTipoDocumento, { TdCod: 98, TdNom: 'PRUEBA IA MOD' });

  await invoke('PUERTOS insert', controller.insertPuerto, { PuCod: 998, PuNombre: 'PUERTO PRUEBA IA', PuNac: 0, PuCodHomo: 0 });
  await invoke('PUERTOS update', controller.updatePuerto, { PuCod: 998, PuNombre: 'PUERTO IA MOD' });
  await invoke('CAUSAANUL insert', controller.insertCausalAnulacion, { CAnCod: 99, CanNom: 'CAUSAL PRUEBA IA', CanPE: 0 });
  await invoke('CAUSAANUL update', controller.updateCausalAnulacion, { CAnCod: 99, CanNom: 'CAUSAL IA MOD' });
  await invoke('DESPAAUTO insert', controller.insertDespachadorAutorizado, { DACod: 99, DANombre: 'DESPACHADOR PRUEBA IA', DAVig: 1 });
  await invoke('DESPAAUTO update', controller.updateDespachadorAutorizado, { DACod: 99, DANombre: 'DESPACHADOR IA MOD' });
  await invoke('PROCEDENCIA insert', controller.insertProcedencia, { ProcCod: 99, ProcNom: 'PROCEDENCIA PRUEBA IA', ProcEst: 1 });
  await invoke('PROCEDENCIA update', controller.updateProcedencia, { ProcCod: 99, ProcNom: 'PROCEDENCIA IA MOD' });
  await invoke('SECCIONES insert', controller.insertSeccion, { Seccod: 99, SecNom: 'SECCION PRUEBA IA' });
  await invoke('SECCIONES update', controller.updateSeccion, { Seccod: 99, SecNom: 'SECCION IA MOD' });
  await invoke('TIPETI insert', controller.insertTipoEtiqueta, { TEtCod: 999, TEtDesc: 'ETIQUETA PRUEBA IA' });
  await invoke('TIPETI update', controller.updateTipoEtiqueta, { TEtCod: 999, TEtDesc: 'ETIQUETA IA MOD' });
  await invoke('TIPBPA insert', controller.insertTipoBasePallet, { TBPCod: 999, TBPDesc: 'BASE PRUEBA IA', TBPBase: 8, TBPDiv: 2 });
  await invoke('TIPBPA update', controller.updateTipoBasePallet, { TBPCod: 999, TBPDesc: 'BASE IA MOD' });
  await invoke('TIPALT insert', controller.insertTipoAltura, { TAlCod: 999, TAlDesc: 'ALTURA PRUEBA IA' });
  await invoke('TIPALT update', controller.updateTipoAltura, { TAlCod: 999, TAlDesc: 'ALTURA IA MOD' });
};

const insertAndUpdateCompositeMasters = async () => {
  await invoke('EXPORT1 insert', controller.insertExportadora, {
    ExpCod: 9999,
    ExpNom: 'EXPORTADORA PRUEBA IA',
    ExpRut: 94612000,
    ExpDv: '6',
    EXPCodMP: 0,
    EXPSECod: 'IA'
  });
  await invoke('EXPORT1 update', controller.updateExportadora, { ExpCod: 9999, ExpNom: 'EXPORTADORA IA MOD' });
  await invoke('EXPPROD insert', controller.insertExportadoraProductor, { ExpCod: 9999, ProdCod: '1' });
  await invoke('EXPPROD delete', controller.deleteExportadoraProductor, { ExpCod: 9999, ProdCod: '1' });

  await invoke('TIPMOV insert', controller.insertTipoMovimiento, { TMcod: 98, TMNom: 'MOV PRUEBA IA' });
  await invoke('TIPMOV1 insert', controller.insertSubtipoMovimiento, { TMcod: 98, TMSCod: 98, TMSNom: 'SUBMOV PRUEBA IA' });
  await invoke('TIPMOV1 update', controller.updateSubtipoMovimiento, { TMcod: 98, TMSCod: 98, TMSNom: 'SUBMOV IA MOD' });

  await invoke('PARAMGEN insert', controller.insertParametroGeneral, {
    PARCod: 9999,
    PARDes: 'PARAMETRO PRUEBA IA',
    PARValor1: 1.25,
    PARValor2: 2.5,
    PARValor3: 3.75
  });
  await invoke('PARAMGE1 insert', controller.insertParametroDetalle, {
    PARCod: 9999,
    PAR1Cod: 999,
    PAR1Des: 'DETALLE PRUEBA IA',
    PAR1Valor1: 1,
    PAR1Valor2: 2,
    PAR1Valor3: 3,
    Par1Texto: 'PRUEBA'
  });
  await invoke('PARAMGE1 update', controller.updateParametroDetalle, {
    PARCod: 9999,
    PAR1Cod: 999,
    PAR1Des: 'DETALLE IA MOD'
  });

  await invoke('MONEDAS insert', controller.insertMoneda, { MonCod: 99, MonDes: 'MONEDA PRUEBA IA' });
  await invoke('VALMEXT insert', controller.insertValorMoneda, { MonCod: 99, VMEFec: '2099-12-31', VMEVal: 123.45 });
  await invoke('VALMEXT update', controller.updateValorMoneda, { MonCod: 99, VMEFec: '2099-12-31', VMEVal: 124.5 });
  await invoke('VALMEXT delete', controller.deleteValorMoneda, { MonCod: 99, VMEFec: '2099-12-31' });
};

const deleteTestMasters = async () => {
  await invoke('TIPDOC delete', controller.deleteTipoDocumento, { TdCod: 98 });
  await invoke('EXPORT1 delete', controller.deleteExportadora, { ExpCod: 9999 });
  await invoke('TIPMOV cascade delete', controller.deleteTipoMovimiento, { TMcod: 98 });
  await invoke('PARAMGEN cascade delete', controller.deleteParametroGeneral, { PARCod: 9999 });
  await invoke('MONEDAS delete', controller.deleteMoneda, { MonCod: 99 });
  await invoke('PUERTOS delete', controller.deletePuerto, { PuCod: 998 });
  await invoke('CAUSAANUL delete', controller.deleteCausalAnulacion, { CAnCod: 99 });
  await invoke('DESPAAUTO delete', controller.deleteDespachadorAutorizado, { DACod: 99 });
  await invoke('PROCEDENCIA delete', controller.deleteProcedencia, { ProcCod: 99 });
  await invoke('SECCIONES delete', controller.deleteSeccion, { Seccod: 99 });
  await invoke('TIPETI delete', controller.deleteTipoEtiqueta, { TEtCod: 999 });
  await invoke('TIPBPA delete', controller.deleteTipoBasePallet, { TBPCod: 999 });
  await invoke('TIPALT delete', controller.deleteTipoAltura, { TAlCod: 999 });
};

const verifyNoChildrenRemain = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM [TIPMOV1] WHERE [EmpCod]=1 AND [TMcod]=98) +
      (SELECT COUNT(*) FROM [PARAMGE1] WHERE [empcod]=1 AND [parcod]=9999) AS [Count]
  `);

  if (result.recordset[0].Count !== 0) {
    throw new Error('La eliminacion de niveles 2 dejo registros');
  }
};

const run = async () => {
  await cleanup();
  await insertAndUpdateSimpleMasters();
  await insertAndUpdateCompositeMasters();
  await deleteTestMasters();
  await verifyNoChildrenRemain();
  console.log('CRUD COMPLETO: OK, sin residuos');
};

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    try {
      await cleanup();
      console.error('Limpieza de emergencia completada');
    } catch (cleanupError) {
      console.error('Fallo la limpieza de emergencia', cleanupError);
    }
    process.exit(1);
  });
