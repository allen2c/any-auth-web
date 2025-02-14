// plugins/anyAuthApiClient.js
import axios from "axios";
import fp from "fastify-plugin";

export default fp(async function (fastify, options) {
  const anyAuthApiActiveUserClient = axios.create({
    baseURL: options.baseURL || "http://127.0.0.1:8000",
    headers: {
      "Content-Type": "application/json",
    },
  });
  anyAuthApiActiveUserClient.state = {};

  // Decorate anyAuthApiServerClient to the Fastify instance for global use
  fastify.decorate("anyAuthApiActiveUserClient", anyAuthApiActiveUserClient);
});
