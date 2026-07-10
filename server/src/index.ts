import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { parse as parseYaml } from "yaml";
import { requireAuth } from "./middleware/auth";
import { bookings } from "./routes/bookings";
import { customers } from "./routes/customers";
import { listings } from "./routes/listings";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Interactive API docs (no auth) — spec lives in server/openapi.yaml.
const here = path.dirname(fileURLToPath(import.meta.url));
const openapi = parseYaml(fs.readFileSync(path.resolve(here, "../openapi.yaml"), "utf8"));
app.get("/openapi.json", (_req, res) => res.json(openapi));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.use("/api", requireAuth);
app.use("/api/bookings", bookings);
app.use("/api/listings", listings);
app.use("/api/customers", customers);

// Surface async route errors as JSON 500s rather than hanging the request.
// (Express identifies error middleware by its 4-arg signature, so the unused
// `next` parameter is required.)
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`ActivityOS API listening on http://localhost:${port}`);
});
