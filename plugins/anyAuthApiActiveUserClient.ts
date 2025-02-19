// plugins/anyAuthApiClient.ts
import { URLSearchParams } from "node:url";
import axios from "axios";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AnyAuthTokenSchema } from "../schemas/anyAuthSchema";

type AnyAuthToken = z.infer<typeof AnyAuthTokenSchema>;

type AxiosInstanceType = ReturnType<typeof axios.create>;

interface AnyAuthApiClientOptions {
  baseURL?: string;
}

interface AnyAuthApiActiveUserClient extends AxiosInstanceType {
  state: any;
  getAndRefreshIfExpiredUserTokenFromCache(
    sessionId: string
  ): Promise<AnyAuthToken | null>;
}

export default fp(async function (
  fastify: FastifyInstance,
  options: AnyAuthApiClientOptions
) {
  // Initialize the instance and assert it to our custom interface
  const anyAuthApiActiveUserClient = axios.create({
    baseURL: options.baseURL || "http://127.0.0.1:8000",
    headers: {
      "Content-Type": "application/json",
    },
  }) as AnyAuthApiActiveUserClient;

  // Initialize the state property
  anyAuthApiActiveUserClient.state = {};

  /**
   * Get a user token from the cache.
   *
   * @param {string} sessionId - The session identifier.
   * @returns {import("zod").infer<typeof AnyAuthTokenSchema> | null} - Token data matching the AnyAuthTokenSchema, or null if not found.
   */
  anyAuthApiActiveUserClient.getAndRefreshIfExpiredUserTokenFromCache =
    async function (sessionId: string) {
      const token = fastify.userTokenCache.getUserTokenFromCache(sessionId);
      if (token === null) return null;
      if (token.isTokenExpired()) {
        try {
          const params = new URLSearchParams();
          params.append("grant_type", "refresh_token");
          params.append("refresh_token", token.refresh_token);
          const refreshedToken = await anyAuthApiActiveUserClient.post(
            "/refresh-token",
            params,
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );
          fastify.userTokenCache.saveUserTokenToCache(
            sessionId,
            refreshedToken
          );
          return refreshedToken;
        } catch (error) {
          fastify.log.error(
            `Failed to refresh token from cache: ${JSON.stringify(error)}`
          );
          return null;
        }
      }
      return token;
    };

  // Decorate anyAuthApiServerClient to the Fastify instance for global use
  fastify.decorate("anyAuthApiActiveUserClient", anyAuthApiActiveUserClient);
});
