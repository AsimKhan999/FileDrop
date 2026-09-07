module.exports = {
  apps: [
    {
      name: "filedrop-api",
      script: "node_modules/.bin/tsx",
      args: "src/server.ts",
      cwd: "./apps/api",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      max_memory_restart: "500M",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
