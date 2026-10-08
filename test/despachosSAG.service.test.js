const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DespachosSAGError,
  generateArchivoDes,
  buildMultipuertoFile,
  generateArchivoMultipuerto,
  generateDespachoPdf,
  finalizarDespacho,
  getDespachoDetail,
  listAvailableDespachoFolios,
  listDespachos,
  listFilters,
  despachoTypeLabel,
  normalizeDespachoPayload,
  normalizeMultipuertoPayload,
  statusLabel,
} = require("../src/modules/despachosSAG/despachosSAG.service");
const { addFolioTotals, renderDespachoPdf } = require("../src/modules/despachosSAG/despachosSAG.pdf");

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

test("lista todos los folios disponibles sin limitar el resultado a 500", async () => {
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
          return { recordset: [] };
        },
      };
    },
  };

  await listAvailableDespachoFolios(1, 0, 1, {}, { poolProvider: async () => pool });
  await listAvailableDespachoFolios(1, 44, 2, {}, { poolProvider: async () => pool });

  const listStatements = statements.filter((statement) => /ORDER BY (s\.Sol2Folio|p\.PUS1Folio)/.test(statement));
  assert.equal(listStatements.length, 2);
  listStatements.forEach((statement) => assert.doesNotMatch(statement, /TOP\s+500/i));
  const originStatement = listStatements.find((statement) => /ORDER BY s\.Sol2Folio/.test(statement));
  const usdaStatement = listStatements.find((statement) => /ORDER BY p\.PUS1Folio/.test(statement));
  assert.match(originStatement, /s\.Sol2CajasDes\s*>\s*0/);
  assert.match(originStatement, /s\.Sol2Dispo\s*=\s*0/);
  assert.match(originStatement, /i\.SolEstado\s*=\s*1/);
  assert.doesNotMatch(originStatement, /NOT EXISTS/i);
  assert.match(usdaStatement, /p\.PUS1CajDes\s*>\s*0/);
  assert.match(usdaStatement, /p\.PUS1Dispo\s*=\s*1/);
  assert.match(usdaStatement, /h\.PUSEstado\s*=\s*1/);
  assert.doesNotMatch(usdaStatement, /NOT EXISTS/i);
});

test("conserva los filtros GX y sus estados de Despachos SAG", () => {
  const filters = listFilters({
    from: "02/10/2026",
    to: "06/10/2026",
    status: "9",
    planilla: "18",
    guide: "27",
  });
  assert.deepEqual(filters, {
    from: "2026-10-02",
    to: "2026-10-06",
    status: 9,
    planilla: 18,
    guide: 27,
    page: 1,
    pageSize: 25,
  });
  assert.equal(statusLabel(0), "En Proceso");
  assert.equal(statusLabel(1), "Finalizado");
  assert.equal(statusLabel(5), "Nula");
});

test("rechaza fechas invertidas y estados que no existen en el WorkPanel", () => {
  assert.throws(
    () => listFilters({ from: "2026-10-02", to: "2026-10-01" }),
    DespachosSAGError,
  );
  assert.throws(
    () => listFilters({ from: "2026-10-01", to: "2026-10-02", status: 3 }),
    DespachosSAGError,
  );
});

test("normaliza la cabecera de DesOrigen sin aceptar la empresa desde la pantalla", () => {
  const payload = normalizeDespachoPayload({
    EmpCod: 999,
    dorTipPlani: 2,
    dorFecha: "06/10/2026",
    dorPuertoE: 10,
    dorPuertoD: 20,
    destCod: 701,
    dorObs1: "Despacho de prueba",
  });
  assert.equal(payload.dorTipPlani, 2);
  assert.equal(payload.dorFecha, "2026-10-06");
  assert.equal(payload.dorObs1, "Despacho de prueba");
  assert.equal("EmpCod" in payload, false);
  assert.equal(despachoTypeLabel(1), "Origen");
  assert.equal(despachoTypeLabel(2), "Fumigación");
  assert.equal(despachoTypeLabel(3), "Muestreo");
});

