// utils/rand.js
import crypto from "node:crypto";

// Helper function to generate random string
function generateRandomString(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

export { generateRandomString };
