import { fbSignIn } from "../helpers/accounts";
import { loadState } from "./st4-lib";
(async () => { const st = loadState(); const tok = (await fbSignIn(st.emails.co)).idToken;
  const r = await fetch("http://localhost:4000/api/rota", { headers: { Authorization: `Bearer ${tok}` } }); const j: any = await r.json();
  console.log(r.status, JSON.stringify(j).slice(0, 900)); process.exit(0); })();
