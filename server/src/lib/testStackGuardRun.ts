// Side-effect import: runs the test-stack guard at module-evaluation time. Import it directly after dotenv and BEFORE
// anything that touches Firebase (ES imports evaluate in order, so a plain call in the entry file would run too late).
import { enforceTestStackGuard } from "./testStackGuard";
enforceTestStackGuard();
