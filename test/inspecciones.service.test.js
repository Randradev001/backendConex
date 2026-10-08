const test = require("node:test");
const assert = require("node:assert/strict");
const {
  InspeccionesError,
  addFolioToSolicitud,
  anularSolicitud,
  cambiarEstadoSolicitud,
  createSolicitud,
  defaultRange,
  generateArchivoIns,
  generateSolicitudPdf,
  getFormData,
  getAvailableFolioDetails,
  listFilters,
  listAvailableFolios,
  listInspecciones,
  removeFolioFromSolicitud,
  statusLabel,
  updateSolicitud,
  getSolicitudDetalle,
} = require("../src/modules/inspecciones/inspecciones.service");
const { renderSolicitudPdf } = require("../src/modules/inspecciones/inspecciones.pdf");

test("usa por defecto los últimos 60 días y permite el estado Todos", () => {
  const range = defaultRange(new Date("2026-10-01T12:00:00"));
  assert.deepEqual(range, { from: "2026-08-02", to: "2026-10-01" });
  const filters = listFilters({ from: range.from, to: range.to, status: "9" });
  assert.equal(filters.status, null);
});

test("obtiene el nombre de la empresa autenticada para el banner", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query() {
          return {
            recordsets: [[{ tempCod: "2017-2018" }], [], [], [{ companyName: "Empresa de prueba" }]],
          };
        },
      };
    },
  };
  const result = await getFormData(1, { poolProvider: async () => pool });
  assert.equal(result.companyName, "Empresa de prueba");
});

test("acepta los estados GX de solicitudes de inspección", () => {
  assert.equal(
    listFilters({ from: "2026-08-02", to: "2026-10-01", status: 0 }).status,
    0,
  );
  assert.equal(statusLabel(1), "Aprobada");
  assert.equal(statusLabel(5), "Anulada");
});

test("normaliza fechas ingresadas como DD/MM/YYYY", () => {
  const filters = listFilters({ from: "02/10/2026", to: "06/10/2026", status: "9" });
  assert.equal(filters.from, "2026-10-02");
  assert.equal(filters.to, "2026-10-06");
  assert.equal(filters.status, null);
});

test("resume los estados con el mismo conjunto filtrado del listado", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query() {
          return {
            recordsets: [
              [],
              [
                {
                  total: 7,
                  totalBoxes: 120,
                  totalPallets: 7,
                  inProgress: 2,
                  approved: 3,
                  rejected: 1,
                  annulled: 1,
                },
              ],
              [{ tempCod: "2017-2018" }],
            ],
          };
        },
      };
    },
  };
  const result = await listInspecciones(
    1,
    { from: "2026-08-02", to: "2026-10-01" },
    { poolProvider: async () => pool },
  );
  assert.deepEqual(result.statusCounts, {
    inProgress: 2,
    approved: 3,
    rejected: 1,
    annulled: 1,
  });
  assert.equal(result.total, 7);
});

test("rechaza fechas invertidas y estados no pertenecientes al flujo de inspección", () => {
  assert.throws(
    () => listFilters({ from: "2026-10-02", to: "2026-10-01" }),
    InspeccionesError,
  );
  assert.throws(
    () => listFilters({ from: "2026-08-02", to: "2026-10-01", status: 3 }),
    InspeccionesError,
  );
});

test("muestra el detalle del folio disponible antes de guardar la solicitud", async () => {
  let statement = "";
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(queryText) {
          statement = queryText;
          return {
            recordset: [
              {
                folio: "0000000073",
                FP2Cor: 1,
                producerName: "Productor",
                boxes: 10,
                kilos: 50,
              },
            ],
          };
        },
      };
    },
  };
  const result = await getAvailableFolioDetails(
    1,
    { species: 1, folio: "73" },
    { poolProvider: async () => pool },
  );
  assert.equal(result.folio, "0000000073");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].boxes, 10);
  assert.match(statement, /h\.FPDisponible=1/);

  await getAvailableFolioDetails(
    1,
    { species: 1, folio: "73", pending: true },
    { poolProvider: async () => pool },
  );
  assert.match(statement, /h\.FPDisponible=1/);
  assert.match(statement, /NOT EXISTS\s*\(\s*SELECT 1\s+FROM SOLICITUDES2 associated/i);
});

