// lib/debug.ts
// Conditional debug logging utility
// In production, only errors are logged. In development, all logs are shown.

const DEBUG = process.env.NODE_ENV === 'development';

export const debug = {
  /**
   * Log informational messages (disabled in production)
   */
  log: DEBUG ? console.log.bind(console) : () => {},

  /**
   * Log warnings (disabled in production)
   */
  warn: DEBUG ? console.warn.bind(console) : () => {},

  /**
   * Log errors (always enabled, even in production)
   */
  error: console.error.bind(console),

  /**
   * Start a console group (disabled in production)
   */
  group: DEBUG ? console.group.bind(console) : () => {},

  /**
   * End a console group (disabled in production)
   */
  groupEnd: DEBUG ? console.groupEnd.bind(console) : () => {},

  /**
   * Log tables (disabled in production)
   */
  table: DEBUG ? console.table.bind(console) : () => {},
};

/**
 * Helper to create namespaced loggers
 * Usage: const log = createLogger('[MyComponent]');
 *        log.info('Something happened');
 */
export function createLogger(namespace: string) {
  return {
    info: (...args: any[]) => debug.log(namespace, ...args),
    warn: (...args: any[]) => debug.warn(namespace, ...args),
    error: (...args: any[]) => debug.error(namespace, ...args),
    group: (label: string) => debug.group(`${namespace} ${label}`),
    groupEnd: () => debug.groupEnd(),
  };
}
