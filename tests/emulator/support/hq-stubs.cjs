// Preload for the HQ-fixes test's OWN API process (emulator stack only; see tests/emulator/hq-fixes.test.mts). Two test doubles, nothing else:
//   1. fault injection: while the file named by HQ_STUB_FAIL_FILE exists, every Firestore `add` to a collection listed in it (one name per line) rejects
//      (proves the audit fails closed when the audit row cannot be written);
//   2. the AI model: any request to groq.com is NOT sent. Its body is written to HQ_STUB_GROQ_OUT and a canned answer returned
//      (proves what would have left the building, and that no real model is ever called).
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const serverRequire = createRequire(path.resolve(__dirname, "../../../server/package.json"));
const firestore = serverRequire("@google-cloud/firestore");
const origAdd = firestore.CollectionReference.prototype.add;
firestore.CollectionReference.prototype.add = function (data) {
  const f = process.env.HQ_STUB_FAIL_FILE;
  if (f && fs.existsSync(f)) {
    const failing = fs.readFileSync(f, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
    if (failing.includes(this.id)) return Promise.reject(new Error("INJECTED audit write failure for " + this.id));
  }
  return origAdd.call(this, data);
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("groq.com")) {
    if (process.env.HQ_STUB_GROQ_OUT) fs.writeFileSync(process.env.HQ_STUB_GROQ_OUT, String(opts && opts.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ overview: "stub overview", summaries: {} }) } }] }), { status: 200 });
  }
  return realFetch(url, opts);
};