test("el selector de folios excluye los que ya están asociados a una solicitud", async () => {
  let statement = "";
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(queryText) {
          statement = queryText;
          return { recordset: [{ folio: "0000000073", details: 1 }] };
        },
      };
    },
  };
  const result = await listAvailableFolios(
    1,
    { species: 1 },
    { poolProvider: async () => pool },
  );
  assert.equal(result.rows.length, 1);
  assert.match(statement, /h\.FPEspe=@Species/i);
  assert.match(statement, /h\.FPEstado=10/i);
  assert.match(statement, /h\.FPDisponible=1/i);
  assert.match(statement, /NOT EXISTS\s*\(\s*SELECT 1\s+FROM SOLICITUDES2 associated/i);
  assert.doesNotMatch(statement, /GROUP BY duplicate\.FP2Cor\s+HAVING COUNT\(\*\) > 1/i);
});

test("genera el archivo INS de una solicitud aprobada con el formato GeneXus", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query() {
          return {
            recordsets: [
              [
                {
                  requestNumber: 9,
                  status: 1,
                  destination: 701,
                  requestDate: "20261002",
                  totalPallets: 2,
                  speciesSag: 18,
                  codePl: 13,
                },
              ],
              [
                { folio: "73", boxes: 12 },
                { folio: "0000000074", boxes: 8 },
              ],
            ],
          };
        },
      };
    },
  };
  const file = await generateArchivoIns(1, 199, {
    poolProvider: async () => pool,
  });
  assert.equal(file.filename, "001300009.INS");
  assert.equal(
    file.content.toString("ascii"),
    "00009001300000018700000202610020002\r\n00000000730012\r\n00000000740008\r\n&&",
  );
});

test("rechaza el archivo INS si la solicitud no está aprobada", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query() {
          return { recordsets: [[{ status: 0 }], []] };
        },
      };
    },
  };
  await assert.rejects(
    () => generateArchivoIns(1, 199, { poolProvider: async () => pool }),
    (error) => error.code === "SOLICITUD_NOT_APPROVED",
  );
});

test("rechaza el archivo INS si falta la configuración PL", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query() {
          return {
            recordsets: [
              [
                {
                  requestNumber: 9,
                  status: 1,
                  destination: 1,
                  requestDate: "20261002",
                  totalPallets: 1,
                  speciesSag: 18,
                  codePl: null,
                },
              ],
              [{ folio: "73", boxes: 12 }],
            ],
          };
        },
      };
    },
  };
  await assert.rejects(
    () => generateArchivoIns(1, 199, { poolProvider: async () => pool }),
    (error) => error.code === "INS_FILE_VALUE_INVALID",
  );
});

