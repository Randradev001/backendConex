const service = require('./impresion.http.service').createImpresionHttpService();

const respond = (handler) => async (req, res, next) => {
  try { return await handler(req, res); }
  catch (error) {
    if (error.status && error.code) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

const printers = respond(async (req, res) => res.json(await service.listPrinters(req.context?.empCod)));
const createPrinter = respond(async (req, res) => res.status(201).json(await service.createPrinter(req.context?.empCod, req.body)));
const updatePrinter = respond(async (req, res) => res.json(await service.updatePrinter(req.context?.empCod, req.params.id, req.body)));
const deletePrinter = respond(async (req, res) => res.json(await service.deletePrinter(req.context?.empCod, req.params.id)));
const printLabelTest = respond(async (req, res) => res.json(await service.printLabelTest(req.context?.empCod, req.body)));
const simulateLine = respond(async (req, res) => res.status(201).json(
  await service.simulateLine(req.context?.empCod, req.params.machine, req.params.line)
));

module.exports = { printers, createPrinter, updatePrinter, deletePrinter, printLabelTest, simulateLine };
