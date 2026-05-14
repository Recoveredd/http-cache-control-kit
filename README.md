# http-cache-control-kit

[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Recoveredd/http-cache-control-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Recoveredd/http-cache-control-kit/actions/workflows/ci.yml)

Parse and format HTTP `Cache-Control` headers with structured diagnostics.

`http-cache-control-kit` is a clean-room TypeScript utility for small browser, worker, CLI and server tooling. It has no runtime dependencies and does not use Node-only APIs.

## Demo

Try the browser demo: [packages.wasta-wocket.fr/http-cache-control-kit](https://packages.wasta-wocket.fr/http-cache-control-kit/).

## Install

```bash
npm install http-cache-control-kit
```

## Quick Start

```ts
import {
  formatCacheControl,
  getCacheControlDeltaSeconds,
  parseCacheControl
} from "http-cache-control-kit";

const parsed = parseCacheControl("public, max-age=3600, stale-while-revalidate=30");

if (parsed.ok) {
  console.log(parsed.values.public); // true
  console.log(getCacheControlDeltaSeconds(parsed, "max-age")); // 3600
}

const header = formatCacheControl({
  public: true,
  "max-age": "3600",
  "stale-while-revalidate": "30"
});
```

## Why This Package

Use this package when you need to inspect a `Cache-Control` header and explain what is wrong with it. The parser returns directives plus stable diagnostic codes for duplicate directives, missing delta-seconds values, invalid quoted strings and unknown directives.

It intentionally does not evaluate full HTTP cache semantics across `Expires`, `Age`, `ETag`, request method or request-vs-response context. For that broader job, use a full cache semantics library.

## API

### `parseCacheControl(input, options?)`

Returns a result object. Invalid input and invalid directives are reported in `diagnostics` instead of throwing.

```ts
const result = parseCacheControl('private="Authorization, Cookie", max-age=60');

result.values.private; // "Authorization, Cookie"
result.values["max-age"]; // "60"
```

The parser accepts both request and response directives. For example, `max-stale` is valid without a value in request headers, but if a value is provided it must be valid `delta-seconds`.

```ts
parseCacheControl("max-stale").values["max-stale"]; // true
getCacheControlDeltaSeconds(parseCacheControl("max-stale=120"), "max-stale"); // 120
```

### `formatCacheControl(values, options?)`

Formats a directive map or parsed directive array back into a header string.

```ts
formatCacheControl({ "max-age": "60", private: "Authorization, Cookie" }, { sort: true });
// 'max-age=60, private="Authorization, Cookie"'
```

### `hasCacheControlDirective(result, directive)`

Case-insensitive presence check against a parse result.

### `getCacheControlDeltaSeconds(result, directive)`

Returns a numeric delta-seconds value when the directive exists and contains a non-negative integer.

## Diagnostics

Diagnostic codes are stable strings for tests, UI hints and logs:

- `empty-input`
- `expected-string`
- `empty-directive`
- `invalid-directive-name`
- `missing-value`
- `duplicate-directive`
- `invalid-quoted-string`
- `invalid-delta-seconds`
- `unknown-directive`

## Options

| Option | Default | Description |
| --- | --- | --- |
| `allowUnknown` | `false` | Keep unknown directives but report them as diagnostics unless enabled. |
| `allowDuplicates` | `false` | Keep repeated directives instead of reporting and ignoring later values. |
| `sort` | `false` | Sort formatted directives by name. |
| `quoteValues` | `"auto"` | Quote formatted values automatically, always or never. |

## Browser Compatibility

The core only uses strings, arrays, objects and regular expressions. It performs no I/O and has no dependency on `fs`, `path`, `Buffer`, `process` or network APIs.

## License

MPL-2.0
