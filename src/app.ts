import 'reflect-metadata';
import { SERVER_PORT } from '../config/config';
import Server from './server';
import { AppDataSource } from './shared/db';
import { getErrorMessage } from './shared/utility/getErrorMessage';
import { installGracefulShutdown } from './shared/utility/gracefulShutdown';
import Logger from './shared/utility/logger/logger';

// Catch unhandled promise rejections — prevents silent worker crashes
process.on('unhandledRejection', (reason: any) => {
  Logger.error(`Unhandled Promise Rejection: ${reason?.message || reason}`);
});

// Catch uncaught exceptions — log then exit so PM2 can restart the worker
process.on('uncaughtException', (error: Error) => {
  Logger.error(`Uncaught Exception: ${getErrorMessage(error)}`);
  process.exit(1);
});

// Create an instance of the server
const serverInstance = new Server();

// Connect to database first, then start HTTP server
serverInstance
  .connectDatabase()
  .then(() => serverInstance.start(SERVER_PORT))
  .then(() => {
    console.log('\n');
    console.log(
      '───────────────────────────────────────────────────────────────────',
    );
    console.log(
      '                       🚀 UltraSignal Server',
    );
    console.log(
      '───────────────────────────────────────────────────────────────────',
    );
    console.log(`  ✨ Status: ${'\x1b[32m'}ONLINE${'\x1b[0m'}`);
    console.log(`  🌐 Port: ${SERVER_PORT}`);
    console.log('  💻 Environment: Development');
    console.log('  🛠️  Purpose: Main API Server');
    console.log('  🎉 Welcome Developer! Happy Coding!');
    console.log(
      '───────────────────────────────────────────────────────────────────',
    );
    console.log('\n');

    Logger.info(`Main server successfully started on port ${SERVER_PORT}`);

    // Install SIGTERM/SIGINT handlers AFTER the server is up so the
    // shutdown path can find a live httpServer + initialized DataSource.
    installGracefulShutdown({
      httpServer: serverInstance.getHttpServer(),
      dataSource: AppDataSource,
    });
  })
  .catch(error => {
    console.log('\n');
    console.log(
      '───────────────────────────────────────────────────────────────────',
    );
    console.log(
      '                       🚀 UltraSignal Server',
    );
    console.log(
      '───────────────────────────────────────────────────────────────────',
    );
    console.log(`  ❌ Status: ${'\x1b[31m'}FAILED${'\x1b[0m'}`);
    console.log('  💥 Failed to start Main Server');
    console.log(
      '───────────────────────────────────────────────────────────────────',
    );
    console.log('\n');

    Logger.error(`Main server failed to start: ${error}`);
  });

export default serverInstance;
