const { sql } = require('../conectorMysql/conectorSqlServer');

const clean = (value) => (typeof value === 'string' ? value.trim() : value);

const getAuthorizedMenu = async (pool, empCod, login) => {
  const result = await pool.request()
    .input('empCod', sql.Int, empCod)
    .input('login', sql.VarChar(10), login)
    .query(`
      SELECT DISTINCT
        S.SistCod,
        S.SistNombre,
        S.SistFAIcons,
        M.Modcod,
        COALESCE(NULLIF(RTRIM(A.AsigDes),''),RTRIM(M.ModDes)) AS ModDes,
        M.ModFAIcons,
        P.ProgCod,
        P.ProgDes,
        P.ProgNomGX,
        P.ProgIDmenu,
        P.ProgTarget
      FROM ASIGSIST SS
      INNER JOIN SISTEMAS S ON S.SistCod=SS.SistCod
      INNER JOIN ASIG A
        ON A.GECODEMP=SS.GECODEMP
       AND RTRIM(REPLACE(A.AsigUsu,CHAR(160),' '))=RTRIM(REPLACE(SS.AsgSisLogin,CHAR(160),' '))
       AND A.SistCod=SS.SistCod
      INNER JOIN MODULOS M ON M.SistCod=A.SistCod AND M.Modcod=A.AsigMod
      INNER JOIN ASIGPROG AP
        ON AP.GECODEMP=A.GECODEMP
       AND RTRIM(REPLACE(AP.UsuLogin,CHAR(160),' '))=RTRIM(REPLACE(A.AsigUsu,CHAR(160),' '))
       AND AP.SistCod=A.SistCod
       AND AP.Modcod=A.AsigMod
      INNER JOIN PROGRAM P
        ON P.SistCod=AP.SistCod AND P.Modcod=AP.Modcod AND P.ProgCod=AP.ProgCod
       AND P.ProgTipo=1
      WHERE SS.GECODEMP=@empCod
        AND RTRIM(REPLACE(SS.AsgSisLogin,CHAR(160),' '))=RTRIM(REPLACE(@login,CHAR(160),' '))
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
