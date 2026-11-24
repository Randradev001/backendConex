const test = require('node:test');
const assert = require('node:assert/strict');

const { getAuthorizedMenu } = require('../src/services/seguridadMenu.service');

test('arma el menu desde ASIGSIST, ASIG y ASIGPROG directos del usuario', async () => {
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
  assert.match(statement, /ASIGSIST/);
  assert.match(statement, /INNER JOIN ASIG A/);
  assert.match(statement, /INNER JOIN ASIGPROG AP/);
  assert.match(statement, /P\.ProgTipo=1/);
  assert.doesNotMatch(statement, /URolesPorUser/);
});
