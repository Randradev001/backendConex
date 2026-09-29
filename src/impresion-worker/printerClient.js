const net = require('node:net');

class PrinterDeliveryError extends Error {
  constructor(message, { uncertain = false, cause } = {}) {
    super(message, { cause });
    this.name = 'PrinterDeliveryError';
    this.uncertain = uncertain;
  }
}

const sendZpl = ({ host, port = 9100, zpl, timeoutMs = 5000 }) => new Promise((resolve, reject) => {
  let connected = false;
  let settled = false;
  const socket = net.createConnection({ host, port: Number(port) });
  const finish = (error) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    if (error) reject(new PrinterDeliveryError(error.message, { uncertain: connected, cause: error }));
    else resolve();
  };

  socket.setTimeout(Number(timeoutMs));
  socket.once('connect', () => {
    connected = true;
    socket.end(Buffer.from(String(zpl), 'utf8'));
  });
  socket.once('timeout', () => finish(new Error(`Timeout enviando a ${host}:${port}.`)));
  socket.once('error', finish);
  socket.once('close', (hadError) => {
    if (!hadError) finish();
  });
});

module.exports = { sendZpl, PrinterDeliveryError };
