import fs from "node:fs";
import { onlineJoinText } from "../../server/src/lib/onlineSessions";
(async () => {
  const c = JSON.parse(fs.readFileSync("/Users/kazjames/Downloads/activtyos-app-/e2e/review/shots/online/email-ctx.json", "utf8"));
  const base = { id: c.L1, tenantId: c.tid, name: "x", blockId: c.bundle };
  const e1 = await onlineJoinText({ ...base, videoMode: "platform" }, c.tomorrow, "Session");
  const e2 = await onlineJoinText({ ...base, videoMode: "own", ownLink: "https://example.org/room-secret-abc", showLinkNow: false }, c.tomorrow, "Session");
  const e3 = await onlineJoinText({ ...base, videoMode: "own", ownLink: "https://example.org/room-secret-abc", showLinkNow: true }, c.tomorrow, "Session");
  console.log("EMAIL platform :", e1); console.log("EMAIL own later:", e2); console.log("EMAIL own now  :", e3);
  const ok1 = /Join from My bookings from/.test(e1) && !/road|street|map/i.test(e1);
  const ok2 = !e2.includes("room-secret") && e3.includes("room-secret");
  console.log(ok1 ? "PASS email platform wording, no address" : "FAIL email platform wording"); console.log(ok2 ? "PASS email own link hidden unless show-now" : "FAIL email own link");
  process.exit(0);
})();
