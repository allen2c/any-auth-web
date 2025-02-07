import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import fastifyEnv from "@fastify/env";
import fastifyOAuth2 from "@fastify/oauth2";
import fetch from "node-fetch";
import process from "node:process";
import { z } from "zod";
import axios from "axios";
import { URLSearchParams } from "node:url";

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

// Schemas
const AccessTokenSchema = z.object({
  token: z.object({
    access_token: z.string(),
    expires_in: z.number(),
    scope: z.string(),
    token_type: z.string(),
    id_token: z.string(),
    expires_at: z.string().or(z.date()),
  }),
});

const UserInfoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  verified_email: z.boolean(),
  name: z.string(),
  given_name: z.string(),
  picture: z.string(),
});

//
const anyAuthApiClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add this after the anyAuthApiClient declaration
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

    const response = await anyAuthApiClient.post("/token", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const { access_token } = response.data;
    server.log.info(
      `AnyAuth application access token: ${JSON.stringify(access_token)}`
    );

    // Set the JWT token for all future requests
    anyAuthApiClient.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${access_token}`;

    return true;
  } catch (error) {
    server.log.error(
      `Failed to authenticate API client: ${JSON.stringify(error)}`
    );
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
        const validatedToken = AccessTokenSchema.parse(rawToken);
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
        const userInfo = UserInfoSchema.parse(rawUserInfo);
        request.log.info(
          `User Information received: ${JSON.stringify(userInfo)}`
        );

        // Store the login state as needed
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
