// schemas/googleSchema.ts
import { faker } from "@faker-js/faker";
import { z } from "zod";

export const GoogleAccessTokenSchema = z.object({
  token: z.object({
    access_token: z.string(),
    expires_in: z.number(),
    scope: z.string(),
    token_type: z.string(),
    id_token: z.string(),
    expires_at: z.string().or(z.date()),
  }),
});

export const GoogleUserInfoSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    verified_email: z.boolean(),
    name: z.string(),
    given_name: z.string(),
    picture: z.string(),
  })
  .transform((googleUser) => ({
    ...googleUser,
    toAnyAuthUserCreate: () => ({
      username: googleUser.email.split("@")[0],
      full_name: googleUser.name,
      email: googleUser.email,
      phone: null,
      password: Array.from({ length: 4 }, () => faker.internet.password()).join(
        ""
      ),
      metadata: {
        provider: "google",
        googleId: googleUser.id,
        picture: googleUser.picture,
        verified_email: googleUser.verified_email,
      },
    }),
  }));
