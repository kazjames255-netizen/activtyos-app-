// Reads the real Manual source and returns every entry's visible text, so tests can measure length.
// Entry = a fact row { k, v }, a table/ladder row, a Lede/p/li paragraph, or a card built by col().
import ts from "typescript";
import { readFileSync } from "node:fs";

export type ManualEntry = { title: string; text: string; words: number; line: number };

const words = (s: string) => s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

function textOf(n: ts.Node | undefined): string {
  if (!n) return "";
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isJsxText(n)) return n.text.replace(/\s+/g, " ");
  if (ts.isJsxExpression(n)) return textOf(n.expression);
  if (ts.isParenthesizedExpression(n)) return textOf(n.expression);
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => textOf(s.expression) + s.literal.text).join("");
  if (ts.isJsxElement(n)) return n.children.map(textOf).join(" ");
  if (ts.isJsxFragment(n)) return n.children.map(textOf).join(" ");
  if (ts.isBinaryExpression(n)) return textOf(n.left) + textOf(n.right);
  return "";
}

/** `skipFunctions`: names of top-level functions to leave out (pages owned by another branch). */
export function manualEntries(file: string, skipFunctions: string[] = []): ManualEntry[] {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: ManualEntry[] = [];
  const add = (node: ts.Node, title: string, text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t) return;
    out.push({ title: title || t.slice(0, 50), text: t, words: words(`${title} ${t}`), line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  };
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name && skipFunctions.includes(n.name.text)) return;
    if (ts.isObjectLiteralExpression(n)) {
      const props = new Map<string, ts.Expression>();
      for (const p of n.properties) if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) props.set(p.name.text, p.initializer);
      if (props.has("k") && props.has("v")) add(n, textOf(props.get("k")), textOf(props.get("v")));
      else if (props.has("what") && props.has("when") && props.has("who")) add(n, textOf(props.get("what")), textOf(props.get("when")));
      else if (props.has("choice") && props.has("how")) add(n, textOf(props.get("choice")), textOf(props.get("how")));
      else if (props.has("t") && props.has("d")) add(n, textOf(props.get("t")), textOf(props.get("d")));
    }
    if (ts.isJsxElement(n)) {
      const tag = n.openingElement.tagName.getText();
      if (tag === "Lede" || tag === "p" || tag === "li" || tag === "dd") add(n, "", textOf(n));
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "col") {
      const a = n.arguments;
      add(n, textOf(a[1]), textOf(a[2]));
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}
