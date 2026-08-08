// Minimal YAML parser scoped to the OpenAPI subset Mise en Scene extracts.
//
// This is deliberately not a full YAML 1.2 implementation. It handles the
// constructs found in hand-written and tool-generated OpenAPI documents:
// nested block mappings, block and flow sequences, single/double/plain
// scalars, and block scalars (| and >). Anchors, aliases, merge keys,
// duplicate keys, tab indentation, explicit tags, complex keys, and
// multi-document streams are not supported.
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
      const lead = raw.match(/^[ \t]*/)?.[0] ?? "";
      if (lead.includes("\t")) throw new Error("yaml: tab indentation");
      const stripped = stripComment(raw);
      const indent = stripped.match(/^ */)![0].length;
      const content = stripped.slice(indent).trimEnd();
      return { indent, content, raw, blank: content.length === 0 };
    });
  }

  parseDocument(): unknown {
    // Skip directives and at most one document start marker. Extra `---` means a
    // multi-document stream, which this subset does not support.
    let sawDocStart = false;
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.blank || line.content.startsWith("%")) {
        this.pos++;
        continue;
      }
      if (line.content === "---") {
        if (sawDocStart) throw new Error("yaml: multiple documents unsupported");
        sawDocStart = true;
        this.pos++;
        continue;
      }
      if (line.content === "...") {
        this.pos++;
        continue;
      }
      break;
    }
    const value = this.parseValue(0, 0);
    let sawDocEnd = false;
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.blank) {
        this.pos++;
        continue;
      }
      if (line.content === "..." && !sawDocEnd) {
        sawDocEnd = true;
        this.pos++;
        continue;
      }
      throw new Error("yaml: trailing content");
    }
    return value;
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
    const map = Object.create(null) as Record<string, unknown>;
    while (true) {
      const line = this.current();
      if (!line || line.indent < indent) break;
      if (line.indent > indent) throw new Error("yaml: unexpected indentation");
      if (isSequence(line.content)) break;
      const entry = matchMapping(line.content);
      if (!entry) throw new Error("yaml: expected mapping entry");
      if (entry.key === "<<") throw new Error("yaml: merge keys unsupported");
      if (Object.prototype.hasOwnProperty.call(map, entry.key)) throw new Error("yaml: duplicate key");
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
        items.push(parseFlowOrScalar(rest, depth + 1));
      }
    }
    return items;
  }

  private readValue(indent: number, inline: string, depth: number): unknown {
    if (inline !== "") {
      const trimmed = inline.trim();
      rejectAnchorAliasOrTag(trimmed);
      if (trimmed === "|" || trimmed === ">" || /^[|>][+-]?\d?$/.test(trimmed)) return this.parseBlockScalar(indent, trimmed[0] === ">");
      return parseFlowOrScalar(trimmed, depth + 1);
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
      // Use raw rows so hash-prefixed content inside block scalars is preserved
      // even though stripComment already ran for mapping/sequence parsing.
      if (line.raw.trim() === "") {
        rows.push("");
        this.pos++;
        continue;
      }
      const indent = line.raw.match(/^ */)?.[0].length ?? 0;
      if (indent <= parentIndent) break;
      base = Math.min(base, indent);
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
      if (char === "\\" && quote === '"') {
        i++;
        continue;
      }
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
  rejectKeyToken(match[1]);
  return { key: String(parseScalar(match[1])), inline: (match[2] ?? "").trim() };
}

function rejectKeyToken(rawKey: string): void {
  const key = rawKey.trim();
  if (key.startsWith('"') || key.startsWith("'")) return;
  rejectAnchorAliasOrTag(key);
}

function rejectAnchorAliasOrTag(token: string): void {
  const value = token.trim();
  if (!value) return;
  if (value.startsWith("!")) throw new Error("yaml: tags unsupported");
  if (value.startsWith("&") || value.startsWith("*")) throw new Error("yaml: anchors and aliases unsupported");
}

function parseFlowOrScalar(token: string, depth: number): unknown {
  const trimmed = token.trim();
  rejectAnchorAliasOrTag(trimmed);
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    // Validate delimiters once at the outer flow entry. Nested recursion trusts
    // that scan; re-running assertBalancedFlow on every child is O(n^2).
    assertBalancedFlow(trimmed);
    return parseFlow(trimmed, depth);
  }
  return parseScalar(trimmed);
}

