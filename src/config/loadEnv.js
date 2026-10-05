const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..', '..');
const externalEnvKeys = new Set(Object.keys(process.env));
const loadedFiles = [];

const applyEnvFile = (fileName, { overrideFileValues = false } = {}) => {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) return false;

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (externalEnvKeys.has(key)) continue;
    if (overrideFileValues || process.env[key] === undefined) process.env[key] = value;
  }
  loadedFiles.push(filePath);
  return true;
};

const configuredEnvFile = String(process.env.CONEX_ENV_FILE || '').trim();
if (configuredEnvFile) {
  if (!applyEnvFile(configuredEnvFile)) {
    throw new Error(`No existe el archivo de entorno configurado en CONEX_ENV_FILE: ${configuredEnvFile}`);
  }
} else {
  applyEnvFile('.env');
}

const nodeEnv = process.env.NODE_ENV || 'development';
if (!externalEnvKeys.has('NODE_ENV')) process.env.NODE_ENV = nodeEnv;

// Un perfil explícito debe quedar aislado y no heredar secretos desde .env.*.
if (!configuredEnvFile) applyEnvFile(`.env.${nodeEnv}`, { overrideFileValues: true });

module.exports = {
  configuredEnvFile: configuredEnvFile || null,
  loadedFiles,
  nodeEnv: process.env.NODE_ENV,
  rootDir
};
