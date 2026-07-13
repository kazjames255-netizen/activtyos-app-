import { Router } from "express";
import { db } from "../firebase";

export const tenants = Router();

// GET /api/tenants — the platform (super-admin) view of every provider.
tenants.get("/", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const snap = await db.collection("tenants").orderBy("createdAt", "desc").get();
  res.json(
    snap.docs.map((d) => {
      const { name, type, createdAt } = d.data();
      return { id: d.id, name, type, createdAt };
    }),
  );
});

// GET /api/me — who am I (for the frontend and API consumers).
export const me = Router();

me.get("/", async (req, res) => {
  const auth = req.auth!;
  let tenantName: string | null = null;
  if (auth.tenantId) {
    const t = await db.collection("tenants").doc(auth.tenantId).get();
    tenantName = t.exists ? t.data()!.name : null;
  }
  res.json({
    email: req.user!.email ?? null,
    role: auth.role,
    tenantId: auth.tenantId,
    tenantName,
    franchiseId: auth.franchiseId,
  });
});