test("crea una solicitud INS y bloquea sus folios en una sola transacción", async () => {
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
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(statement) {
      statements.push({ statement, values: { ...this.values } });
      if (/FROM TEMP01 WITH/.test(statement))
        return { recordset: [{ tempCod: "2017-2018" }] };
      if (/SELECT Especod FROM ESPECIES/.test(statement))
        return { recordsets: [[{ Especod: 1 }], [{ DestCod: 336 }]] };
      if (/FROM FOLIOSPROC h WITH/.test(statement)) {
        return {
          recordsets: [
            [
              {
                FPFolio: "0000000073",
                FPEspe: 1,
                TAlCod: 2,
                TBPCod: 3,
                TEtCod: 4,
                totalBoxes: 10,
                totalKilos: 50,
                boxesA: 10,
                boxesB: 0,
                boxesC: 0,
              },
            ],
            [
              {
                FP2Cor: 1,
                FP2Fecha: new Date("2026-10-01"),
                ProdCod: "P001",
                fp2especod: 1,
                fp2varcod: 3,
                EnvCod: 2,
                Catcod: 1,
                Calibre: "XL",
                Fp2Tipo: 0,
                FP2Cajas: 10,
                FP2Kilos: 50,
                CuarCod: 0,
              },
            ],
          ],
        };
      }
      return { recordset: [] };
    },
  });
  const result = await createSolicitud(
    1,
    "MANDRADE",
    {
      requestDate: "2026-10-01",
      species: 1,
      destination: 336,
      applicant: "Mandrade",
      approvedDestinations: "CHINA",
      folios: ["73"],
    },
    {
      poolProvider: async () => ({}),
      transactionFactory: () => transaction,
      requestFactory,
      nextNumber: async ({ code }) => (code === "SOLINTER" ? 199 : 9),
    },
  );
  assert.equal(result.solNum, 199);
  assert.equal(result.solNumI, 9);
  assert.equal(result.totals.boxes, 10);
  assert.equal(transaction.committed, true);
  assert.ok(
    statements.some(({ statement }) =>
      /INSERT INTO SOLICITUDES1/.test(statement),
    ),
  );
  assert.ok(
    statements.some(({ statement }) =>
      /INSERT INTO SOLICITUDES2/.test(statement),
    ),
  );
  assert.ok(
    statements.some(({ statement }) =>
      /INSERT INTO SOLICITUDES3/.test(statement),
    ),
  );
  const sol2Insert = statements.find(({ statement }) =>
    /INSERT INTO SOLICITUDES2/.test(statement),
  );
  const sol3Insert = statements.find(({ statement }) =>
    /INSERT INTO SOLICITUDES3/.test(statement),
  );
  assert.match(sol2Insert.statement, /0,@Boxes,@Kilos,0,0,@Boxes,@Kilos,0/);
  assert.match(sol3Insert.statement, /@Boxes,@Kilos,0,0,@Boxes,@Kilos,@Orchard/);
  assert.ok(
    statements.some(({ statement }) =>
      /UPDATE FOLIOSPROC SET FPDisponible=0,FPIns=1/.test(statement),
    ),
  );
});

test("crea la cabecera individual sin exigir folios en la pantalla nueva", async () => {
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
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(statement) {
      statements.push(statement);
      if (/FROM TEMP01 WITH/.test(statement))
        return { recordset: [{ tempCod: "2017-2018" }] };
      if (/SELECT Especod FROM ESPECIES/.test(statement))
        return { recordsets: [[{ Especod: 1 }], [{ DestCod: 336 }]] };
      return { recordset: [] };
    },
  });
  const result = await createSolicitud(
    1,
    "MANDRADE",
    {
      requestDate: "2026-10-01",
      species: 1,
      destination: 336,
      applicant: "Mandrade",
      approvedDestinations: "",
    },
    {
      poolProvider: async () => ({}),
      transactionFactory: () => transaction,
      requestFactory,
      nextNumber: async ({ code }) => (code === "SOLINTER" ? 200 : 10),
    },
  );
  assert.equal(result.folios, 0);
  assert.equal(result.totals.boxes, 0);
  assert.equal(transaction.committed, true);
  assert.ok(
    statements.some((statement) => /INSERT INTO SOLICITUDES1/.test(statement)),
  );
  assert.ok(
    !statements.some((statement) => /INSERT INTO SOLICITUDES2/.test(statement)),
  );
});

