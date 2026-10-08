import { loadAccounts } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
const a = loadAccounts().accounts;
const par = await fbSignIn(a.parent.email);
console.log("TRIPS", JSON.stringify(await apiFetch<unknown[]>("/api/my/trips", par.idToken)).slice(0, 500));
const n = await apiFetch<any>("/api/notifications", par.idToken);
console.log("NOTIFS", n.unread, n.notifications.map((x: any) => x.title));
