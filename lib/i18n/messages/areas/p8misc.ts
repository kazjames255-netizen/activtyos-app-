// p8misc: overnight i18n sweep (1 Oct 2026). Guided tours (features/common/tour*), link badge labels, Gmail walkthrough.
// Row order: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy. Use {brand} for the product name.
// Keys: lt_<view>_* live tours, gt_<view>_* mock tours, sl_<view>_* "change it in Settings" links (see features/common/tourI18n.ts). Rows live in ./p8misc/*.ts.
import { fromRows } from "./_rows";
import { rows as ui } from "./p8misc/ui";
import { rows as sl } from "./p8misc/sl";
import { rows as lt1 } from "./p8misc/lt1";
import { rows as lt2 } from "./p8misc/lt2";
import { rows as gt1 } from "./p8misc/gt1";
import { rows as gt2 } from "./p8misc/gt2";
import { rows as gt3 } from "./p8misc/gt3";

export default fromRows({
  ...ui, ...sl, ...lt1, ...lt2, ...gt1, ...gt2, ...gt3,
});
