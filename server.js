// server.js
import process from "node:process";
import { URLSearchParams } from "node:url";
import fastifyEnv from "@fastify/env";
import FastifyVite from "@fastify/vite";
import Fastify from "fastify";
import { z } from "zod";
import anyAuthApiActiveUserClientPlugin from "./plugins/anyAuthApiActiveUserClient.js";
import anyAuthApiServerClientPlugin from "./plugins/anyAuthApiServerClient.js";
import { envOptions } from "./plugins/env.js";
import loggerPlugin from "./plugins/logger.js";
import oauthPlugin from "./plugins/oauth.js";
import userTokenCachePlugin from "./plugins/userTokenCache.js";
import { AnyAuthTokenSchema, AnyAuthUserSchema } from "./schemas/index.js";

/**
 * Get a user token from the cache.
 *
 * @param {string} sessionId - The session identifier.
 * @returns {import("zod").infer<typeof AnyAuthTokenSchema> | null} - Token data matching the AnyAuthTokenSchema, or null if not found.
 */
async function getAndRefreshIfExpiredUserTokenFromCache(sessionId) {
  const token = getUserTokenFromCache(sessionId);
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
      saveUserTokenToCache(sessionId, refreshedToken);
      return refreshedToken;
    } catch (error) {
      server.log.error(
        `Failed to refresh token from cache: ${JSON.stringify(error)}`
      );
      return null;
    }
  }
  return token;
}

// Fastify Application
const server = Fastify({
  logger: {
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
});

async function startServer() {
  try {
    await server.register(fastifyEnv, envOptions);
    server.log.info(
      `Runtime Environment: ${JSON.stringify(server.config.NODE_ENV)}`
    );

    // Register the logger plugin
    await server.register(loggerPlugin);

    // Register the user token cache plugin
    await server.register(userTokenCachePlugin, {
      cacheDir: ".cache",
    });

    // Register the anyAuth API client plugin
    await server.register(anyAuthApiServerClientPlugin, {
      baseURL: "http://127.0.0.1:8000",
    });
    server.log.info("Registered AnyAuth Server API client");

    // Register the anyAuth API client plugin
    await server.register(anyAuthApiActiveUserClientPlugin, {
      baseURL: "http://127.0.0.1:8000",
    });
    server.log.info("Registered AnyAuth Active User API client");

    // Authenticate API client before proceeding
    await server.anyAuthApiServerClient.authenticate();
    server.log.info("API clients authenticated successfully");

    await server.register(FastifyVite, {
      root: import.meta.url,
      dev: process.argv.includes("--dev"),
      spa: true,
    });

    // Register the OAuth2 plugin
    server.register(oauthPlugin, {});

    server.get("/", (req, reply) => {
      return reply.html();
    });

    server.get("/me", async (req, reply) => {
      try {
        // Get `session_id` from cookie
        const sessionId = req.cookies.session_id;
        if (!sessionId) {
          return reply.code(401).send("Unauthorized");
        }

        // Get the user token from the cache
        const userToken = await getAndRefreshIfExpiredUserTokenFromCache(
          sessionId
        );
        if (!userToken) {
          return reply.code(401).send("Unauthorized");
        }

        // Attempt to get the user data from the AnyAuth API
        server.log.info(`User token: ${JSON.stringify(userToken)}`);
        server.log.info(`User token: ${userToken.access_token}`);
        const rawUser = await server.anyAuthApiActiveUserClient.get("/me", {
          headers: { Authorization: `Bearer ${userToken.access_token}` },
        });

        // Parse the received user data
        const validatedUser = AnyAuthUserSchema.parse(rawUser.data);

        server.log.info(`User ${sessionId}: ${JSON.stringify(validatedUser)}`);
        return reply.send(validatedUser);
      } catch (error) {
        // Check if the error is a Zod validation error
        if (error instanceof z.ZodError) {
          server.log.error(
            `Validation error in GET /me endpoint: ${JSON.stringify(
              error.errors
            )}`
          );
          return reply
            .code(500)
            .send({ error: "Internal Server Error", details: error.message });
        }
        // Log any other errors and return a 500 response
        server.log.error(`Error in GET /me endpoint: ${error.message}`);
        return reply
          .code(500)
          .send({ error: "Internal Server Error", details: error.message });
      }
    });

    await server.vite.ready();
    await server.listen({ port: 3000 });
  } catch (error) {
    console.error("Failed to start server:", error); // eslint-disable-line no-undef
    process.exit(1);
  }
}

// Start the server
startServer();
