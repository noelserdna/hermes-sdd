// match.mjs — the one text comparator of the method: does a text (a narration, the code of a test, what a capture
// checked) say a fixed part of a criterion's «Se ve»? Every lint that compares a criterion's text calls this; none
// writes its own `includes` (the «día(s)» agreement was repaired three times, one comparator each time, and the last
// repair left quotes.mjs behind: material-montana11, a false MISSING signed away with a waiver).
//
// The rule: the part must be in the text verbatim (case, accents and punctuation kept), except «(s)» and «(es)»,
// which mean singular or plural, as the screen shows it: «día(s) de retraso» is said by «1 día de retraso» and by
// «3 días de retraso». A plural right after a {slot} is written that way by templateParts (sdd-jev.mjs). The caller
// normalizes both sides the same way first when its medium needs it (quotes.mjs: quote marks and whitespace of code).
const OPTIONAL = /(\((?:s|es)\))/i;
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does `text` say `part`? */
export function says(text, part) {
  text = String(text ?? ""); part = String(part ?? "");
  if (!OPTIONAL.test(part)) return text.includes(part);
  // the optional ending is followed by no letter: «unidad(es)» is «unidad» or «unidades», never «unidade»
  const re = part.split(OPTIONAL).map((x, i) => (i % 2 ? `(?:${x.slice(1, -1)})?(?!\\p{L})` : esc(x))).join("");
  return new RegExp(re, "u").test(text);
}

/** Does `text` say every part? */
export function saysAll(text, parts) {
  return (parts || []).every((p) => says(text, p));
}
