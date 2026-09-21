import fs from "node:fs";
import { token, getNote, ROOT } from "./noteApi";
const id = process.argv[2]!;
async function main() {
  const n = await getNote(await token(), id);
  fs.writeFileSync(`${ROOT}/scratch/ownart/deck-now.json`, JSON.stringify(n.lesson!.deckSlides));
  console.log("updatedAt", JSON.stringify(n.updatedAt));
}
main().then(() => process.exit(0));