function parseFlowChild(token: string, depth: number): unknown {
  const trimmed = token.trim();
  rejectAnchorAliasOrTag(trimmed);
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseFlow(trimmed, depth);
  return parseScalar(trimmed);
}

function parseFlow(token: string, depth: number): unknown {
  if (depth > MAX_DEPTH) throw new Error("yaml: nesting too deep");
  const value = token.trim();
  if (!value.startsWith("[") && !value.startsWith("{")) throw new Error("yaml: expected flow node");
  if (value.startsWith("[")) return splitFlow(value.slice(1, -1)).map((part) => parseFlowChild(part, depth + 1));
  const map = Object.create(null) as Record<string, unknown>;
  for (const part of splitFlow(value.slice(1, -1))) {
    const colon = topLevelColon(part);
    if (colon < 0) throw new Error("yaml: invalid flow mapping entry");
    const rawKey = part.slice(0, colon);
    rejectKeyToken(rawKey);
    const key = String(parseScalar(rawKey));
    if (key === "<<") throw new Error("yaml: merge keys unsupported");
    if (Object.prototype.hasOwnProperty.call(map, key)) throw new Error("yaml: duplicate key");
    map[key] = parseFlowChild(part.slice(colon + 1), depth + 1);
  }
  return map;
}

function assertBalancedFlow(value: string): void {
  const stack: string[] = [];
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i++;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "[" || char === "{") {
      stack.push(char);
      continue;
    }
    if (char === "]" || char === "}") {
      const open = stack.pop();
      if (!open) throw new Error("yaml: unbalanced flow");
      if ((open === "[" && char !== "]") || (open === "{" && char !== "}")) {
        throw new Error("yaml: mismatched flow delimiters");
      }
      if (stack.length === 0 && i !== value.length - 1) throw new Error("yaml: trailing content in flow");
    }
  }
  if (quote || stack.length !== 0) throw new Error("yaml: unbalanced flow");
}

function splitFlow(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i++;
        continue;
      }
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "[" || char === "{") depth++;
    else if (char === "]" || char === "}") depth--;
    else if (char === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  if (quote) throw new Error("yaml: unterminated quote in flow");
  const tail = inner.slice(start);
  if (tail.trim() !== "" || parts.length) parts.push(tail);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function topLevelColon(part: string): number {
  let quote: string | null = null;
  for (let i = 0; i < part.length; i++) {
    const char = part[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i++;
        continue;
      }
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
    if (value.length < 2 || !value.endsWith('"')) throw new Error("yaml: unterminated double quote");
    return parseDoubleQuoted(value);
  }
  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) throw new Error("yaml: unterminated single quote");
    let out = "";
    for (let i = 1; i < value.length - 1; i++) {
      if (value[i] === "'") {
        if (value[i + 1] === "'") {
          out += "'";
          i++;
          continue;
        }
        throw new Error("yaml: invalid single-quoted scalar");
      }
      out += value[i];
    }
    return out;
  }
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}

function parseDoubleQuoted(value: string): string {
  let out = "";
  for (let i = 1; i < value.length - 1; i++) {
    const char = value[i];
    if (char !== "\\") {
      out += char;
      continue;
    }
    if (i + 1 >= value.length - 1) throw new Error("yaml: invalid double-quoted scalar");
    const next = value[++i];
    switch (next) {
      case "\\":
      case '"':
      case "/":
        out += next;
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "x": {
        const hex = value.slice(i + 1, i + 3);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error("yaml: invalid double-quoted scalar");
        out += String.fromCharCode(Number.parseInt(hex, 16));
        i += 2;
        break;
      }
      case "u": {
        const hex = value.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("yaml: invalid double-quoted scalar");
        out += String.fromCharCode(Number.parseInt(hex, 16));
        i += 4;
        break;
      }
      default:
        throw new Error("yaml: invalid double-quoted scalar");
    }
  }
  return out;
}
