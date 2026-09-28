import { db } from "../src/firebase";
async function main() {
  const snap = await db.collection("hubNotes").where("tenantId", "==", "7jG2XO3cOD3VtoL8YfFY").limit(3).get();
  for (const d of snap.docs) {
    const topicId = d.get("topicId");
    const topic = topicId ? await db.collection("hubTopics").doc(topicId).get() : null;
    console.log(d.id, "topicId=", topicId, "worksheetQuizId=", d.get("worksheetQuizId"), "topic doc:", topic ? JSON.stringify(topic.data()) : "MISSING");
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
