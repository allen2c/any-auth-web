// plugins/userTokenCache.js
import fp from "fastify-plugin";
import flatCache from "flat-cache";
import { AnyAuthTokenSchema } from "./schemas/index.js";

export default fp(async function (fastify, options) {
  const cacheInstance = flatCache.create({
    cacheDir: options.cacheDir || ".cache",
  });

  // Define a userTokenCache instance with cache attribute and helper methods
  const userTokenCache = {
    cache: cacheInstance,
    /**
     * Get a user token from the cache.
     *
     * @param {string} sessionId - The session identifier.
     * @returns {import("zod").infer<typeof AnyAuthTokenSchema> | null} - Token data matching the AnyAuthTokenSchema, or null if not found.
     */
    getUserTokenFromCache(sessionId) {
      const raw = this.cache.getKey(sessionId);
      if (!raw) return null;
      return AnyAuthTokenSchema.parse(JSON.parse(raw));
    },
    /**
     * Save a user token to the cache.
     *
     * @param {string} sessionId - The session identifier.
     * @param {import("zod").infer<typeof AnyAuthTokenSchema>} tokenData - Token data matching the AnyAuthTokenSchema.
     */
    saveUserTokenToCache(sessionId, token) {
      this.cache.setKey(sessionId, JSON.stringify(token));
      this.cache.save();
    },
  };

  // Decorate anyAuthApiServerClient to the Fastify instance for global use
  fastify.decorate("userTokenCache", userTokenCache);
});