test("actualiza la cabecera desde el modo modificar sin tocar sus folios", async () => {
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
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(statement) {
      statements.push({ statement, values: { ...this.values } });
      if (/FROM TEMP01 WITH/.test(statement))
        return { recordset: [{ tempCod: "2017-2018" }] };
      if (/SELECT Especod FROM ESPECIES/.test(statement))
        return { recordsets: [[{ Especod: 1 }], [{ DestCod: 336 }]] };
      if (/FROM SOLICITUDES1 WITH/.test(statement))
        return {
          recordsets: [[{ SolNum: 200, SolEstado: 0, solespe: 1 }], [{ folioCount: 2 }]],
        };
      return { recordset: [] };
    },
  });
  const result = await updateSolicitud(
    1,
    200,
    {
      requestDate: "2026-10-05",
      species: 1,
      destination: 336,
      applicant: "Nuevo solicitante",
      approvedDestinations: "CHINA, EE.UU.",
    },
    {
      poolProvider: async () => ({}),
      transactionFactory: () => transaction,
      requestFactory,
    },
  );
  assert.equal(result.solNum, 200);
  assert.equal(result.applicant, "Nuevo solicitante");
  assert.equal(transaction.committed, true);
  assert.ok(
    statements.some(
      ({ statement, values }) => /UPDATE SOLICITUDES1/.test(statement) && values.Applicant === "Nuevo solicitante",
    ),
  );
  assert.ok(!statements.some(({ statement }) => /INSERT INTO SOLICITUDES[23]/.test(statement)));
});

test("cambia el estado de una solicitud en curso y registra el usuario", async () => {
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
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(statement) {
      statements.push({ statement, values: { ...this.values } });
      if (/FROM SOLICITUDES1 WITH/.test(statement)) return { recordset: [{ SolNum: 200, SolEstado: 0 }] };
      if (/FROM TEMP01 WITH/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
      return { rowsAffected: [1] };
    },
  });
  const result = await cambiarEstadoSolicitud(1, "MANDRADE", 200, 1, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });
  assert.deepEqual(result, { solNum: 200, status: 1, statusLabel: "Aprobada" });
  assert.equal(transaction.committed, true);
  assert.ok(
    statements.some(
      ({ statement, values }) => /SET SolEstado=1,SollogAP=@Login/.test(statement) && values.Login === "MANDRADE",
    ),
  );
});

test("registra la auditoría de rechazo al cambiar el estado", async () => {
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
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(statement) {
      statements.push({ statement, values: { ...this.values } });
      if (/FROM SOLICITUDES1 WITH/.test(statement)) return { recordset: [{ SolNum: 201, SolEstado: 0 }] };
      if (/FROM TEMP01 WITH/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
      return { rowsAffected: [1] };
    },
  });
  const result = await cambiarEstadoSolicitud(1, "MANDRADE", 201, 2, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });
  assert.deepEqual(result, { solNum: 201, status: 2, statusLabel: "Rechazada" });
  assert.equal(transaction.committed, true);
  assert.ok(
    statements.some(
      ({ statement, values }) => /SET SolEstado=2,SollogRE=@Login/.test(statement) && values.Login === "MANDRADE",
    ),
  );
});

test("agrega un solo folio desde el detalle y recalcula la cabecera", async () => {
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
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(statement) {
      statements.push(statement);
      if (/FROM TEMP01 WITH/.test(statement))
        return { recordset: [{ tempCod: "2017-2018" }] };
      if (/FROM SOLICITUDES1 WITH/.test(statement))
        return {
          recordsets: [
            [{ SolNum: 200, solespe: 1, SolEstado: 0 }],
            [{ existingCount: 0 }],
          ],
        };
      if (/FROM FOLIOSPROC h WITH/.test(statement)) {
        return {
          recordsets: [
            [
              {
                FPFolio: "0000000073",
                FPEspe: 1,
                TAlCod: 2,
                TBPCod: 3,
                TEtCod: 4,
                totalBoxes: 10,
                totalKilos: 50,
              },
            ],
            [
              {
                FP2Cor: 1,
                FP2Fecha: new Date("2026-10-01"),
                ProdCod: "P001",
                fp2especod: 1,
                fp2varcod: 3,
                EnvCod: 2,
                Catcod: 1,
                Calibre: "XL",
                Fp2Tipo: 0,
                FP2Cajas: 10,
                FP2Kilos: 50,
                CuarCod: 0,
              },
            ],
          ],
        };
      }
      return { recordset: [] };
    },
  });
  const result = await addFolioToSolicitud(1, 200, "73", {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });
  assert.equal(result.folio, "0000000073");
  assert.equal(transaction.committed, true);
  assert.ok(
    statements.some((statement) => /INSERT INTO SOLICITUDES2/.test(statement)),
  );
  assert.ok(
    statements.some((statement) => /INSERT INTO SOLICITUDES3/.test(statement)),
  );
  const sol2Insert = statements.find((statement) =>
    /INSERT INTO SOLICITUDES2/.test(statement),
  );
  const sol3Insert = statements.find((statement) =>
    /INSERT INTO SOLICITUDES3/.test(statement),
  );
  assert.match(sol2Insert, /0,@Boxes,@Kilos,0,0,@Boxes,@Kilos,0/);
  assert.match(sol3Insert, /@Boxes,@Kilos,0,0,@Boxes,@Kilos,@Orchard/);
  assert.ok(statements.some((statement) => /UPDATE h SET/.test(statement)));
});

