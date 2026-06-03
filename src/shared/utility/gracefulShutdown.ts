/**
 * gracefulShutdown — installs SIGTERM / SIGINT handlers that drain the
 * HTTP server, close the platform master TypeORM DataSource, then exit.
 * Every step has a deadline so the process can never hang waiting for a
 * stuck request or a wedged DB driver.
 *
 * Shutdown order (matters):
 *   1. httpServer.close()            — stop accepting NEW connections.
 *      In-flight requests keep going so they can finish naturally.
 *   2. httpServer.closeIdleConnections() — drop keep-alive sockets that
 *      have no in-flight request, so step 1 can actually complete (otherwise
 *      browsers / load balancers hold sockets open and close() waits
 *      forever).
 *   3. wait up to DRAIN_TIMEOUT_MS for in-flight requests to finish.
 *   4. httpServer.closeAllConnections() — force-close anything still
 *      active. The requests get a network error; better than hanging.
 *   5. AppDataSource.destroy()       — close the single platform DB.
 *   6. process.exit(0)
 *
 * The platform now runs against a single AppDataSource — there are no
 * per-request DataSources to track. The drain window simply gives the
 * in-flight HTTP requests time to finish before we tear down.
 *
 * HARD_DEADLINE_MS is a watchdog: if the entire sequence is not done by
 * then, we exit(1) so the process can never hang. PID 1 in a container
 * MUST eventually exit on SIGTERM, otherwise kubelet/docker escalates to
 * SIGKILL and the next graceful step never runs.
 *
 * Idempotency: signals are unregistered after the first one fires so a
 * double Ctrl-C doesn't re-enter the sequence mid-flight. A second
 * signal during shutdown forces an immediate exit.
 */
import { Server as HttpServer } from 'http';
import { DataSource } from 'typeorm';
import Logger from './logger/logger';

const DRAIN_TIMEOUT_MS = 10_000; // wait for in-flight requests
const HARD_DEADLINE_MS = 20_000; // overall watchdog
const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

interface ShutdownTargets {
  httpServer: HttpServer;
  dataSource: DataSource;
}

let shuttingDown = false;

export function installGracefulShutdown(targets: ShutdownTargets): void {
  const onSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      // Second signal — operator wants out NOW. Don't try to be polite.
      Logger.warn(`Received ${signal} during shutdown — forcing exit`);
      process.exit(1);
    }
    shuttingDown = true;
    void runShutdown(signal, targets);
  };

  for (const sig of SIGNALS) {
    process.on(sig, onSignal);
  }
}

async function runShutdown(
  signal: NodeJS.Signals,
  { httpServer, dataSource }: ShutdownTargets,
): Promise<void> {
  Logger.info(`Received ${signal} — starting graceful shutdown`);

  // Watchdog: if anything below wedges, kill the process anyway.
  const watchdog = setTimeout(() => {
    Logger.error(
      `Graceful shutdown exceeded ${HARD_DEADLINE_MS}ms — forcing exit`,
    );
    process.exit(1);
  }, HARD_DEADLINE_MS);
  // Don't keep the event loop alive just for the watchdog.
  watchdog.unref();

  try {
    await drainHttpServer(httpServer);
    await closeMasterDataSource(dataSource);
    Logger.info('Graceful shutdown complete');
    clearTimeout(watchdog);
    process.exit(0);
  } catch (err) {
    Logger.error(`Error during graceful shutdown: ${(err as Error).message}`);
    clearTimeout(watchdog);
    process.exit(1);
  }
}

/**
 * Close the HTTP server in three phases:
 *   1. Stop accepting new connections (close()).
 *   2. Drop idle keep-alive sockets so close() can complete.
 *   3. After DRAIN_TIMEOUT_MS, force-close any still-active sockets.
 *
 * Without step 2, modern browsers + load balancers hold keep-alive
 * sockets open and close() never resolves.
 */
function drainHttpServer(httpServer: HttpServer): Promise<void> {
  return new Promise<void>(resolve => {
    Logger.info('HTTP: refusing new connections');
    httpServer.close(err => {
      if (err) {
        Logger.warn(`HTTP server.close() reported: ${err.message}`);
      } else {
        Logger.info('HTTP: server closed cleanly');
      }
      resolve();
    });

    // Free up idle keep-alive sockets so close() can resolve.
    if (typeof httpServer.closeIdleConnections === 'function') {
      httpServer.closeIdleConnections();
    }

    // Force-close anything still active after the drain window.
    setTimeout(() => {
      if (typeof httpServer.closeAllConnections === 'function') {
        Logger.warn(
          `HTTP: ${DRAIN_TIMEOUT_MS}ms drain elapsed — force-closing active connections`,
        );
        httpServer.closeAllConnections();
      }
    }, DRAIN_TIMEOUT_MS).unref();
  });
}

async function closeMasterDataSource(dataSource: DataSource): Promise<void> {
  if (!dataSource.isInitialized) {
    Logger.info('Master DB: not initialized — skipping close');
    return;
  }
  try {
    await dataSource.destroy();
    Logger.info('Master DB: connection closed');
  } catch (err) {
    Logger.warn(`Master DB close failed: ${(err as Error).message}`);
  }
}
