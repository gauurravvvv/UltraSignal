import { Logger } from 'typeorm';
import WinstonLogger from './logger';

class CustomLogger implements Logger {
  logQuery(query: string, parameters: any) {
    WinstonLogger.info(`Query: ${query}`);
    if (parameters) {
      console.table(parameters);
    }
  }

  logQueryError(error: string, query: string) {
    WinstonLogger.error(`Query Error: ${query}`);
    WinstonLogger.error(error);
  }

  logQuerySlow(time: number, query: string) {
    WinstonLogger.warn(`Query Slow: ${query}`);
    WinstonLogger.warn(`Execution Time: ${time} ms`);
  }

  logSchemaBuild(message: string) {
    WinstonLogger.debug(`Schema Build: ${message}`);
  }

  logMigration(message: string) {
    WinstonLogger.debug(`Migration: ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: any) {
    WinstonLogger.log(level, message);
  }
}

export default CustomLogger;