test("asigna correlativos únicos al asociar un folio con detalles históricos repetidos", async () => {
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
  const requestFactory = () => {
    const inputs = {};
    return {
      input(name, _type, value) {
        inputs[name] = value;
        return this;
      },
      async query(statement) {
        statements.push({ statement, inputs: { ...inputs } });
        if (/SELECT TOP 1 RTRIM\(TempCod\)/.test(statement)) {
          return { recordset: [{ tempCod: "2017-2018" }] };
        }
        if (/SELECT TOP 1 SolNum,solespe,SolEstado/.test(statement)) {
          return { recordsets: [[{ SolNum: 207, solespe: 1, SolEstado: 0 }], [{ existingCount: 0 }]] };
        }
        if (/FROM FOLIOSPROC h WITH/.test(statement)) {
          return {
            recordsets: [
              [{ FPFolio: "0015626737", FPEspe: 1, TAlCod: 2, TBPCod: 3, TEtCod: 4, totalBoxes: 22, totalKilos: 338 }],
              [
                { FP2Cor: 1, FP2Fecha: new Date("2017-12-01"), ProdCod: "P001", fp2especod: 1, fp2varcod: 3, EnvCod: 2, Catcod: 1, Calibre: "XL", Fp2Tipo: 0, FP2Cajas: 10, FP2Kilos: 150, CuarCod: 0 },
                { FP2Cor: 1, FP2Fecha: new Date("2017-12-02"), ProdCod: "P002", fp2especod: 1, fp2varcod: 3, EnvCod: 2, Catcod: 1, Calibre: "L", Fp2Tipo: 0, FP2Cajas: 12, FP2Kilos: 188, CuarCod: 0 },
              ],
            ],
          };
        }
        return { recordset: [] };
      },
    };
  };

  await addFolioToSolicitud(1, 207, "0015626737", {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });

  const correlations = statements
    .filter(({ statement }) => /INSERT INTO SOLICITUDES3/.test(statement))
    .map(({ inputs }) => inputs.Corr);
  assert.deepEqual(correlations, [1, 2]);
  assert.equal(transaction.committed, true);
});

test("traduce el duplicado de SOLICITUDES3 a un mensaje funcional", async () => {
  const transaction = {
    async begin() {},
    async commit() {},
    async rollback() {
      this.rolledBack = true;
    },
  };
  const requestFactory = () => ({
    input() {
      return this;
    },
    async query(statement) {
      if (/FROM TEMP01 WITH/.test(statement))
        return { recordset: [{ tempCod: "2017-2018" }] };
      if (/FROM SOLICITUDES1 WITH/.test(statement))
        return {
          recordsets: [
            [{ SolNum: 206, solespe: 1, SolEstado: 0 }],
            [{ existingCount: 0 }],
          ],
        };
      if (/FROM FOLIOSPROC h WITH/.test(statement))
        return {
          recordsets: [
            [
              {
                FPFolio: "0000066656",
                FPEspe: 1,
                TAlCod: 2,
                TBPCod: 3,
                TEtCod: 4,
                totalBoxes: 10,
                totalKilos: 50,
              },
            ],
            [
              {
                FP2Cor: 1,
                FP2Fecha: new Date("2026-10-01"),
                ProdCod: "P001",
                fp2especod: 1,
                fp2varcod: 3,
                EnvCod: 2,
                Catcod: 1,
                Calibre: "XL",
                Fp2Tipo: 0,
                FP2Cajas: 10,
                FP2Kilos: 50,
                CuarCod: 0,
              },
            ],
          ],
        };
      if (/INSERT INTO SOLICITUDES3/.test(statement)) {
        const error = new Error(
          "Violation of PRIMARY KEY constraint 'PK__SOLICITUDES3__07C12930'. Cannot insert duplicate key in object 'dbo.SOLICITUDES3'. The duplicate key value is (1, 2017-2018, 206, 0000066656, 1).",
        );
        error.number = 2627;
        throw error;
      }
      return { recordset: [] };
    },
  });

  await assert.rejects(
    () =>
      addFolioToSolicitud(1, 206, "0000066656", {
        poolProvider: async () => ({}),
        transactionFactory: () => transaction,
        requestFactory,
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "FOLIO_DETAIL_DUPLICATE");
      assert.match(error.message, /0000066656/);
      assert.match(error.message, /correlativo de detalle 1/);
      assert.match(error.message, /corrija la duplicidad/);
      assert.equal(transaction.rolledBack, true);
      return true;
    },
  );
});

