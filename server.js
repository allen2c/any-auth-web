import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import fastifyEnv from "@fastify/env";
import fastifyOAuth2 from "@fastify/oauth2";
import fetch from "node-fetch";
import process from "node:process";
import { z } from "zod";

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

const server = Fastify({
  logger: {
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
});

const envOptions = {
  schema: {
    type: "object",
    required: ["GOOGLE_CLIENT_SECRET", "GOOGLE_CLIENT_ID"],
    properties: {
      GOOGLE_CLIENT_SECRET: { type: "string" },
      GOOGLE_CLIENT_ID: { type: "string" },
    },
  },
  dotenv: true,
};

await server.register(fastifyEnv, envOptions);

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
    request.log.info(`Google API response status: ${userInfoResponse.status}`);

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      throw new Error(
        `Google API error: ${userInfoResponse.status} - ${errorText}`
      );
    }

    const rawUserInfo = await userInfoResponse.json();
    const userInfo = UserInfoSchema.parse(rawUserInfo);
    request.log.info(`User Information received: ${JSON.stringify(userInfo)}`);

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
