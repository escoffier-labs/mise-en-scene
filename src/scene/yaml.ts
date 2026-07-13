// Minimal YAML parser scoped to the OpenAPI subset Mise en Scene extracts.
//
// This is deliberately not a full YAML 1.2 implementation. It handles the
// constructs found in hand-written and tool-generated OpenAPI documents:
// nested block mappings, block and flow sequences, single/double/plain
// scalars, and block scalars (| and >). Anchors, aliases, explicit tags,
// complex keys, and multi-document streams are not supported.
//
// The parser is isolated behind this one module on purpose. When parsing
// fails or the result is not a usable object, callers fall back to plain-text
// extraction, so an unsupported construct degrades safely instead of producing
// a wrong scene. Swapping in a full YAML library later is a one-file change.

const MAX_DEPTH = 100;

type Line = { indent: number; content: string; raw: string; blank: boolean };

export function parseYaml(source: string): unknown {
  try {
    return new YamlParser(source).parseDocument();
  } catch {
    return null;
  }
}

class YamlParser {
  private lines: Line[];
  private pos = 0;

  constructor(source: string) {
    this.lines = source.replace(/^﻿/, "").split(/\r?\n/).map((raw) => {
      const stripped = stripComment(raw);
      const indent = stripped.match(/^ */)![0].length;
      const content = stripped.slice(indent).trimEnd();
      return { indent, content, raw, blank: content.length === 0 };
    });
  }

  parseDocument(): unknown {
    // Skip directives and document markers so a leading `---` does not derail parsing.
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.blank || line.content.startsWith("%") || line.content === "---" || line.content === "...") this.pos++;
      else break;
    }
    return this.parseValue(0, 0);
  }

  private current(): Line | null {
    while (this.pos < this.lines.length && this.lines[this.pos].blank) this.pos++;
    return this.pos < this.lines.length ? this.lines[this.pos] : null;
  }

  private parseValue(indent: number, depth: number): unknown {
    if (depth > MAX_DEPTH) throw new Error("yaml: nesting too deep");
    const line = this.current();
    if (!line || line.indent < indent) return null;
    if (isSequence(line.content)) return this.parseSequence(line.indent, depth);
    return this.parseMapping(line.indent, depth);
  }

  private parseMapping(indent: number, depth: number): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    while (true) {
      const line = this.current();
      if (!line || line.indent !== indent) break;
      const entry = matchMapping(line.content);
      if (!entry) break;
      this.pos++;
      map[entry.key] = this.readValue(indent, entry.inline, depth);
    }
    return map;
  }

  private parseSequence(indent: number, depth: number): unknown[] {
    const items: unknown[] = [];
    while (true) {
      const line = this.current();
      if (!line || line.indent !== indent || !isSequence(line.content)) break;
      const rest = line.content === "-" ? "" : line.content.slice(2);
      if (rest === "") {
        this.pos++;
        const child = this.current();
        items.push(child && child.indent > indent ? this.parseValue(child.indent, depth + 1) : null);
        continue;
      }
      // Rewrite `- rest` into a block starting where `rest` begins, then parse it
      // as a nested value so `- key: value` and `- nested` both work.
      const childIndent = indent + (line.content.length - rest.length);
      this.lines[this.pos] = { indent: childIndent, content: rest, raw: line.raw, blank: false };
      if (matchMapping(rest)) items.push(this.parseMapping(childIndent, depth + 1));
      else if (isSequence(rest)) items.push(this.parseSequence(childIndent, depth + 1));
      else {
        this.pos++;
        items.push(parseFlowOrScalar(rest));
      }
    }
    return items;
  }

  private readValue(indent: number, inline: string, depth: number): unknown {
    if (inline !== "") {
      if (inline === "|" || inline === ">" || /^[|>][+-]?\d?$/.test(inline)) return this.parseBlockScalar(indent, inline[0] === ">");
      return parseFlowOrScalar(inline);
    }
    const child = this.current();
    if (child && child.indent > indent) return this.parseValue(child.indent, depth + 1);
    if (child && child.indent === indent && isSequence(child.content)) return this.parseSequence(indent, depth + 1);
    return null;
  }

  private parseBlockScalar(parentIndent: number, folded: boolean): string {
    const rows: string[] = [];
    let base = Infinity;
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.blank) {
        rows.push("");
        this.pos++;
        continue;
      }
      if (line.indent <= parentIndent) break;
      base = Math.min(base, line.indent);
      rows.push(line.raw);
      this.pos++;
    }
    while (rows.length && rows[rows.length - 1] === "") rows.pop();
    if (!rows.length) return "";
    const stripped = rows.map((row) => (row === "" ? "" : row.slice(base)));
    if (!folded) return stripped.join("\n").trimEnd();
    let out = "";
    for (const row of stripped) {
      if (row === "") out += "\n";
      else out += (out && !out.endsWith("\n") ? " " : "") + row;
    }
    return out.trim();
  }
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "#" && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) {
      return line.slice(0, i);
    }
  }
  return line;
}

function isSequence(content: string): boolean {
  return content === "-" || content.startsWith("- ");
}

function matchMapping(content: string): { key: string; inline: string } | null {
  const match = content.match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:#][^:]*?)\s*:(?:\s+(.*))?$/);
  if (!match) return null;
  return { key: String(parseScalar(match[1])), inline: (match[2] ?? "").trim() };
}

function parseFlowOrScalar(token: string): unknown {
  const trimmed = token.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const flow = parseFlow(trimmed);
    if (flow !== undefined) return flow;
  }
  return parseScalar(trimmed);
}

function parseFlow(token: string): unknown {
  const value = token.trim();
  if (value.startsWith("[") && value.endsWith("]")) return splitFlow(value.slice(1, -1)).map(parseFlowOrScalar);
  if (value.startsWith("{") && value.endsWith("}")) {
    const map: Record<string, unknown> = {};
    for (const part of splitFlow(value.slice(1, -1))) {
      const colon = topLevelColon(part);
      if (colon < 0) continue;
      map[String(parseScalar(part.slice(0, colon)))] = parseFlowOrScalar(part.slice(colon + 1));
    }
    return map;
  }
  return undefined;
}

function splitFlow(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "[" || char === "{") depth++;
    else if (char === "]" || char === "}") depth--;
    else if (char === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  const tail = inner.slice(start);
  if (tail.trim() !== "" || parts.length) parts.push(tail);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function topLevelColon(part: string): number {
  let quote: string | null = null;
  for (let i = 0; i < part.length; i++) {
    const char = part[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === ":") return i;
  }
  return -1;
}

function parseScalar(token: string): unknown {
  const value = token.trim();
  if (value === "" || value === "~" || value === "null" || value === "Null" || value === "NULL") return null;
  if (value === "true" || value === "True" || value === "TRUE") return true;
  if (value === "false" || value === "False" || value === "FALSE") return false;
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, value.endsWith('"') ? -1 : undefined);
    }
  }
  if (value.startsWith("'")) return value.slice(1, value.endsWith("'") ? -1 : undefined).replace(/''/g, "'");
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}
