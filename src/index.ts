export type CacheControlDiagnosticCode =
  | "empty-input"
  | "expected-string"
  | "empty-directive"
  | "invalid-directive-name"
  | "missing-value"
  | "duplicate-directive"
  | "invalid-quoted-string"
  | "invalid-delta-seconds"
  | "unknown-directive";

export type CacheControlDiagnostic = {
  code: CacheControlDiagnosticCode;
  message: string;
  directive?: string;
  index?: number;
};

export type CacheControlDirectiveValue = string | true;

export type CacheControlDirective = {
  name: string;
  value: CacheControlDirectiveValue;
  raw: string;
};

export type CacheControlParseOptions = {
  allowUnknown?: boolean;
  allowDuplicates?: boolean;
};

export type CacheControlParseResult = {
  ok: boolean;
  input: string;
  directives: CacheControlDirective[];
  values: Record<string, CacheControlDirectiveValue>;
  diagnostics: CacheControlDiagnostic[];
};

export type CacheControlFormatOptions = {
  sort?: boolean;
  quoteValues?: "auto" | "always" | "never";
};

export type CacheControlFormatValue = CacheControlDirectiveValue | false | null | undefined;

const KNOWN_DIRECTIVES = new Set([
  "max-age",
  "max-stale",
  "min-fresh",
  "s-maxage",
  "no-cache",
  "no-store",
  "no-transform",
  "only-if-cached",
  "must-revalidate",
  "must-understand",
  "proxy-revalidate",
  "public",
  "private",
  "immutable",
  "stale-while-revalidate",
  "stale-if-error"
]);

const VALUE_REQUIRED = new Set([
  "max-age",
  "min-fresh",
  "s-maxage",
  "stale-while-revalidate",
  "stale-if-error"
]);

const DELTA_SECONDS = new Set([
  "max-age",
  "max-stale",
  "min-fresh",
  "s-maxage",
  "stale-while-revalidate",
  "stale-if-error"
]);

const TOKEN_RE = /^[!#$%&'*+.^_`|~0-9a-z-]+$/i;
const NEEDS_QUOTES_RE = /[\s,;="\\]/;

export function parseCacheControl(
  input: unknown,
  options: CacheControlParseOptions = {}
): CacheControlParseResult {
  if (typeof input !== "string") {
    return buildResult("", [], [
      diagnostic("expected-string", "Cache-Control header must be a string.")
    ]);
  }

  const source = input.trim();
  if (source.length === 0) {
    return buildResult(input, [], [diagnostic("empty-input", "Cache-Control header is empty.")]);
  }

  const diagnostics: CacheControlDiagnostic[] = [];
  const directives: CacheControlDirective[] = [];
  const seen = new Set<string>();

  for (const [index, part] of splitHeader(source).entries()) {
    const raw = part.trim();
    if (raw.length === 0) {
      diagnostics.push(diagnostic("empty-directive", "Empty directive between commas.", undefined, index));
      continue;
    }

    const separator = raw.indexOf("=");
    const rawName = separator === -1 ? raw : raw.slice(0, separator).trim();
    const name = rawName.toLowerCase();

    if (!TOKEN_RE.test(rawName)) {
      diagnostics.push(diagnostic("invalid-directive-name", "Directive name is not a valid HTTP token.", name, index));
      continue;
    }

    if (!options.allowUnknown && !KNOWN_DIRECTIVES.has(name)) {
      diagnostics.push(diagnostic("unknown-directive", "Directive is not in the known Cache-Control registry.", name, index));
    }

    if (!options.allowDuplicates && seen.has(name)) {
      diagnostics.push(diagnostic("duplicate-directive", "Directive appears more than once.", name, index));
      continue;
    }
    seen.add(name);

    let value: CacheControlDirectiveValue = true;
    if (separator !== -1) {
      const parsed = parseValue(raw.slice(separator + 1).trim());
      if (parsed.invalid) {
        diagnostics.push(diagnostic("invalid-quoted-string", "Quoted directive value is not closed.", name, index));
      }
      value = parsed.value;
    } else if (VALUE_REQUIRED.has(name)) {
      diagnostics.push(diagnostic("missing-value", "Directive requires a delta-seconds value.", name, index));
    }

    if (typeof value === "string" && DELTA_SECONDS.has(name) && !isDeltaSeconds(value)) {
      diagnostics.push(diagnostic("invalid-delta-seconds", "Directive value must be a non-negative integer.", name, index));
    }

    directives.push({ name, value, raw });
  }

  return buildResult(input, directives, diagnostics);
}

export function formatCacheControl(
  values: Record<string, CacheControlFormatValue> | CacheControlDirective[],
  options: CacheControlFormatOptions = {}
): string {
  const directives = Array.isArray(values)
    ? values.map(({ name, value }) => ({ name, value }))
    : Object.entries(values).map(([name, value]) => ({ name, value }));

  const sorted = options.sort
    ? [...directives].sort((left, right) => left.name.localeCompare(right.name))
    : directives;

  return sorted
    .filter(({ value }) => value !== false && value !== undefined && value !== null)
    .map(({ name, value }) => {
      const normalizedName = name.toLowerCase();
      if (value === true) return normalizedName;
      return `${normalizedName}=${formatValue(String(value), options.quoteValues ?? "auto")}`;
    })
    .join(", ");
}

export function hasCacheControlDirective(
  result: CacheControlParseResult,
  directive: string
): boolean {
  return Object.hasOwn(result.values, directive.toLowerCase());
}

export function getCacheControlDeltaSeconds(
  result: CacheControlParseResult,
  directive: string
): number | undefined {
  const value = result.values[directive.toLowerCase()];
  if (typeof value !== "string" || !isDeltaSeconds(value)) return undefined;
  return Number(value);
}

function buildResult(
  input: string,
  directives: CacheControlDirective[],
  diagnostics: CacheControlDiagnostic[]
): CacheControlParseResult {
  const values: Record<string, CacheControlDirectiveValue> = {};
  for (const directive of directives) {
    values[directive.name] = directive.value;
  }

  return {
    ok: diagnostics.length === 0,
    input,
    directives,
    values,
    diagnostics
  };
}

function splitHeader(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (quoted && char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (char === "\"") quoted = !quoted;
    if (char === "," && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
}

function parseValue(raw: string): { value: string; invalid: boolean } {
  if (!raw.startsWith("\"")) return { value: raw, invalid: false };

  let value = "";
  let escaped = false;
  for (let index = 1; index < raw.length; index += 1) {
    const char = raw[index] ?? "";
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      const trailing = raw.slice(index + 1).trim();
      return { value, invalid: trailing.length > 0 };
    }
    value += char;
  }

  return { value, invalid: true };
}

function formatValue(value: string, quoteMode: NonNullable<CacheControlFormatOptions["quoteValues"]>): string {
  if (quoteMode === "never") return value;
  if (quoteMode === "always" || value.length === 0 || NEEDS_QUOTES_RE.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
  }
  return value;
}

function isDeltaSeconds(value: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(value);
}

function diagnostic(
  code: CacheControlDiagnosticCode,
  message: string,
  directive?: string,
  index?: number
): CacheControlDiagnostic {
  return {
    code,
    message,
    ...(directive === undefined ? {} : { directive }),
    ...(index === undefined ? {} : { index })
  };
}