test("lista solo despachos SAG de la temporada y devuelve totales paginados", async () => {
  let statement = "";
  const result = await listDespachos(
    1,
    { from: "2026-10-01", to: "2026-10-06", status: 9 },
    {
      poolProvider: async () =>
        poolFrom(
          {
            recordsets: [
              [{ id: 44, status: 1, planillaNumber: 18 }],
              [{ total: 1, totalBoxes: 12, totalKilos: 60, totalFolios: 2 }],
              [{ tempCod: "2017-2018" }],
            ],
          },
          (sqlText) => {
            statement = sqlText;
          },
        ),
    },
  );
  assert.equal(result.rows[0].statusLabel, "Finalizado");
  assert.deepEqual(result.totals, { boxes: 12, kilos: 60, folios: 2 });
  assert.equal(result.tempCod, "2017-2018");
  assert.match(statement, /h\.DorTipPlani=1/);
  assert.match(statement, /ORDER BY internalNumber DESC/i);
  assert.match(statement, /h\.EmpCod=@EmpCod/);
  assert.match(statement, /@Status=9/);
});

test("incluye otros destinos aprobados en el detalle de folios del despacho", async () => {
  const statements = [];
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(statement) {
          statements.push(statement);
          if (/SELECT TOP 1 RTRIM\(TempCod\) tempCod\s+FROM TEMP01/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
          return {
            recordsets: [
              [{ DORNum: 44, DorTipPlani: 1, DorEstado: 0 }],
              [{ folio: "0000000073", requestNumber: 12, approvedDestinations: "USA, CANADÁ" }],
              [],
              [],
            ],
          };
        },
      };
    },
  };

  const result = await getDespachoDetail(1, 44, 1, { poolProvider: async () => pool });

  assert.equal(result.folios[0].approvedDestinations, "USA, CANADÁ");
  assert.match(statements.at(-1), /RTRIM\(i\.SolDestinos\).*approvedDestinations/i);
  assert.match(statements.at(-1), /LEFT JOIN SOLICITUDES1 i/i);
});

test("genera el archivo DES con la secuencia histórica de ArchiDES", async () => {
  const file = await generateArchivoDes(1, 44, {
    poolProvider: async () =>
      poolFrom({
        recordsets: [
          [
            {
              DORNum: 44,
              DORNumf: 18,
              DestCod: 701,
              fileDate: "20261002",
              DorTotFol: 2,
              DorEstado: 1,
              codePl: "13",
            },
          ],
          [
            { folio: "0000000073", boxes: 12, speciesSag: "18" },
            { folio: "0000000074", boxes: 8, speciesSag: "21" },
          ],
        ],
      }),
  });
  assert.equal(file.filename, "1318.des");
  assert.equal(
    file.content.toString("utf8"),
    "13700202610022\r\n00000000731218\r\n0000000074821\r\n&&\r\n",
  );
});

test("genera el archivo MultiPuerto con la secuencia y separadores del XPZ", () => {
  const values = normalizeMultipuertoPayload({
    traCod: "3",
    traNom: "Fumigación",
    inacCod: "9",
    inacNom: "Activo",
    fecTra: "01/10/2026",
    conTra: "2%",
    duraTra: "24 h",
    ttmpCod: "7",
    sello1: "S1",
    ubi1: "2",
    sello2: "S2",
    ubi2: "4",
  });
  const file = buildMultipuertoFile({
    header: {
      plantCode: 13,
      planillaNumber: 18,
      destinationMpCode: 701,
      exporterMpCode: 4,
      agentMpCode: 5,
      patent: "ABC-123",
      guide: 27,
      shipmentDate: "2026-10-02",
      destinationPort: 70,
      container: "CONT-1",
      dispatcherName: "Despachador",
      totalFolios: 2,
    },
    data: values,
    groups: [{ speciesCode: 1, containerCode: 2, speciesMpCode: 18, containerMpCode: 21, boxes: 12, kilos: 60.5 }],
    communes: [
      { speciesCode: 1, containerCode: 2, producerCode: "P1", communeName: "Rengo" },
      { speciesCode: 1, containerCode: 2, producerCode: "P2", communeName: "Codegua" },
      { speciesCode: 1, containerCode: 2, producerCode: "P1", communeName: "Rengo" },
    ],
  });
  assert.equal(file.filename, "MP1318.txt");
  assert.equal(
    file.content.toString("utf8"),
    "13;18;701;4;5;18;ABC-123;27;02-10-2026;12;60.50;21;4;70;CONT-1;2;Rengo-Codegua;3;9;20261001;2%;24 h;Despachador;2;7;S1,2-S2,4\r\n",
  );
});

