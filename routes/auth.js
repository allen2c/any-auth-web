// routes/auth.js
import { z } from "zod";
import { AnyAuthUserSchema } from "../schemas/index.js";

export default async function authRoutes(fastify) {
  fastify.get("/auth/status", async () => {
    return { status: "OK", message: "Auth routes working!" };
  });

  fastify.get("/me", async (req, reply) => {
    try {
      // Get `session_id` from cookie
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return reply.code(401).send("Unauthorized");
      }

      // Get the user token from the cache
      const userToken =
        await fastify.anyAuthApiActiveUserClient.getAndRefreshIfExpiredUserTokenFromCache(
          sessionId
        );
      if (!userToken) {
        return reply.code(401).send("Unauthorized");
      }

      // Attempt to get the user data from the AnyAuth API
      fastify.log.info(`User token: ${JSON.stringify(userToken)}`);
      fastify.log.info(`User token: ${userToken.access_token}`);
      const rawUser = await fastify.anyAuthApiActiveUserClient.get("/me", {
        headers: { Authorization: `Bearer ${userToken.access_token}` },
      });

      // Parse the received user data
      const validatedUser = AnyAuthUserSchema.parse(rawUser.data);

      fastify.log.info(`User ${sessionId}: ${JSON.stringify(validatedUser)}`);
      return reply.send(validatedUser);
    } catch (error) {
      // Check if the error is a Zod validation error
      if (error instanceof z.ZodError) {
        fastify.log.error(
          `Validation error in GET /me endpoint: ${JSON.stringify(
            error.errors
          )}`
        );
        return reply
          .code(500)
          .send({ error: "Internal Server Error", details: error.message });
      }
      // Log any other errors and return a 500 response
      fastify.log.error(`Error in GET /me endpoint: ${error.message}`);
      return reply
        .code(500)
        .send({ error: "Internal Server Error", details: error.message });
    }
  });
}
