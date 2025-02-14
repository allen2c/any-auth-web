// routes/auth.js

export default async function authRoutes(fastify) {
  fastify.get("/auth/status", async () => {
    return { status: "OK", message: "Auth routes working!" };
  });
}
