let globalLogger = null;

export function setGlobalLogger(logger) {
  globalLogger = logger;
}

export function getLogger() {
  if (!globalLogger) {
    // 提供一個默認的 console logger
    return {
      info: console.log, // eslint-disable-line no-undef
      error: console.error, // eslint-disable-line no-undef
      warn: console.warn, // eslint-disable-line no-undef
      debug: console.debug, // eslint-disable-line no-undef
    };
  }
  return globalLogger;
}
