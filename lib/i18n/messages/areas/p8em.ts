// p8em: overnight i18n sweep (1 Oct 2026). Row order: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy. Use {brand} for the product name.
import { fromRows } from "./_rows";
import common from "./p8em-parts/common";
import templates from "./p8em-parts/templates";
import staffnotify from "./p8em-parts/staffnotify";
import newsfeed from "./p8em-parts/newsfeed";
import newsletter from "./p8em-parts/newsletter";
import em1 from "./p8em-parts/em1";
import em2 from "./p8em-parts/em2";
import em3 from "./p8em-parts/em3";
import em4 from "./p8em-parts/em4";
import em5 from "./p8em-parts/em5";
import em6 from "./p8em-parts/em6";
import em7 from "./p8em-parts/em7";

export default fromRows({
  ...common,
  ...templates,
  ...staffnotify,
  ...newsfeed,
  ...newsletter,
  ...em1,
  ...em2,
  ...em3,
  ...em4,
  ...em5,
  ...em6,
  ...em7,
});
