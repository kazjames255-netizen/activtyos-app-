// Bootstrap a Platform (HQ) super-admin account — the one account type that
// can never be self-registered through the app (otherwise anyone could make
// themselves admin). Run by whoever holds the server credentials.
//
// Credentials come from server/.env (gitignored — keeps them out of shell
// history):
//
//   ADMIN_EMAIL=owner@example.com
//   ADMIN_PASSWORD=temp-password
//   npm run create-admin
//
// (CLI args still work as an override: npm run create-admin -- email pass)
// Hand over the temp password; they sign in and use "Forgot password?" on
// the login page to set their own.

import "dotenv/config";
import { ensureAdmin } from "./lib/ensureAdmin";

const args = process.argv.slice(2).filter((a) => a !== "--");
const email = args[0] || process.env.ADMIN_EMAIL;
const password = args[1] || process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 6) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (min 6 chars) in server/.env, " +
      "or pass them as args: npm run create-admin -- <email> <password>",
  );
  process.exit(1);
}

console.log(await ensureAdmin(email, password));
console.log("They can sign in at /login.");
process.exit(0);
