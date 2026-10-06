import { fbSignIn, loadState, saveState } from "./t2-lib";
(async () => { const S = loadState(); S.op = (await fbSignIn(S.opEmail)).idToken; for (const k of Object.keys(S.parents)) S.parents[k].tok = (await fbSignIn(S.parents[k].email)).idToken; saveState(S); console.log("tokens refreshed"); process.exit(0); })();