test("aplica los límites del layout XPZ en los campos MultiPuerto", () => {
  const values = normalizeMultipuertoPayload({
    traCod: "9999",
    traNom: "a".repeat(30),
    inacCod: "9999",
    inacNom: "b".repeat(50),
    fecTra: "31/12/2026",
    conTra: "c".repeat(50),
    duraTra: "d".repeat(50),
    ttmpCod: "9999",
    ttmpNom: "e".repeat(30),
    sello1: "f".repeat(30),
    ubi1: "6",
  });

  assert.equal(values.traCod, 9999);
  assert.equal(values.traNom.length, 30);
  assert.equal(values.inacCod, 9999);
  assert.equal(values.inacNom.length, 50);
  assert.equal(values.fecTra, "2026-12-31");
  assert.equal(values.conTra.length, 50);
  assert.equal(values.duraTra.length, 50);
  assert.equal(values.ttmpCod, 9999);
  assert.equal(values.ttmpNom.length, 30);
  assert.equal(values.sello1.length, 30);
  assert.equal(values.ubi1, 6);

  assert.throws(() => normalizeMultipuertoPayload({ traCod: "10000" }), /rango permitido/);
  assert.throws(() => normalizeMultipuertoPayload({ inacCod: "10000" }), /rango permitido/);
  assert.throws(() => normalizeMultipuertoPayload({ ttmpCod: "10000" }), /rango permitido/);
  assert.throws(() => normalizeMultipuertoPayload({ ubi1: "7" }), /rango permitido/);
  assert.throws(() => normalizeMultipuertoPayload({ traNom: "a".repeat(31) }), /hasta 30 caracteres/);
  assert.throws(() => normalizeMultipuertoPayload({ inacNom: "a".repeat(51) }), /hasta 50 caracteres/);
  assert.throws(() => normalizeMultipuertoPayload({ fecTra: "31/12/2026x" }), /hasta 10 caracteres/);
  assert.throws(() => normalizeMultipuertoPayload({ sello1: "a".repeat(31) }), /hasta 30 caracteres/);
});

test("mantiene la disponibilidad de ArchiMP sin filtrar DorEstado", async () => {
  let statement = "";
  await generateArchivoMultipuerto(1, 44, {
    poolProvider: async () =>
      poolFrom(
        {
          recordsets: [[{ planillaNumber: 18, plantCode: 13 }], [{}], [], []],
        },
        (sqlText) => {
          statement = sqlText;
        },
      ),
  });
  assert.match(statement, /h\.DorTipPlani=1/);
  assert.doesNotMatch(statement, /DorEstado/);
});

test("impide generar archivo DES para un despacho no finalizado", async () => {
  await assert.rejects(
    () =>
      generateArchivoDes(1, 44, {
        poolProvider: async () =>
          poolFrom({ recordsets: [[{ DorEstado: 0 }], []] }),
      }),
    (error) => error.code === "DESPACHO_NOT_FINALIZED",
  );
});