test("quita un folio de una solicitud en curso y libera sus cantidades disponibles", async () => {
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
      if (/SELECT TOP 1 RTRIM\(TempCod\)/.test(statement)) {
        return { recordset: [{ tempCod: "2026" }] };
      }
      if (/SELECT TOP 1 SolNum,SolEstado FROM SOLICITUDES1/.test(statement)) {
        return {
          recordsets: [
            [{ SolNum: 12, SolEstado: 0 }],
            [{ Sol2Folio: "0000000073", Sol2Dispo: 0, Sol2CajasDes: 10, Sol2KilosDes: 50 }],
          ],
        };
      }
      if (/SELECT TOP 1 FPFolio,FPIns,FPDisponible/.test(statement)) {
        return {
          recordset: [
            {
              FPFolio: "0000000073",
              FPIns: 1,
              FPDisponible: 0,
              FPDesOri: 0,
              FPDesOT: 0,
              FPDesUsda: 0,
            },
          ],
        };
      }
      return { rowsAffected: [1] };
    },
  });

  const result = await removeFolioFromSolicitud(1, 12, "73", {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });

  assert.equal(result.folio, "0000000073");
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /DELETE FROM SOLICITUDES3/.test(statement)));
  assert.ok(statements.some((statement) => /DELETE FROM SOLICITUDES2/.test(statement)));
  assert.ok(statements.some((statement) => /FPDisponible=1,FPIns=0/.test(statement)));
  assert.ok(statements.some((statement) => /UPDATE h SET/.test(statement)));
});

test("rechaza quitar un folio de una solicitud que no está en curso", async () => {
  const transaction = {
    async begin() {},
    async commit() {},
    async rollback() {
      this.rolledBack = true;
    },
  };
  const requestFactory = () => ({
    input() {
      return this;
    },
    async query(statement) {
      if (/SELECT TOP 1 RTRIM\(TempCod\)/.test(statement)) {
        return { recordset: [{ tempCod: "2026" }] };
      }
      return { recordsets: [[{ SolNum: 12, SolEstado: 1 }], []] };
    },
  });

  await assert.rejects(
    () =>
      removeFolioFromSolicitud(1, 12, "73", {
        poolProvider: async () => ({}),
        transactionFactory: () => transaction,
        requestFactory,
      }),
    (error) => error.code === "SOLICITUD_LOCKED" && transaction.rolledBack === true,
  );
});

test("anula una solicitud en curso sin folios asociados", async () => {
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
      if (/SELECT TOP 1 SolNum,SolEstado/.test(statement)) {
        return { recordsets: [[{ SolNum: 12, SolEstado: 0 }], [], []] };
      }
      return { rowsAffected: [1] };
    },
  });

  const result = await anularSolicitud(1, 12, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });

  assert.equal(result.status, 5);
  assert.equal(transaction.committed, true);
  assert.match(statements.at(-1), /UPDATE SOLICITUDES1 SET SolEstado=5/);
});

