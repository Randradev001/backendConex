const test = require("node:test");
const assert = require("node:assert/strict");
const {
  permission,
  processTypeLabel,
  correlativeCode,
  usListFilters,
  listDespachos,
  finalizarDespacho,
  getDespachoDetail,
  generateDespachoUSPdf,
} = require("../src/modules/despachosUS/despachosUS.service");
const { renderDespachoUSPdf } = require("../src/modules/despachosUS/despachosUS.pdf");

const poolFrom = (result, capture = () => {}) => ({
  request() {
    return {
      input() {
        return this;
      },
      async query(statement) {
        capture(statement);
        return result;
      },
    };
  },
});

test("usa el permiso histórico y los filtros del WorkPanel DespachosUS", () => {
  assert.deepEqual(permission, { sistema: 100, modulo: 20, programa: 11 });
  assert.deepEqual(usListFilters({
    from: "02/10/2026",
    to: "06/10/2026",
    status: "9",
    planilla: "18",
    guide: "27",
    type: "3",
  }), {
    from: "2026-10-02",
    to: "2026-10-06",
    status: 9,
    planilla: 18,
    guide: 27,
    search: "",
    page: 1,
    pageSize: 25,
    type: 3,
    all: false,
  });
  assert.equal(processTypeLabel(2), "Fumigación");
  assert.equal(processTypeLabel(3), "Muestreo");
  assert.equal(correlativeCode(2), "DFUMIOR");
  assert.equal(correlativeCode(3), "DMUESOR");
  assert.equal(usListFilters({ type: "9" }).type, 9);
  assert.throws(() => usListFilters({ type: 1 }), /tipo de proceso/);
});

test("lista solo el tipo USDA seleccionado dentro de la temporada activa", async () => {
  let statement = "";
  const result = await listDespachos(
    1,
    { from: "2026-10-01", to: "2026-10-06", status: 9, type: 2 },
    {
      poolProvider: async () => poolFrom({
        recordsets: [
          [{ id: 44, processType: 2, status: 0 }],
          [{ total: 1, totalBoxes: 12, totalKilos: 60, totalFolios: 2 }],
          [{ tempCod: "2017-2018" }],
        ],
      }, (sqlText) => {
        statement = sqlText;
      }),
    },
  );
  assert.equal(result.rows[0].processTypeLabel, "Fumigación");
  assert.equal(result.rows[0].statusLabel, "En Proceso");
  assert.deepEqual(result.totals, { boxes: 12, kilos: 60, folios: 2 });
  assert.match(statement, /h\.DorTipPlani=@DorTipPlani/);
  assert.match(statement, /h\.DorTipPlani IN \(2,3\)/);
  assert.match(statement, /@DorTipPlani=9 OR h\.DorTipPlani=@DorTipPlani/);
  assert.match(statement, /ORDER BY internalNumber DESC/i);
  assert.doesNotMatch(statement, /h\.DorTipPlani=1/);
});

test("finaliza USDA y usa un correlativo independiente por tipo", async () => {
  const statements = [];
  const transaction = {
    async begin() {},
    async commit() {
      this.committed = true;
    },
    async rollback() {
      this.rolledBack = true;
    },
  };
  const requestFactory = () => ({
    input() {
      return this;
    },
    async query(statement) {
      statements.push(statement);
      if (/FROM TEMP01 WITH/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
      if (/FROM DESORIGEN WITH/.test(statement)) return { recordset: [{ DorEstado: 0 }] };
      return { rowsAffected: [1] };
    },
  });
  const calls = [];
  const result = await finalizarDespacho(1, 44, 2, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
    nextNumber: async (input) => {
      calls.push(input);
      return 901;
    },
  });
  assert.deepEqual(result, {
    dorNum: 44,
    dorTipPlani: 2,
    planillaNumber: 901,
    status: 1,
    statusLabel: "Finalizado",
  });
  assert.equal(calls[0].code, "DFUMIOR");
  assert.equal(calls[0].digits, 10);
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /SET DorEstado=1,DORNumf=@Planilla/.test(statement)));
});

test("rechaza tipos ajenos a USDA al consultar el detalle y el PDF", async () => {
  assert.throws(
    () => getDespachoDetail(1, 44, 1, { poolProvider: async () => ({}) }),
    (error) => error.code === "VALIDATION_ERROR" && /Fumigación o Muestreo/.test(error.message),
  );
  await assert.rejects(
    () => generateDespachoUSPdf(1, 44, 1, { poolProvider: async () => ({}) }),
    (error) => error.code === "VALIDATION_ERROR" && /Fumigación o Muestreo/.test(error.message),
  );
});

test("genera el PDF USDA con la cabecera y el detalle del XPZ", async () => {
  const statements = [];
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(statement) {
          statements.push(statement);
          if (/FROM TEMP01/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
          if (/FROM DESORIGEN h/.test(statement)) {
            return {
              recordsets: [
                [{ DORNum: 44, DORNumf: 901, DorTipPlani: 2, DorEstado: 1, DorFecha: "2026-10-06" }],
                [{ folio: "0000000073", boxes: 12, requestNumber: 15 }],
                [{ folio: "0000000073", speciesName: "Cerezas", boxes: 12, kilos: 60 }],
                [],
              ],
            };
          }
          return { recordset: [{ companyName: "Empresa de prueba", EmpCodSAG: "13" }] };
        },
      };
    },
  };
  const file = await generateDespachoUSPdf(1, 44, 2, {
    poolProvider: async () => pool,
    pdfRenderer: async (data) => {
      assert.equal(data.header.DORNumf, 901);
      assert.equal(data.header.companyName, "Empresa de prueba");
      assert.equal(data.folios.length, 1);
      assert.equal(data.details[0].boxes, 12);
      return Buffer.from("%PDF-despacho-us");
    },
  });
  assert.equal(file.filename, "Planilla_Despacho_US_901.pdf");
  assert.equal(file.content.toString(), "%PDF-despacho-us");
  assert.ok(statements.some((statement) => /DorTipPlani=@DorTipPlani/.test(statement)));
  assert.ok(statements.some((statement) => /p\.ProdPack/.test(statement)));
});

test("renderiza el PDF USDA en carta vertical", async () => {
  const pdf = await renderDespachoUSPdf({
    header: { DORNum: 44, DORNumf: 901, tempCod: "2017-2018", processTypeLabel: "Fumigación" },
    folios: [],
    details: [],
  });
  assert.match(pdf.toString("latin1"), /\/MediaBox \[0 0 612 792\]/);
  assert.match(pdf.toString("latin1"), /\/Count 2/);
});
