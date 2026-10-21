const test = require("node:test");
const assert = require("node:assert/strict");
const {
  permission,
  defaultRange,
  listFilters,
  listProcesos,
  listAvailableProcessFolios,
  checkProcesoDisponible,
  getProcesoPdfData,
  generateProcesoUSDAPdf,
  changeStatus,
  anularProceso,
  statusLabel,
} = require("../src/modules/procesosUSDA/procesosUSDA.service");

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

test("usa el permiso y las condiciones de ProcesosUSDA", () => {
  assert.deepEqual(permission, { sistema: 100, modulo: 20, programa: 10 });
  assert.deepEqual(defaultRange(new Date("2026-10-01T12:00:00")), {
    from: "2026-08-02",
    to: "2026-10-01",
  });
  assert.deepEqual(
    listFilters({
      from: "02/10/2026",
      to: "06/10/2026",
      type: "3",
      status: "2",
      species: "17",
      processNumber: "8",
      page: "2",
      pageSize: "50",
    }),
    {
      from: "2026-10-02",
      to: "2026-10-06",
      type: 3,
      status: 2,
      species: 17,
      processNumber: 8,
      search: "",
      all: false,
      page: 2,
      pageSize: 50,
    },
  );
  assert.equal(statusLabel(0), "En Proceso");
  assert.equal(statusLabel(1), "Aprobado");
  assert.equal(statusLabel(2), "Rechazado");
  assert.equal(statusLabel(3), "Anulado");
  assert.equal(listFilters({ processNumber: "9999999999" }).processNumber, 9999999999);
  assert.throws(() => listFilters({ processNumber: "10000000000" }), /número de proceso/);
  assert.throws(() => listFilters({ type: 1 }), /tipo de proceso/);
  assert.throws(() => listFilters({ type: 4 }), /tipo de proceso/);
});

test("lista los procesos USDA con los filtros visibles y la temporada activa", async () => {
  let statement = "";
  const result = await listProcesos(
    1,
    { from: "2026-10-01", to: "2026-10-06", type: 2, status: 9, species: 0, processNumber: 0 },
    {
      poolProvider: async () =>
        poolFrom(
          {
            recordsets: [
              [
                {
                  processType: 2,
                  processNumber: 44,
                  processDate: "2026-10-06",
                  totalBoxes: 12,
                  totalKilos: 60,
                  totalPallets: 2,
                  status: 0,
                  speciesName: "Cerezas",
                },
              ],
              [{ total: 1, totalBoxes: 12, totalKilos: 60, totalPallets: 2 }],
              [{ tempCod: "2017-2018" }],
            ],
          },
          (sqlText) => {
            statement = sqlText;
          },
        ),
    },
  );
  assert.equal(result.rows[0].id, "2-44");
  assert.equal(result.rows[0].processTypeLabel, "Fumigación");
  assert.deepEqual(result.totals, { boxes: 12, kilos: 60, pallets: 2 });
  assert.equal(result.tempCod, "2017-2018");
  assert.match(statement, /h\.EmpCod=@EmpCod AND h\.TempCod=@TempCod/);
  assert.match(statement, /\(@Type=9 OR h\.PUSTipo=@Type\)/);
  assert.match(statement, /@From IS NULL OR h\.PUSFecha>=@From/);
  assert.match(statement, /@To IS NULL OR h\.PUSFecha<DATEADD\(day,1,@To\)/);
  assert.match(statement, /\(@Status=9 OR h\.PUSEstado=@Status\)/);
  assert.match(statement, /\(@Species=0 OR h\.PUSEspe=@Species\)/);
});

test("lista folios disponibles con las condiciones exactas de AgrFol_ProcUS", async () => {
  const statements = [];
  const result = await listAvailableProcessFolios(
    1,
    2,
    44,
    { folio: "", species: 0 },
    {
      poolProvider: async () => ({
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
      }),
    },
  );
  assert.deepEqual(result.rows, []);
  const statement = statements.at(-1);
  assert.match(statement, /h\.FPEstado=10/);
  assert.match(statement, /h\.FPDisponible=1/);
  assert.match(statement, /\(@Folio='' OR RTRIM\(h\.FPFolio\)=RTRIM\(@Folio\)\)/);
  assert.match(statement, /\(@Species=0 OR h\.FPEspe=@Species\)/);
  assert.doesNotMatch(statement, /PROCUSDA1/);
});

test("verifica inmediatamente la disponibilidad del número por tipo y temporada", async () => {
  const statements = [];
  let queryNumber = 0;
  const result = await checkProcesoDisponible(1, 2, 44, {
    poolProvider: async () => ({
      request() {
        return {
          input() {
            return this;
          },
          async query(statement) {
            statements.push(statement);
            queryNumber += 1;
            if (queryNumber === 1) return { recordset: [{ tempCod: "2017-2018" }] };
            return { recordset: [{ PUSNum: 44 }] };
          },
        };
      },
    }),
  });
  assert.deepEqual(result, {
    available: false,
    processType: 2,
    processNumber: 44,
    tempCod: "2017-2018",
  });
  assert.match(statements[0], /FROM TEMP01/);
  assert.match(statements[1], /PUSTipo=@Type AND PUSNum=@ProcessNumber/);
});