test("anula una solicitud y libera folios con cantidades disponibles para despacho", async () => {
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
      if (/SELECT TOP 1 SolNum,SolEstado/.test(statement)) {
        return {
          recordsets: [
            [{ SolNum: 12, SolEstado: 0 }],
            [{ Sol2Folio: "0000000073", Sol2Dispo: 0, Sol2CajasDes: 10, Sol2KilosDes: 50 }],
            [{ FPFolio: "0000000073", FPIns: 1, FPDisponible: 0, FPDesOri: 0, FPDesOT: 0, FPDesUsda: 0 }],
          ],
        };
      }
      return { rowsAffected: [1] };
    },
  });

  const result = await anularSolicitud(1, 12, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });

  assert.equal(result.status, 5);
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /UPDATE f SET FPDisponible=1,FPIns=0/.test(statement)));
  assert.ok(statements.some((statement) => /DELETE FROM SOLICITUDES3/.test(statement)));
  assert.ok(statements.some((statement) => /DELETE FROM SOLICITUDES2/.test(statement)));
  assert.match(statements.at(-1), /UPDATE SOLICITUDES1 SET SolEstado=5/);
});

test("genera el PDF de una solicitud en cualquier estado con el formato carta vertical", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(statement) {
          if (/FROM SOLICITUDES1 h/.test(statement)) {
            return {
              recordsets: [
                [
                  {
                    SolNum: 45,
                    SolnumI: 123,
                    requestDate: "2026-10-02",
                    speciesCode: 1,
                    speciesName: "Cerezas",
                    destinationCode: 1,
                    destinationName: "Exportación",
                    applicant: "MANDRADE",
                    approvedDestinations: "USA",
                    status: 2,
                    totalBoxes: 12,
                    totalKilos: 60,
                    totalPallets: 1,
                  },
                ],
                [
                  { folio: "0000000123", speciesName: "Cerezas", totalBoxes: 12, totalKilos: 60, dispatched: 0 },
                ],
                [
                  {
                    folio: "0000000123",
                    movementDate: "2026-10-01",
                    producerName: "Productor",
                    varietyName: "Santina",
                    containerName: "C2.5K",
                    categoryName: "MM2G",
                    caliber: "0XLD",
                    boxes: 12,
                    kilos: 60,
                    orchard: 7,
                  },
                ],
              ],
            };
          }
          return {
            recordsets: [[{ companyName: "Empresa de prueba" }], [{ tempCod: "2017-2018" }], [{ swCuartel: 1 }]],
          };
        },
      };
    },
  };
  const file = await generateSolicitudPdf(1, 45, { poolProvider: async () => pool });
  assert.equal(file.filename, "Solicitud_0000000123.pdf");
  assert.equal(file.content.subarray(0, 4).toString("ascii"), "%PDF");
  assert.match(file.content.toString("latin1"), /612 792/);
});

test("expone aprobación, rechazo y cajas por rango en el detalle de la solicitud", async () => {
  let statement = "";
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(sqlText) {
          statement = sqlText;
          return {
            recordsets: [
              [
                {
                  SolNum: 45,
                  SolnumI: 123,
                  requestDate: "2026-10-02",
                  speciesCode: 1,
                  speciesName: "Cerezas",
                  destinationCode: 1,
                  destinationName: "Exportación",
                  applicant: "MANDRADE",
                  approvedDestinations: "USA",
                  approvalLogin: "APROBADOR",
                  approvalDate: "2026-10-03",
                  rejectionLogin: "",
                  rejectionDate: null,
                  status: 1,
                  totalBoxes: 12,
                  totalKilos: 60,
                  totalPallets: 1,
                  boxesA: 12,
                  boxesB: 0,
                  boxesC: 0,
                },
              ],
              [],
              [],
            ],
          };
        },
      };
    },
  };
  const result = await getSolicitudDetalle(1, 45, { poolProvider: async () => pool });
  assert.match(statement, /SollogAP.*SolFecAP.*SollogRE.*SolFecRE/s);
  assert.deepEqual(
    {
      approvalLogin: result.header.approvalLogin,
      approvalDate: result.header.approvalDate,
      rejectionLogin: result.header.rejectionLogin,
      rejectionDate: result.header.rejectionDate,
      boxesA: result.header.boxesA,
      boxesB: result.header.boxesB,
      boxesC: result.header.boxesC,
    },
    {
      approvalLogin: "APROBADOR",
      approvalDate: "2026-10-03",
      rejectionLogin: "",
      rejectionDate: null,
      boxesA: 12,
      boxesB: 0,
      boxesC: 0,
    },
  );
});

