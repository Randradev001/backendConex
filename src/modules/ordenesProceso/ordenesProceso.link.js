const crypto = require('crypto');

const VERSION = 1;
const AAD = Buffer.from('conex:ordenes-proceso:url:v1', 'utf8');
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

class OrdenesProcesoLinkError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const keyForSession = (sessionToken) => {
  if (!sessionToken) throw new OrdenesProcesoLinkError('ORDER_LINK_SESSION_REQUIRED', 'La sesión no permite crear un enlace seguro.');
  return crypto.createHash('sha256').update(`ordenes-proceso:${sessionToken}`, 'utf8').digest();
};

const createOrderLink = ({ sessionToken, empCod, login, tempCod, ordpnum, now = Date.now(), ttlMs = DEFAULT_TTL_MS }) => {
  const season = String(tempCod || '').trim();
  const order = Number(ordpnum);
  if (!season || !Number.isInteger(order) || order <= 0) {
    throw new OrdenesProcesoLinkError('ORDER_LINK_INVALID_ORDER', 'La orden y la temporada son obligatorias.');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyForSession(sessionToken), iv);
  cipher.setAAD(AAD);
  const payload = Buffer.from(
    JSON.stringify({ v: VERSION, empCod: Number(empCod), login: String(login || '').trim(), tempCod: season, ordpnum: order, exp: now + ttlMs }),
    'utf8'
  );
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
};

const resolveOrderLink = ({ sessionToken, empCod, login, ref, now = Date.now() }) => {
  try {
    const packed = Buffer.from(String(ref || ''), 'base64url');
    if (packed.length < 29) throw new Error('invalid payload');
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyForSession(sessionToken), iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const data = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
    const sameContext = data.v === VERSION && Number(data.empCod) === Number(empCod) && String(data.login) === String(login || '').trim();
    if (!sameContext || !data.tempCod || !Number.isInteger(Number(data.ordpnum))) throw new Error('invalid context');
    if (!Number.isFinite(Number(data.exp)) || Number(data.exp) < now) {
      throw new OrdenesProcesoLinkError('ORDER_LINK_EXPIRED', 'El enlace seguro de la orden expiró. Vuelva a seleccionar la orden.');
    }
    return { tempCod: String(data.tempCod).trim(), ordpnum: Number(data.ordpnum) };
  } catch (error) {
    if (error instanceof OrdenesProcesoLinkError) throw error;
    throw new OrdenesProcesoLinkError('ORDER_LINK_INVALID', 'El enlace seguro de la orden no es válido para esta sesión.');
  }
};

module.exports = { OrdenesProcesoLinkError, createOrderLink, resolveOrderLink };
