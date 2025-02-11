// plugins/env.js
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // eslint-disable-line no-unused-vars

const schema = {
  type: "object",
  required: [
    "NODE_ENV",
    "APPLICATION_USERNAME",
    "APPLICATION_PASSWORD",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
  ],
  properties: {
    NODE_ENV: {
      type: "string",
      default: "development",
      enum: ["development", "staging", "production", "test"],
    },
    APPLICATION_USERNAME: { type: "string", minLength: 1 },
    APPLICATION_PASSWORD: { type: "string", minLength: 1 },
    GOOGLE_CLIENT_SECRET: { type: "string", minLength: 1 },
    GOOGLE_CLIENT_ID: { type: "string", minLength: 1 },
  },
};

const options = {
  schema,
  dotenv: true,
  error: (errors) => {
    throw new Error(`Environment validation failed: ${JSON.stringify(errors)}`);
  },
};

export { options as envOptions };
