# @gnndex/api-client

Shared OpenAPI-based API client.

## Commands

- Generate types from backend OpenAPI:
  - `npm --workspace packages/api-client run generate`
- Build package:
  - `npm --workspace packages/api-client run build`

## Usage

```ts
import { createGnndexClient } from "@gnndex/api-client";

const api = createGnndexClient("http://localhost:4000/v1");
const { data, error } = await api.POST("/auth/login", {
  body: { email: "trader@gnndex.com", password: "GnnDEX!2345" }
});
```

Auth retry example:

```ts
const api = createGnndexClient("http://localhost:4000/v1", { fetch: customFetch });
```
