import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import axios from "axios";
import crypto from "node:crypto";
import fastifyEnv from "@fastify/env";
import fastifyOAuth2 from "@fastify/oauth2";
import fetch from "node-fetch";
import process from "node:process";
import { URLSearchParams } from "node:url";
import { faker } from "@faker-js/faker";
import { z } from "zod";
import flatCache from "flat-cache";

// 7 days in seconds
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

// Environment Options
const envOptions = {
  schema: {
    type: "object",
    required: [
      "APPLICATION_USERNAME",
      "APPLICATION_PASSWORD",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_CLIENT_ID",
    ],
    properties: {
      APPLICATION_USERNAME: { type: "string" },
      APPLICATION_PASSWORD: { type: "string" },
      GOOGLE_CLIENT_SECRET: { type: "string" },
      GOOGLE_CLIENT_ID: { type: "string" },
    },
  },
  dotenv: true,
};

// Cache Options
const cache = flatCache.create({ cacheDir: ".cache" });

// Helper function to generate random string
function generateRandomString(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

// Schemas
const GoogleAccessTokenSchema = z.object({
  token: z.object({
    access_token: z.string(),
    expires_in: z.number(),
    scope: z.string(),
    token_type: z.string(),
    id_token: z.string(),
    expires_at: z.string().or(z.date()),
  }),
});

const GoogleUserInfoSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    verified_email: z.boolean(),
    name: z.string(),
    given_name: z.string(),
    picture: z.string(),
  })
  .transform((googleUser) => ({
    ...googleUser,

    toAnyAuthUserCreate: () => ({
      username: googleUser.email.split("@")[0],
      full_name: googleUser.name,
      email: googleUser.email,
      phone: null,
      password: Array.from({ length: 4 }, () => faker.internet.password()).join(
        ""
      ),
      metadata: {
        provider: "google",
        googleId: googleUser.id,
        picture: googleUser.picture,
        verified_email: googleUser.verified_email,
      },
    }),
  }));

const AnyAuthTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  scope: z.string(),
  expires_at: z.number(),
  expires_in: z.number(),
  issued_at: z.string(), // Assuming issued_at is a string in ISO format
  meta: z.record(z.any()).optional(), // Assuming meta is an object (record) with any key-value pairs and is optional
});

const AnyAuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  full_name: z.string().nullable(),
  email: z.string().email(),
  email_verified: z.boolean(),
  phone: z.string().nullable(),
  phone_verified: z.boolean(),
  disabled: z.boolean(),
  profile: z.string(),
  picture: z.string(),
  website: z.string(),
  gender: z.string(),
  birthdate: z.string(),
  zoneinfo: z.string(),
  locale: z.string(),
  address: z.string(),
  metadata: z.record(z.any()),
  created_at: z.number(),
  updated_at: z.number(),
});

const AnyAuthUserCreateSchema = z.object({
  username: z
    .string()
    .min(4, { message: "Username must be at least 4 characters" })
    .max(64, { message: "Username must be at most 64 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        "Username must only contain alphanumeric characters, underscores, or hyphens",
    }),
  full_name: z.string().optional().nullable(),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional().nullable(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(64, { message: "Password must be at most 64 characters" }),
  metadata: z.record(z.any()).default({}),
});

// AnyAuth API Client
const anyAuthApiServerClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});
anyAuthApiServerClient.state = {};
const anyAuthApiActiveUserClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

anyAuthApiServerClient.interceptors.response.use(
  (response) => response, // Response directly if successful
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is a 401 and has not attempted to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark as retried to avoid infinite loops

      try {
        server.log.info("Access token expired, attempting to refresh...");
        await authenticateApiClients(); // Refresh the token
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

async function authenticateApiClients() {
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
      anyAuthApiServerClient.state.user = validatedMeResponse;
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
}

async function registerUser(userData) {
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

    // Authenticate API client before proceeding
    await authenticateApiClients();
    server.log.info("API clients authenticated successfully");

    await server.register(FastifyVite, {
      root: import.meta.url,
      dev: process.argv.includes("--dev"),
      spa: true,
    });

    server.log.info(
      `Google Client ID exists: ${Boolean(
        process.env.GOOGLE_CLIENT_ID
      )}, Secret exists: ${Boolean(process.env.GOOGLE_CLIENT_SECRET)}`
    );
    // Register the OAuth2 plugin with Google configuration
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
        const user_token = await registerUser(userInfo.toAnyAuthUserCreate());
        request.log.info(`Login user token: ${JSON.stringify(user_token)}`);

        // Save the user token to the server side cache
        const cacheUserKey = `usr_${generateRandomString()}`;
        cache.setKey(cacheUserKey, JSON.stringify(user_token));
        cache.save();

        // Set only the cache key in the cookie
        reply.setCookie("session_id", cacheUserKey, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // Use secure in production
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
          process.env.NODE_ENV === "production"
            ? "An error occurred during authentication"
            : `Authentication failed: ${err.message}`;
        request.log.error(`Authentication failed: ${userFriendlyMessage}`);
        reply.code(500).send(userFriendlyMessage);
      }
    });

    server.get("/", (req, reply) => {
      return reply.html();
    });

    await server.vite.ready();
    await server.listen({ port: 3000 });
  } catch (error) {
    server.log.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
