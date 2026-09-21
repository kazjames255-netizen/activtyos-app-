// Thin wrapper kept for the original command: the KS2 Maths pack only. The real (pack-agnostic) seeder is seedCurriculum.ts.
//   npx tsx src/seedCurriculumKS2Maths.ts <tenantId> [--dry]  |  ... clean <tenantId>  |  ... check <tenantId>
// (clean removes ALL Maths curriculum docs of the tenant — i.e. `seedCurriculum.ts clean <tenant> --subject Maths`.)
if (process.argv[2] === "clean") { if (!process.argv.includes("--subject")) process.argv.push("--subject", "Maths"); }
else if (!process.argv.includes("--pack")) process.argv.push("--pack", "ks2maths");
void import("./seedCurriculum");
