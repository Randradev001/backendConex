const { sql } = require('../conectorMysql/conectorSqlServer');

const clean = (value) => (typeof value === 'string' ? value.trim() : value);

const getAuthorizedMenu = async (pool, empCod, login) => {
  const result = await pool.request()
    .input('empCod', sql.Int, empCod)
    .input('login', sql.VarChar(10), login)
    .query(`
      WITH EffectivePrograms AS (
        SELECT SistCod, Modcod, ProgCod
        FROM ASIGPROG
        WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login
        UNION
        SELECT T.SistCod, T.Modcod, T.ProgCod
        FROM URolesPorUser R
        INNER JOIN ASIGPROG T
          ON T.GECODEMP=0 AND RTRIM(T.UsuLogin)=RTRIM(R.ROLCod)
        WHERE R.GECODEMP=@empCod AND RTRIM(R.UsuLogin)=@login
      )
      SELECT DISTINCT
        S.SistCod,
        S.SistNombre,
        S.SistFAIcons,
        M.Modcod,
        M.ModDes,
        M.ModFAIcons,
        P.ProgCod,
        P.ProgDes,
        P.ProgNomGX,
        P.ProgIDmenu,
        P.ProgTarget
      FROM EffectivePrograms A
      INNER JOIN SISTEMAS S ON S.SistCod=A.SistCod
      INNER JOIN MODULOS M ON M.SistCod=A.SistCod AND M.Modcod=A.Modcod
      INNER JOIN PROGRAM P ON P.SistCod=A.SistCod AND P.Modcod=A.Modcod AND P.ProgCod=A.ProgCod
      WHERE P.ProgTipo=1
      ORDER BY S.SistCod, M.Modcod, P.ProgCod
    `);

  const systems = [];
  for (const row of result.recordset) {
    let system = systems.find((item) => item.sistCod === Number(row.SistCod));
    if (!system) {
      system = {
        sistCod: Number(row.SistCod),
        nombre: clean(row.SistNombre),
        icono: clean(row.SistFAIcons),
        modulos: []
      };
      systems.push(system);
    }

    let module = system.modulos.find((item) => item.modCod === Number(row.Modcod));
    if (!module) {
      module = {
        modCod: Number(row.Modcod),
        nombre: clean(row.ModDes),
        icono: clean(row.ModFAIcons),
        programas: []
      };
      system.modulos.push(module);
    }

    module.programas.push({
      progCod: Number(row.ProgCod),
      nombre: clean(row.ProgDes),
      llamadoGX: clean(row.ProgNomGX),
      idMenu: clean(row.ProgIDmenu),
      target: clean(row.ProgTarget)
    });
  }

  return systems;
};

module.exports = { getAuthorizedMenu };
