const env = {
  NODE_ENV: "production",
  PORT: process.env.PORT || "3000",
  SERVER: process.env.SERVER || "http://localhost:3000",
  DB_SERVER: process.env.DB_SERVER,
  DB_PORT: process.env.DB_PORT,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_INSTANCE: process.env.DB_INSTANCE,
  DB_ENCRYPT: process.env.DB_ENCRYPT || "false",
  DB_TRUST_SERVER_CERTIFICATE: process.env.DB_TRUST_SERVER_CERTIFICATE || "true",
  CORS_ORIGINS: process.env.CORS_ORIGINS || "https://www.conexco.cl",
  RESEND: process.env.RESEND
};

module.exports = {
    apps: [{
      name: "conex-backend",
      cwd: __dirname,
      script: "./index.js",
      env: Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)),
      watch: false,
      max_memory_restart: "300M"
    }]
  };
