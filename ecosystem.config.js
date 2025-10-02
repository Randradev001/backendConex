module.exports = {
    apps: [{
    name: "nodeEnviomail",
    script: "./src/index.js",
    env: {
    NODE_ENV: "production",
    PORT: "3000"
    },
    max_memory_restart: "300M",
    watch: false
    }]
};