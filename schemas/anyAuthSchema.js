import { z } from "zod";

const AnyAuthTokenSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
    scope: z.string(),
    expires_at: z.number(),
    expires_in: z.number(),
    issued_at: z.string(), // Assuming issued_at is a string in ISO format
    meta: z.record(z.any()).optional(), // Assuming meta is an object (record) with any key-value pairs and is optional
  })
  .transform((token) => ({
    ...token,

    isTokenExpired: () => {
      const now = new Date();
      const expiresAtDate = new Date(token.expires_at * 1000);
      return expiresAtDate < now;
    },
  }));

const AnyAuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  full_name: z.string().nullable(),
  email: z.string().email(),
  email_verified: z.boolean(),
  phone: z.string().nullable(),
  phone_verified: z.boolean(),
  disabled: z.boolean(),
  profile: z.string(),
  picture: z.string(),
  website: z.string(),
  gender: z.string(),
  birthdate: z.string(),
  zoneinfo: z.string(),
  locale: z.string(),
  address: z.string(),
  metadata: z.record(z.any()),
  created_at: z.number(),
  updated_at: z.number(),
});

const AnyAuthUserCreateSchema = z.object({
  username: z
    .string()
    .min(4, { message: "Username must be at least 4 characters" })
    .max(64, { message: "Username must be at most 64 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        "Username must only contain alphanumeric characters, underscores, or hyphens",
    }),
  full_name: z.string().optional().nullable(),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional().nullable(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(64, { message: "Password must be at most 64 characters" }),
  metadata: z.record(z.any()).default({}),
});

export { AnyAuthTokenSchema, AnyAuthUserSchema, AnyAuthUserCreateSchema };