test("EstadoUS actualiza el encabezado y libera los folios al rechazar", async () => {
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
      if (/FROM PROCUSDA WITH/.test(statement)) return { recordset: [{ PUSEstado: 1 }] };
      return { rowsAffected: [1] };
    },
  });
  const result = await changeStatus(1, "DANNY", 3, 44, 2, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });
  assert.deepEqual(result, {
    processType: 3,
    processNumber: 44,
    status: 2,
    statusLabel: "Rechazado",
    releasedFolios: true,
  });
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /UPDATE PROCUSDA\s+SET PUSEstado=@Status/s.test(statement)));
  assert.ok(statements.some((statement) => /UPDATE f\s+SET f\.FPDisponible=1,f\.FPIns=0/s.test(statement)));
  assert.ok(statements.some((statement) => /DELETE FROM PROCUSDA2/s.test(statement)));
  assert.ok(statements.some((statement) => /DELETE FROM PROCUSDA1/s.test(statement)));
});

test("EstadoUS no permite un proceso ajeno a los tipos USDA", async () => {
  await assert.rejects(
    () => changeStatus(1, "DANNY", 1, 44, 2, { poolProvider: async () => ({}) }),
    (error) => error.code === "VALIDATION_ERROR" && /Fumigación o Muestreo/.test(error.message),
  );
});

test("Anular usa PUSEstado 3 y permanece separado de Rechazado", async () => {
  const statements = [];
  const transaction = {
    async begin() {},
    async commit() {
      this.committed = true;
    },
    async rollback() {},
  };
  const requestFactory = () => ({
    input() {
      return this;
    },
    async query(statement) {
      statements.push(statement);
      if (/FROM TEMP01 WITH/.test(statement)) return { recordset: [{ tempCod: "2017-2018" }] };
      if (/FROM PROCUSDA WITH/.test(statement)) return { recordset: [{ PUSEstado: 0 }] };
      return { rowsAffected: [1] };
    },
  });

  await assert.rejects(
    () =>
      changeStatus(1, "DANNY", 2, 45, 3, {
        poolProvider: async () => ({}),
        transactionFactory: () => transaction,
        requestFactory,
      }),
    /estado/i,
  );

  const result = await anularProceso(1, "DANNY", 2, 45, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
  });
  assert.equal(result.status, 3);
  assert.equal(result.statusLabel, "Anulado");
  assert.equal(result.releasedFolios, true);
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /SET PUSEstado=@Status/.test(statement)));
  assert.ok(statements.some((statement) => /FPDisponible=1/.test(statement)));
});

test("el PDF USDA conserva el orden del XPZ y enriquece sus filas", async () => {
  let queryNumber = 0;
  const statements = [];
  const pool = {
    request() {
      return {
        input() {
          return this;
        },
        async query(statement) {
          statements.push(statement);
          queryNumber += 1;
          if (/FROM TEMP01/.test(statement)) {
            return { recordset: [{ tempCod: "2017-2018" }] };
          }
          if (/FROM PROCUSDA h/.test(statement)) {
            return {
              recordsets: [
                [
                  {
                    processType: 2,
                    processNumber: 24,
                    processDate: "2026-10-20",
                    status: 0,
                    speciesCode: 1,
                    speciesName: "Cerezas",
                    totalBoxes: 24,
                    totalKilos: 120,
                    totalFolios: 1,
                    tempCod: "2017-2018",
                  },
                ],
                [{ folio: "0000000123", speciesName: "Cerezas", boxes: 24, kilos: 120 }],
                [{ folio: "0000000123", correlation: 1, boxes: 24, processDate: "2026-10-20" }],
              ],
            };
          }
          return {
            recordsets: [
              [{ companyName: "LA VIÑA S.A.", companyBusiness: "Packing", companyRut: 12345678, companyDv: "9" }],
              [
                {
                  folio: "0000000123",
                  producerCode: "P001",
                  producerName: "Productor Uno",
                  producerCommune: "060109",
                  producerProvince: "Cachapoal",
                  packingName: "Packing Uno",
                  packingCommune: "060109",
                  packingProvince: "Cachapoal",
                  speciesName: "Cerezas",
                  varietyName: "Brooks",
                  detailBoxes: 24,
                  folioBoxes: 24,
                  detailDate: "2026-10-20",
                  producerSagCode: "SAG001",
                },
              ],
            ],
          };
        },
      };
    },
  };

  let renderedData;
  const file = await generateProcesoUSDAPdf(1, 2, 24, {
    poolProvider: async () => pool,
    pdfRenderer: async (data) => {
      renderedData = data;
      return Buffer.from("pdf");
    },
  });

  assert.equal(queryNumber, 3);
  assert.equal(file.filename, "DetalleUSDA_24.pdf");
  assert.equal(renderedData.header.companyName, "LA VIÑA S.A.");
  assert.match(statements.find((statement) => /FROM DEFEMP/.test(statement)), /FROM DEFEMP\s+WHERE EmpCod=@EmpCod/);
  assert.equal(renderedData.details[0].producerName, "Productor Uno");
  assert.equal(renderedData.details[0].varietyName, "Brooks");
  assert.equal(renderedData.details[0].producerSagCode, "SAG001");
});
