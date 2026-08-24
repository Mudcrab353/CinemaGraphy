/**
 * PM2 process file for VPS (optional).
 * Install: npm i -g pm2
 * Start:   pm2 start ecosystem.config.cjs
 * Save:    pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'cinemagraphy',
      script: 'index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      // Load .env yourself via dotenv or:
      // node_args: '--env-file=.env'
      interpreter_args: '--env-file=.env',
      max_memory_restart: '400M',
      time: true,
    },
  ],
}
