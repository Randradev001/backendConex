const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, KEY_LENGTH);
  return { salt, hash: key.toString('hex') };
};

const verifyPassword = async (password, salt, expectedHash) => {
  const actual = await scrypt(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const createSessionToken = () => crypto.randomBytes(32).toString('base64url');
const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { hashPassword, verifyPassword, createSessionToken, hashSessionToken };
