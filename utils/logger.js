// utils/logger.js
export class Logger {
  constructor(implementation) {
    this.implementation = implementation;
  }

  info(msg) {
    this.implementation.info(msg);
  }

  error(msg) {
    this.implementation.error(msg);
  }

  warn(msg) {
    this.implementation.warn(msg);
  }

  debug(msg) {
    this.implementation.debug(msg);
  }
}
