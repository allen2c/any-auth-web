// server.js
import process from "node:process";
import fastifyEnv from "@fastify/env";
import FastifyVite from "@fastify/vite";
import Fastify from "fastify";
import anyAuthApiActiveUserClientPlugin from "./plugins/anyAuthApiActiveUserClient.js";
import anyAuthApiServerClientPlugin from "./plugins/anyAuthApiServerClient.js";
import { envOptions } from "./plugins/env.js";
import loggerPlugin from "./plugins/logger.js";
import oauthPlugin from "./plugins/oauth.js";
import userTokenCachePlugin from "./plugins/userTokenCache.js";
import authRoutes from "./routes/auth.js";

// Fastify Application
async function startServer() {
  const server = Fastify({
    logger: {
      transport: {
        target: "@fastify/one-line-logger",
      },
    },
  });
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
      baseURL: server.config.ANY_AUTH_BASE_URL,
    });
    server.log.info("Registered AnyAuth Server API client");

    // Register the anyAuth API client plugin
    await server.register(anyAuthApiActiveUserClientPlugin, {
      baseURL: server.config.ANY_AUTH_BASE_URL,
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

    // Register the auth routes
    await server.register(authRoutes);

    await server.vite.ready();
    await server.listen({ port: 3000 });
  } catch (error) {
    console.error("Failed to start server:", error); // eslint-disable-line no-undef
    process.exit(1);
  }
}

// Start the server
startServer();
