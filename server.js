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
import { envOptions } from "./plugins/env.js";
import loggerPlugin from "./plugins/logger.js";
import {
  AnyAuthTokenSchema,
  AnyAuthUserSchema,
  AnyAuthUserCreateSchema,
  GoogleAccessTokenSchema,
  GoogleUserInfoSchema,
} from "./schemas/index.js";

import { generateRandomString } from "./utils/rand.js";

// 7 days in seconds
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

// Cache Options
const cache = flatCache.create({ cacheDir: ".cache" });

// Helper Functions
/**
 * Get a user token from the cache.
 *
 * @param {string} sessionId - The session identifier.
 * @returns {import("zod").infer<typeof AnyAuthTokenSchema> | null} - Token data matching the AnyAuthTokenSchema, or null if not found.
 */
function getUserTokenFromCache(sessionId) {
  const raw = cache.getKey(sessionId);
  if (!raw) return null;
  return AnyAuthTokenSchema.parse(JSON.parse(raw));
}

/**
 * Save a user token to the cache.
 *
 * @param {string} sessionId - The session identifier.
 * @param {import("zod").infer<typeof AnyAuthTokenSchema>} tokenData - Token data matching the AnyAuthTokenSchema.
 */
function saveUserTokenToCache(sessionId, token) {
  // How to hint annotation of data type for tokenData as `AnyAuthTokenSchema`?
  cache.setKey(sessionId, JSON.stringify(token));
  cache.save();
}

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

// AnyAuth API Client
const anyAuthApiServerClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});
anyAuthApiServerClient.state = {};
anyAuthApiServerClient.authenticate = async function () {
  try {
    // Validate critical environment variables
    if (
      !process.env.APPLICATION_USERNAME ||
      !process.env.APPLICATION_PASSWORD
    ) {
      const missingEnvs = [];
      if (!process.env.APPLICATION_USERNAME)
        missingEnvs.push("APPLICATION_USERNAME");
      if (!process.env.APPLICATION_PASSWORD)
        missingEnvs.push("APPLICATION_PASSWORD");

      const errorMessage = `Missing required environment variables: ${missingEnvs.join(
        ", "
      )}`;
      server.log.info(errorMessage);
      throw new Error(errorMessage);
    }

    const params = new URLSearchParams();
    params.append("username", process.env.APPLICATION_USERNAME);
    params.append("password", process.env.APPLICATION_PASSWORD);
    params.append("grant_type", "password");

    const response = await anyAuthApiServerClient.post("/token", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    if (!response.data) {
      throw new Error("No response data received from authentication request");
    }

    const validatedAnyAuthToken = AnyAuthTokenSchema.parse(response.data);
    const { access_token } = validatedAnyAuthToken;
    server.log.info(
      `AnyAuth application access token: ${JSON.stringify(access_token)}`
    );

    // Set the JWT token for all future requests
    anyAuthApiServerClient.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${access_token}`;

    // **--- Token Validation Step ---**
    server.log.info("Validating access token by calling /me API...");
    try {
      const meResponse = await anyAuthApiServerClient.get("/me");
      if (!meResponse.data) {
        throw new Error("No data received from /me API validation call");
      }
      const validatedMeResponse = AnyAuthUserSchema.parse(meResponse.data);

      // Set the user for the server side client
      anyAuthApiServerClient.state.user = validatedMeResponse;
      // Set the token for the server side client
      anyAuthApiServerClient.state.token = validatedMeResponse;
      server.log.info(
        `[GET /me] API call successful: ${JSON.stringify(validatedMeResponse)}`
      );
    } catch (meError) {
      server.log.error(
        `[GET /me] API call failed, access token is invalid: ${JSON.stringify(
          meError.response ? meError.response.status : meError.message
        )}`
      );
      throw new Error(`Failed to validate access token: ${meError.message}`); // Re-throw error to indicate authentication failure
    }
    // **--- End Token Validation Step ---**

    return true;
  } catch (error) {
    server.log.error(
      `Failed to authenticate API client: ${JSON.stringify(error)}`
    );
    throw error;
  }
};
anyAuthApiServerClient.refreshToken = async function () {
  // Ensure we have a stored token with a refresh token
  if (!this.state.token || !this.state.token.refresh_token) {
    server.log.error("No refresh token available. Please authenticate first.");
    throw new Error("No refresh token available. Please authenticate first.");
  }

  // Build the URL-encoded request body with grant_type and refresh_token
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", this.state.token.refresh_token);

  try {
    // Send POST request with form data
    const response = await this.post("/refresh-token", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Validate the response data using our token schema
    const newToken = AnyAuthTokenSchema.parse(response.data);

    // Update the default Authorization header with the new access token
    this.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${newToken.access_token}`;

    // Save the new token in the client state
    this.state.token = newToken;

    server.log.info("Refresh token successful: " + JSON.stringify(newToken));
    return newToken;
  } catch (error) {
    server.log.error(`Failed to refresh token: ${JSON.stringify(error)}`);
    throw error;
  }
};
/**
 * Registers a new user via the AnyAuth API.
 *
 * @param {import("zod").infer<typeof AnyAuthUserCreateSchema>} userData - The user's data to be registered.
 * @returns {Promise<import("zod").infer<typeof AnyAuthTokenSchema>>} A promise that resolves with the token object.
 * @throws Will throw an error if the registration process fails.
 */
anyAuthApiServerClient.registerUser = async function (userData) {
  try {
    // Validate the incoming user data against the expected schema.
    // This schema corresponds to the OpenAPI /register request body (UserCreate)
    const validatedUserData = AnyAuthUserCreateSchema.parse(userData);
    server.log.info(
      `Registering new user: ${JSON.stringify(validatedUserData)}`
    );

    // Make a POST request to the /register endpoint with the validated user data.
    const response = await anyAuthApiServerClient.post(
      "/register",
      validatedUserData
    );

    // Validate the response data against the expected Token schema.
    // The /register endpoint is documented to return a Token object.
    const token = AnyAuthTokenSchema.parse(response.data);
    server.log.info("User registered successfully:", token);

    // Return the token (or you could choose to handle it further)
    return token;
  } catch (error) {
    server.log.error(`Failed to register user: ${error}`);
    throw error;
  }
};
anyAuthApiServerClient.interceptors.response.use(
  (response) => response, // Response directly if successful
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is a 401 and has not attempted to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark as retried to avoid infinite loops

      try {
        server.log.info("Access token expired, attempting to refresh...");
        await anyAuthApiServerClient.refreshToken();
        server.log.info("Successfully refreshed access token.");

        // Use the new token to resend the original request
        originalRequest.headers.Authorization =
          anyAuthApiServerClient.defaults.headers.common.Authorization;
        return anyAuthApiServerClient(originalRequest); // Resend the request
      } catch (refreshError) {
        server.log.error(
          `Failed to refresh access token: ${JSON.stringify(refreshError)}`
        );
        // Authentication failed, you can choose to throw an error or handle it in another way (e.g., log out the application)
        return Promise.reject(refreshError);
      }
    }

    // Non-401 error, or refresh validation failed, throw an error
    return Promise.reject(error);
  }
);

const anyAuthApiActiveUserClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});
anyAuthApiActiveUserClient.state = {};

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

    // Authenticate API client before proceeding
    await anyAuthApiServerClient.authenticate();
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
        const user_token = await anyAuthApiServerClient.registerUser(
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
