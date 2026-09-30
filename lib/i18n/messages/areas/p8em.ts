// p8em: overnight i18n sweep (1 Oct 2026). Row order: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy. Use {brand} for the product name.
import { fromRows } from "./_rows";
import common from "./p8em-parts/common";
import templates from "./p8em-parts/templates";
import staffnotify from "./p8em-parts/staffnotify";
import newsfeed from "./p8em-parts/newsfeed";

export default fromRows({
  ...common,
  ...templates,
  ...staffnotify,
  ...newsfeed,
});
