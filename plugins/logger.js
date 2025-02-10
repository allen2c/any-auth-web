import fp from "fastify-plugin";
import { Logger } from "../utils/logger.js";
import { setGlobalLogger } from "../utils/logger-singleton.js";

// eslint-disable-next-line no-unused-vars
export default fp(async function (fastify, options) {
  // Create a logger instance, using Fastify logger as implementation
  const logger = new Logger({
    info: (msg) => fastify.log.info(msg),
    error: (msg) => fastify.log.error(msg),
    warn: (msg) => fastify.log.warn(msg),
    debug: (msg) => fastify.log.debug(msg),
  });

  // Set the global logger
  setGlobalLogger(logger);

  // Decorate the logger as a global property
  fastify.decorate("logger", logger);
});
