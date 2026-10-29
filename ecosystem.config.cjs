// PM2 process file for the self-hosted NEXO website server.
// Usage on the server:  npm ci && npm run build:server && pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'nexo',
      script: 'server/index.mjs',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        // Port 80 makes the site open as http://<server-ip>/ without :8080.
        // Running on port 80 usually requires root (sudo pm2 ...) or a
        // reverse proxy (nginx) in front. Use 8080 + proxy if unsure.
        PORT: 80,
      },
    },
  ],
}
