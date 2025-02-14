// plugins/oauth.js
import crypto from "node:crypto";
import process from "node:process";
import fastifyOAuth2 from "@fastify/oauth2";
import fp from "fastify-plugin";
import fetch from "node-fetch";
import {
  GoogleAccessTokenSchema,
  GoogleUserInfoSchema,
} from "../schemas/index.js";

function generateRandomString(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

async function oauthPlugin(fastify, options) {
  // Register the OAuth2 plugin with Google configuration
  fastify.log.info(
    `Google Client ID exists: ${Boolean(
      process.env.GOOGLE_CLIENT_ID
    )}, Secret exists: ${Boolean(process.env.GOOGLE_CLIENT_SECRET)}`
  );
  fastify.register(fastifyOAuth2, {
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
  fastify.get("/auth/google/callback", async (request, reply) => {
    try {
      request.log.info("Starting OAuth callback");

      const rawToken =
        await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
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
      const user_token = await fastify.anyAuthApiServerClient.registerUser(
        userInfo.toAnyAuthUserCreate()
      );
      request.log.info(`Login user token: ${JSON.stringify(user_token)}`);

      // Save the user token to the server side cache
      const cacheUserKey = `usr_${generateRandomString()}`;
      fastify.userTokenCache.saveUserTokenToCache(cacheUserKey, user_token);

      // Set only the cache key in the cookie
      reply.setCookie("session_id", cacheUserKey, {
        path: "/",
        httpOnly: true,
        secure: fastify.config.NODE_ENV === "production", // Use secure in production
        sameSite: "lax",
        maxAge: options.cacheTtl || 7 * 24 * 60 * 60, // 7 days
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
        fastify.config.NODE_ENV === "production"
          ? "An error occurred during authentication"
          : `Authentication failed: ${err.message}`;
      request.log.error(`Authentication failed: ${userFriendlyMessage}`);
      reply.code(500).send(userFriendlyMessage);
    }
  });
}

export default fp(oauthPlugin, { name: "oauthPlugin" });
