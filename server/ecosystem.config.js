// PM2 process definition for the Company Drive API.
// Usage:  pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'company-drive-api',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      // Comfortable for a 2 GB VPS. Streaming uploads/downloads do NOT load
      // files into RAM, so steady-state memory stays well under this.
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