test("genera un PDF carta vertical combinando carátula y detalle GeneXus", async () => {
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(statement) {
          if (/FROM SOLICITUDES1 h/.test(statement)) {
            return {
              recordsets: [
                [
                  {
                    SolNum: 45,
                    SolnumI: 123,
                    requestDate: "2026-10-02",
                    speciesCode: 1,
                    speciesName: "Cerezas",
                    destinationCode: 1,
                    destinationName: "Exportación",
                    applicant: "MANDRADE",
                    approvedDestinations: "USA",
                    status: 1,
                    totalBoxes: 12,
                    totalKilos: 60,
                    totalPallets: 1,
                    boxesA: 12,
                    boxesB: 0,
                    boxesC: 0,
                  },
                ],
                [{ folio: "0000000123", speciesName: "Cerezas", totalBoxes: 12, totalKilos: 60, dispatched: 0 }],
                [
                  {
                    folio: "0000000123",
                    movementDate: "2026-10-01",
                    producerSagCode: "CSG-1",
                    producerCode: "P1",
                    producerName: "Productor",
                    producerProvince: "O'Higgins",
                    producerCommune: "Rengo",
                    speciesName: "Cerezas",
                    varietyName: "Santina",
                    caliber: "0XLD",
                    boxes: 12,
                    kilos: 60,
                    type: 1,
                    orchard: 7,
                    orchardName: "Cuartel 7",
                  },
                ],
              ],
            };
          }
          return {
            recordsets: [
              [{ companyName: "Empresa de prueba", companyRegion: "O'Higgins" }],
              [{ tempCod: "2017-2018" }],
              [{ swCuartel: 1 }],
            ],
          };
        },
      };
    },
  };
  const file = await generateSolicitudPdf(1, 45, { poolProvider: async () => pool });
  assert.equal(file.filename, "Solicitud_0000000123.pdf");
  assert.equal(file.content.subarray(0, 4).toString("ascii"), "%PDF");
  assert.match(file.content.toString("latin1"), /PDFKit/);
});

test("mantiene el PDF combinado carta vertical sin páginas vacías con más de 14 folios", async () => {
  const folios = Array.from({ length: 21 }, (_, index) => ({
    folio: String(index + 1).padStart(10, "0"),
    speciesName: "Cerezas",
    totalBoxes: 10,
    totalKilos: 50,
    dispatched: 0,
  }));
  const details = folios.map((row, index) => ({
    ...row,
    movementDate: "2026-10-01",
    producerName: "Productor",
    varietyName: "Santina",
    containerName: "C2.5K",
    categoryName: "MM2G",
    caliber: "0XLD",
    boxes: 10,
    kilos: 50,
    orchard: index + 1,
  }));
  const content = await renderSolicitudPdf({
    header: {
      SolnumI: 8,
      companyName: "LA VIÑA S.A.",
      tempCod: "2017-2018",
      status: 1,
      statusLabel: "Aprobada",
      requestDate: "2026-10-01",
      speciesCode: 1,
      speciesName: "Cerezas",
      destinationCode: 336,
      destinationName: "CHINA",
      applicant: "MANDRADE",
    },
    folios,
    details,
    swCuartel: 1,
  });
  const pageCount = (content.toString("latin1").match(/\/Type \/Page(?!s)/g) || []).length;
  assert.equal(pageCount, 2);
});