test("genera el PDF del despacho combinando cabecera y detalles", async () => {
  const file = await generateDespachoPdf(1, 44, {
    poolProvider: async () =>
      poolFrom({
        recordsets: [
          [{ planillaNumber: 18, internalNumber: 44, status: 1 }],
          [{ folio: "0000000073" }],
          [{ folio: "0000000073", boxes: 12 }],
          [{ companyName: "Empresa de prueba" }],
          [{ tempCod: "2017-2018" }],
        ],
      }),
    pdfRenderer: async (data) => {
      assert.equal(data.header.planillaNumber, 18);
      assert.equal(data.folios.length, 1);
      assert.equal(data.details[0].boxes, 12);
      return Buffer.from("%PDF-despacho");
    },
  });
  assert.equal(file.filename, "Planilla_Despacho_18.pdf");
  assert.equal(file.content.toString(), "%PDF-despacho");
});

test("agrega totales solo para folios repetidos en el detalle del despacho", () => {
  const rows = addFolioTotals([
    { folio: "100", boxes: 8, kilos: 40 },
    { folio: "200", boxes: 4, kilos: 20 },
    { folio: "100", boxes: 10, kilos: 60 },
  ]);

  assert.equal(rows.length, 4);
  assert.equal(rows.filter((row) => row.__folioTotals).length, 1);
  assert.deepEqual(rows[3], { __totals: true, __folioTotals: true, folio: "100", boxes: 18, kilos: 100 });
});

test("mantiene todas las páginas del PDF en carta vertical", async () => {
  const content = await renderDespachoPdf({
    header: { planillaNumber: 18, companyName: "Empresa de prueba", tempCod: "2017-2018" },
    folios: [],
    details: Array.from({ length: 25 }, (_, index) => ({
      folio: String(index + 1),
      speciesName: "Cerezas",
      varietyName: "Santina",
      province: "O'Higgins",
      commune: "Rengo",
      boxes: 10,
      originCsg: "88510",
      inspectionNumber: 1,
      processDate: "2026-10-01",
      producerName: "Productor",
    })),
  });
  const source = content.toString("latin1");
  assert.ok((source.match(/\/MediaBox \[0 0 612 792\]/g) || []).length >= 2);
  assert.equal((source.match(/\/MediaBox \[0 0 792 612\]/g) || []).length, 0);
});

test("finaliza un despacho en proceso cuando cumple las validaciones", async () => {
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
      if (/SELECT TOP 1 DorEstado,DorFecha/.test(statement)) {
        return {
          recordsets: [
            [{ DorEstado: 0, DorFecha: "2026-10-07", DorPuertoE: 1, DorPuertoD: 2, DestCod: 3, DorObs1: "Observación" }],
            [{ folioCount: 1 }],
          ],
        };
      }
      return { rowsAffected: [1] };
    },
  });
  const result = await finalizarDespacho(1, 44, 1, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });
  assert.deepEqual(result, { dorNum: 44, status: 1, statusLabel: "Finalizado" });
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /UPDATE DESORIGEN SET DorEstado=1/.test(statement)));
});

test("rechaza finalizar un despacho sin folios", async () => {
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
      if (/FROM TEMP01 WITH/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
      if (/SELECT TOP 1 DorEstado,DorFecha/.test(statement)) {
        return {
          recordsets: [
            [{ DorEstado: 0, DorFecha: "2026-10-07", DorPuertoE: 1, DorPuertoD: 2, DestCod: 3, DorObs1: "Observación" }],
            [{ folioCount: 0 }],
          ],
        };
      }
      return { rowsAffected: [1] };
    },
  });
  await assert.rejects(
    () => finalizarDespacho(1, 44, 1, { poolProvider: async () => ({}), transactionFactory: () => transaction, requestFactory }),
    (error) => error.code === "DESPACHO_WITHOUT_FOLIOS" && error.status === 409,
  );
  assert.equal(transaction.committed, undefined);
  assert.equal(transaction.rolledBack, true);
});
