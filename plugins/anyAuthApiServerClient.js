// plugins/anyAuthApiClient.js
import process from "node:process";
import { URLSearchParams } from "node:url";
import axios from "axios";
import fp from "fastify-plugin";
import {
  AnyAuthTokenSchema,
  AnyAuthUserSchema,
  AnyAuthUserCreateSchema,
} from "../schemas/index.js";

/**
 * Fastify plugin: Create anyAuth API client
 * @param {FastifyInstance} fastify
 * @param {Object} options Plugin options (e.g., can pass in baseURL to override default)
 */
export default fp(async function (fastify, options) {
  // Create axios instance, default baseURL can be overridden from options
  const anyAuthApiServerClient = axios.create({
    baseURL: options.baseURL || "http://127.0.0.1:8000",
    headers: {
      "Content-Type": "application/json",
    },
  });
  anyAuthApiServerClient.state = {};

  // Define authenticate method
  anyAuthApiServerClient.authenticate = async function () {
    try {
      // Check required environment variables
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
        fastify.log.info(errorMessage);
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
        throw new Error(
          "No response data received from authentication request"
        );
      }
      const validatedAnyAuthToken = AnyAuthTokenSchema.parse(response.data);
      const { access_token } = validatedAnyAuthToken;
      fastify.log.info(
        `AnyAuth application access token: ${JSON.stringify(access_token)}`
      );

      // Set the obtained access token to the default Authorization header
      anyAuthApiServerClient.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${access_token}`;

      // **--- Token validation step ---**
      fastify.log.info("Validating access token by calling /me API...");
      try {
        const meResponse = await anyAuthApiServerClient.get("/me");
        if (!meResponse.data) {
          throw new Error("No data received from /me API validation call");
        }
        const validatedMeResponse = AnyAuthUserSchema.parse(meResponse.data);
        // Store the validated user information in the client state
        anyAuthApiServerClient.state.user = validatedMeResponse;
        anyAuthApiServerClient.state.token = validatedMeResponse;
        fastify.log.info(
          `[GET /me] API call successful: ${JSON.stringify(
            validatedMeResponse
          )}`
        );
      } catch (meError) {
        fastify.log.error(
          `[GET /me] API call failed, access token is invalid: ${JSON.stringify(
            meError.response ? meError.response.status : meError.message
          )}`
        );
        throw new Error(`Failed to validate access token: ${meError.message}`);
      }
      // **--- End Token validation step ---**

      return true;
    } catch (error) {
      fastify.log.error(
        `Failed to authenticate API client: ${JSON.stringify(error)}`
      );
      throw error;
    }
  };

  // Define refreshToken method
  anyAuthApiServerClient.refreshToken = async function () {
    if (!this.state.token || !this.state.token.refresh_token) {
      fastify.log.error(
        "No refresh token available. Please authenticate first."
      );
      throw new Error("No refresh token available. Please authenticate first.");
    }

    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", this.state.token.refresh_token);

    try {
      const response = await this.post("/refresh-token", params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const newToken = AnyAuthTokenSchema.parse(response.data);
      this.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${newToken.access_token}`;
      this.state.token = newToken;
      fastify.log.info("Refresh token successful: " + JSON.stringify(newToken));
      return newToken;
    } catch (error) {
      fastify.log.error(`Failed to refresh token: ${JSON.stringify(error)}`);
      throw error;
    }
  };

  // Define registerUser method
  anyAuthApiServerClient.registerUser = async function (userData) {
    try {
      const validatedUserData = AnyAuthUserCreateSchema.parse(userData);
      fastify.log.info(
        `Registering new user: ${JSON.stringify(validatedUserData)}`
      );
      const response = await anyAuthApiServerClient.post(
        "/register",
        validatedUserData
      );
      const token = AnyAuthTokenSchema.parse(response.data);
      fastify.log.info("User registered successfully:", token);
      return token;
    } catch (error) {
      fastify.log.error(`Failed to register user: ${error}`);
      throw error;
    }
  };

  // Set axios interceptor, refresh token for 401 status
  anyAuthApiServerClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          fastify.log.info("Access token expired, attempting to refresh...");
          await anyAuthApiServerClient.refreshToken();
          fastify.log.info("Successfully refreshed access token.");
          originalRequest.headers.Authorization =
            anyAuthApiServerClient.defaults.headers.common.Authorization;
          return anyAuthApiServerClient(originalRequest);
        } catch (refreshError) {
          fastify.log.error(
            `Failed to refresh access token: ${JSON.stringify(refreshError)}`
          );
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );

  // Decorate anyAuthApiServerClient to the Fastify instance for global use
  fastify.decorate("anyAuthApiServerClient", anyAuthApiServerClient);
});
