module.exports = {
  apps: [
    {
      name: 'ultrasignalapi-repo',
      script: 'dist/src/app.js',

      // Cluster mode: one worker per CPU core
      instances: 'max',
      exec_mode: 'cluster',

      // Auto-restart if worker exceeds memory limit
      max_memory_restart: '500M',

      // Do not watch files in production
      watch: false,

      // Graceful shutdown timeout (ms)
      kill_timeout: 5000,

      // Wait before restarting a crashed worker
      restart_delay: 1000,

      // Logs
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
