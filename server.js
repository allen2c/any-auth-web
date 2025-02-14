// server.js
import process from "node:process";
import { URLSearchParams } from "node:url";
import fastifyEnv from "@fastify/env";
import fastifyOAuth2 from "@fastify/oauth2";
import FastifyVite from "@fastify/vite";
import axios from "axios";
import Fastify from "fastify";
import flatCache from "flat-cache";
import fetch from "node-fetch";
import { z } from "zod";
import anyAuthApiActiveUserClientPlugin from "./plugins/anyAuthApiActiveUserClient.js";
import anyAuthApiServerClientPlugin from "./plugins/anyAuthApiServerClient.js";
import cacheUserTokenPlugin from "./plugins/cacheUserToken.js";
import { envOptions } from "./plugins/env.js";
import loggerPlugin from "./plugins/logger.js";
import {
  AnyAuthTokenSchema,
  AnyAuthUserSchema,
  GoogleAccessTokenSchema,
  GoogleUserInfoSchema,
} from "./schemas/index.js";
import { generateRandomString } from "./utils/rand.js";

// 7 days in seconds
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

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
    await server.register(cacheUserTokenPlugin, {
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

    // Register the OAuth2 plugin with Google configuration
    server.log.info(
      `Google Client ID exists: ${Boolean(
        process.env.GOOGLE_CLIENT_ID
      )}, Secret exists: ${Boolean(process.env.GOOGLE_CLIENT_SECRET)}`
    );
    server.register(fastifyOAuth2, {
      name: "googleOAuth2",
      scope: ["openid", "email", "profile"],
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID,
          secret: process.env.GOOGLE_CLIENT_SECRET,
        },
        auth: fastifyOAuth2.GOOGLE_CONFIGURATION,
      },
      // When the user hits '/auth/google/login', they will be redirected to Google
      startRedirectPath: "/auth/google/login",
      // After login, Google will redirect to this callback URL
      callbackUri: "http://localhost:3000/auth/google/callback", // Adjust for production
    });

    // Define a callback route to handle the OAuth2 response
    server.get("/auth/google/callback", async (request, reply) => {
      try {
        request.log.info("Starting OAuth callback");

        const rawToken =
          await server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
            request
          );
        const validatedToken = GoogleAccessTokenSchema.parse(rawToken);
        request.log.info(`Token object: ${JSON.stringify(validatedToken)}`);

        if (!validatedToken.token.access_token) {
          throw new Error("No access token received from Google");
        }

        // Fetch user information using the access token
        request.log.info("Fetching user info from Google");
        const userInfoResponse = await fetch(
          "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
          {
            headers: {
              Authorization: `Bearer ${validatedToken.token.access_token}`,
            },
          }
        );
        request.log.info(
          `Google API response status: ${userInfoResponse.status}`
        );

        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          throw new Error(
            `Google API error: ${userInfoResponse.status} - ${errorText}`
          );
        }

        const rawUserInfo = await userInfoResponse.json();
        const userInfo = GoogleUserInfoSchema.parse(rawUserInfo);
        request.log.info(
          `User Information received: ${JSON.stringify(userInfo)}`
        );

        // Register the user
        const user_token = await server.anyAuthApiServerClient.registerUser(
          userInfo.toAnyAuthUserCreate()
        );
        request.log.info(`Login user token: ${JSON.stringify(user_token)}`);

        // Save the user token to the server side cache
        const cacheUserKey = `usr_${generateRandomString()}`;
        saveUserTokenToCache(cacheUserKey, user_token);

        // Set only the cache key in the cookie
        reply.setCookie("session_id", cacheUserKey, {
          path: "/",
          httpOnly: true,
          secure: server.config.NODE_ENV === "production", // Use secure in production
          sameSite: "lax",
          maxAge: CACHE_TTL, // 7 days in seconds
        });
        // Store the user info in cookie (optional and consider security implications for sensitive data)
        reply.setCookie("user", JSON.stringify(userInfo), {
          path: "/",
          httpOnly: true,
        });

        // Send back a page that tells the popup to refresh the parent and then close itself.
        return reply.type("text/html").send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.location.href = '/';
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
      } catch (err) {
        const userFriendlyMessage =
          server.config.NODE_ENV === "production"
            ? "An error occurred during authentication"
            : `Authentication failed: ${err.message}`;
        request.log.error(`Authentication failed: ${userFriendlyMessage}`);
        reply.code(500).send(userFriendlyMessage);
      }
    });

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
        const rawUser = await anyAuthApiActiveUserClient.get("/me", {
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
