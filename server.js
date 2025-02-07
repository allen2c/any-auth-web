import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import fastifyOAuth2 from "@fastify/oauth2";
import process from "node:process";
import fastifyEnv from "@fastify/env";

const server = Fastify();

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

// Register the OAuth2 plugin with Google configuration
server.register(fastifyOAuth2, {
  name: "googleOAuth2",
  scope: ["profile", "email"],
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
    // Exchange the authorization code for an access token.
    const token =
      await server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
        request
      );

    // Send back a page that tells the popup to refresh the parent and then close itself.
    return reply.type("text/html").send(`
      <html>
        <body>
          <script>
            // If this window was opened as a popup, refresh the parent window and close this popup.
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
    request.log.error(`Authentication failed: ${err}`);
    reply.code(500).send("Authentication failed");
  }
});

server.get("/", (req, reply) => {
  return reply.html();
});

await server.vite.ready();
await server.listen({ port: 3000 });
