// Lists every string that needs native-speaker AND legal review before anyone relies on the translation:
// legal pages, pricing copy, safeguarding pages, and any string elsewhere that makes a compliance/price/security claim.
//   node scripts/i18n-v2/review-keys.mjs > docs/i18n-website-review-keys.tsv
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGES, LEGAL } from './convert.mjs';
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/en.json'), 'utf8'));
const CLAIM = /(GDPR|Ofsted|DBS|safeguard|HMRC|PAYE|ICO\b|SOC ?2|ISO ?27|PCI|encrypt|certif|compliance|compliant|legal|refund|commission|£\d|\d+%|per month|\/mo|billed|free trial|cancel|guarantee|liab|consent|data protection|backup|uptime|SLA)/i;
const scope = (k) => k.split('.')[0];
console.log('key\tpage\treason\tenglish');
for (const [k, v] of Object.entries(en)) {
  const s = scope(k); let why = '';
  if (LEGAL.has(s)) why = 'legal/safeguarding/security page';
  else if (s === 'pricing') why = 'pricing copy';
  else if (s === 'platform-safeguarding') why = 'safeguarding product claims';
  else if (s === 'js') why = /notice/.test(k) ? 'binding-English notice' : (CLAIM.test(v) ? 'claim' : '');
  else if (CLAIM.test(v)) why = 'claim (price/compliance/security/safeguarding wording)';
  if (why) console.log([k, s, why, v.replace(/\s+/g, ' ')].join('\t'));
}
