import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import fastifyEnv from "@fastify/env";
import fastifyOAuth2 from "@fastify/oauth2";
import fetch from "node-fetch";
import process from "node:process";

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
    request.log.info("Starting OAuth callback");

    const token =
      await server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
        request
      );
    request.log.info({
      msg: "Token received: ",
      tokenInfo: {
        hasAccessToken: Boolean(token?.access_token),
        tokenType: token?.token_type,
        expiresIn: token?.expires_in,
      },
    });

    if (!token?.access_token) {
      throw new Error("No access token received from Google");
    }

    // Fetch user information using the access token
    request.log.info("Fetching user info from Google");
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      }
    );
    request.log.info({
      msg: "Google API response status",
      status: userInfoResponse.status,
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      throw new Error(
        `Google API error: ${userInfoResponse.status} - ${errorText}`
      );
    }

    const userInfo = await userInfoResponse.json();
    request.log.info({
      msg: "User Information received",
      user: {
        email: userInfo.email,
        name: userInfo.name,
        hasProfile: Boolean(userInfo.profile),
      },
    });

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
    request.log.error("Authentication failed:", {
      error: err.message,
      stack: err.stack,
    });
    reply.code(500).send(`Authentication failed: ${err.message}`);
  }
});

server.get("/", (req, reply) => {
  return reply.html();
});

await server.vite.ready();
await server.listen({ port: 3000 });
