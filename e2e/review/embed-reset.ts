import fs from "node:fs"; import path from "node:path";
import { fbSignIn, apiFetch } from "../helpers/accounts";
import { ROOT } from "../helpers/env";
const sd = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/review/shots/embed/seed.json"), "utf8"));
(async () => { const tok = (await fbSignIn(sd.email)).idToken; await apiFetch(`/api/listings/${sd.draft}`, tok, { method: "PUT", body: JSON.stringify({ status: process.argv[2] ?? "draft" }) }); console.log("draft listing ->", process.argv[2] ?? "draft"); process.exit(0); })();
