const test = require('node:test');
const assert = require('node:assert/strict');

const { getAuthorizedMenu } = require('../src/services/seguridadMenu.service');

test('incluye 100/15/20 por su asignación aunque no dependa de ProgTipo ni ProgNomGX', async () => {
  const inputs = {};
  let statement = '';
  const pool = {
    request: () => ({
      input(name, _type, value) {
        inputs[name] = value;
        return this;
      },
      async query(sqlText) {
        statement = sqlText;
        return {
          recordset: [
            {
              SistCod: 100,
              SistNombre: 'Control de Producción Frutícola ',
              Modcod: 15,
              ModDes: 'Consultas de Procesos ',
              ProgCod: 20,
              ProgDes: 'Dashboard de producción ',
              ProgNomGX: '',
              ProgIDmenu: null,
              ProgTarget: null
            }
          ]
        };
      }
    })
  };

  const menu = await getAuthorizedMenu(pool, 7, 'GERENCIA');

  assert.deepEqual(inputs, { empCod: 7, login: 'GERENCIA' });
  assert.equal(menu[0].modulos[0].programas[0].progCod, 20);
  assert.equal(menu[0].modulos[0].programas[0].llamadoGX, '');
  assert.match(statement, /OR \(P\.SistCod=100 AND P\.Modcod=15 AND P\.ProgCod=20\)/);
  assert.doesNotMatch(statement, /ASIGSIST/);
});
