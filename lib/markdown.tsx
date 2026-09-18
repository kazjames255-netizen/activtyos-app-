import { Fragment, type ReactNode } from "react";

// Tiny, self-contained markdown renderer for static platform-only report
// pages (no user content, no XSS surface): headers (#/##/###), horizontal
// rules (---), tables (| a | b |), bulleted/numbered lists, blockquote
// callouts (> text) and inline **bold**/*italic*. Not a general-purpose
// markdown engine — just enough for the reference docs rendered in-app.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  boldParts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="text-[var(--ink)]">{part.slice(2, -2)}</strong>);
      return;
    }
    const italicParts = part.split(/(\*[^*]+\*)/g);
    italicParts.forEach((ip, j) => {
      if (ip.startsWith("*") && ip.endsWith("*") && ip.length > 1) {
        nodes.push(<em key={`${keyPrefix}-i${i}-${j}`}>{ip.slice(1, -1)}</em>);
      } else if (ip) {
        nodes.push(<Fragment key={`${keyPrefix}-t${i}-${j}`}>{ip}</Fragment>);
      }
    });
  });
  return nodes;
}

function parseTable(lines: string[]): { header: string[]; rows: string[][] } {
  const cells = (line: string) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  return { header, rows };
}

export function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    if (line.trim() === "---") {
      out.push(<hr key={`hr-${key++}`} className="my-5 border-[var(--line)]" />);
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(
        <h4 key={`h4-${key++}`} className="mb-1.5 mt-4 text-[14px] font-extrabold text-[var(--ink)]">
          {renderInline(line.slice(4), `h4-${key}`)}
        </h4>,
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      out.push(
        <h3 key={`h3-${key++}`} className="mb-2 mt-6 font-[var(--ff-display)] text-[19px] font-extrabold text-[var(--ink)]">
          {renderInline(line.slice(3), `h3-${key}`)}
        </h3>,
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      out.push(
        <h2 key={`h2-${key++}`} className="mb-2 mt-2 font-[var(--ff-display)] text-[22px] font-extrabold text-[var(--ink)]">
          {renderInline(line.slice(2), `h2-${key}`)}
        </h2>,
      );
      i++;
      continue;
    }

    // Blockquote callout: consecutive "> " lines rendered as one highlighted block.
    if (line.trim().startsWith("> ") || line.trim() === ">") {
      const quoted: string[] = [];
      let j = i;
      while (j < lines.length && (lines[j].trim().startsWith("> ") || lines[j].trim() === ">")) {
        quoted.push(lines[j].trim().replace(/^>\s?/, ""));
        j++;
      }
      out.push(
        <div key={`bq-${key++}`} className="my-3 rounded-xl border-l-4 border-l-[var(--brand)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {renderInline(quoted.join(" "), `bq-${key}`)}
        </div>,
      );
      i = j;
      continue;
    }

    // Table: a line starting with "|" followed by a "|---|---|" separator.
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?[\s:-]+\|[\s:|-]+$/)) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      const { header, rows } = parseTable(tableLines);
      out.push(
        <div key={`tbl-${key++}`} className="my-3 overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--panel)] text-left">
                {header.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 font-semibold text-[var(--ink-2)]">
                    {renderInline(h, `th-${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-[var(--line)] align-top last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-[var(--ink-2)]">
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j;
      continue;
    }

    // Numbered list: "1. text"
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && /^\d+\.\s/.test(lines[j].trim())) {
        items.push(lines[j].trim().replace(/^\d+\.\s/, ""));
        j++;
      }
      out.push(
        <ol key={`ol-${key++}`} className="my-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `oli-${key}-${ii}`)}</li>
          ))}
        </ol>,
      );
      i = j;
      continue;
    }

    // Bulleted list: "- text"
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("- ")) {
        items.push(lines[j].trim().slice(2));
        j++;
      }
      out.push(
        <ul key={`ul-${key++}`} className="my-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `uli-${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      i = j;
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines.
    const paraLines: string[] = [];
    let j = i;
    while (
      j < lines.length &&
      lines[j].trim() !== "" &&
      lines[j].trim() !== "---" &&
      !lines[j].startsWith("#") &&
      !lines[j].trim().startsWith("|") &&
      !lines[j].trim().startsWith("- ") &&
      !lines[j].trim().startsWith("> ") &&
      !/^\d+\.\s/.test(lines[j].trim())
    ) {
      paraLines.push(lines[j]);
      j++;
    }
    out.push(
      <p key={`p-${key++}`} className="my-2 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        {renderInline(paraLines.join(" "), `p-${key}`)}
      </p>,
    );
    i = j;
  }

  return out;
}
