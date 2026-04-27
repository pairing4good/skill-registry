# OpenAPI Rule Catalog

Use this catalog when performing an OpenAPI contract check. Work through each category. For every rule, check the spec and record any violations.

**Format for each rule:**
- **Rule ID** — unique identifier to include in the findings report
- **Severity** — ERROR / WARNING / INFO
- **Versions** — which OpenAPI versions this rule applies to (ALL, 3.x only, 2.x only)
- **Check** — what to verify
- **Violation example** — what a bad spec looks like
- **Fix example** — what the corrected spec looks like

---

## Category 1: Info Object

### RULE-INFO-001
**Severity:** WARNING | **Versions:** ALL  
**Check:** `info.title` is present and not a placeholder ("My API", "API Title", "Untitled").  
**Violation:** `title: My API`  
**Fix:** `title: Payment Processing API`

### RULE-INFO-002
**Severity:** INFO | **Versions:** ALL  
**Check:** `info.description` is present and at least one sentence (not empty string).  
**Violation:** `description: ""`  
**Fix:** `description: "Handles payment authorization, capture, and refunds for the checkout flow."`

### RULE-INFO-003
**Severity:** WARNING | **Versions:** ALL  
**Check:** `info.version` follows semver or a consistent versioning scheme (not "1", "v1", "latest").  
**Violation:** `version: latest`  
**Fix:** `version: 1.4.2`

### RULE-INFO-004
**Severity:** INFO | **Versions:** ALL  
**Check:** `info.contact` is present with at least an `email` or `url`.  
**Violation:** `contact` key missing  
**Fix:** `contact:\n  email: api-support@example.com`

---

## Category 2: Paths and Operations

### RULE-PATH-001
**Severity:** ERROR | **Versions:** ALL  
**Check:** No duplicate path + method combinations.  
**Violation:** Two `GET /users/{id}` entries  
**Fix:** Remove the duplicate; consolidate into one operation

### RULE-PATH-002
**Severity:** WARNING | **Versions:** ALL  
**Check:** Every operation has a `summary` (short, imperative: "Get user by ID", not "Returns the user").  
**Violation:** `summary` missing or "Returns a user object"  
**Fix:** `summary: Get user by ID`

### RULE-PATH-003
**Severity:** INFO | **Versions:** ALL  
**Check:** Every operation has a non-empty `description` that adds context beyond the summary.  
**Violation:** `description` missing or same text as `summary`  
**Fix:** `description: "Returns the full user profile including preferences and roles. Requires authentication."`

### RULE-PATH-004
**Severity:** WARNING | **Versions:** ALL  
**Check:** Every operation has at least one `tag`. Tags must appear in the top-level `tags` array.  
**Violation:** Operation has no `tags`, or uses a tag not listed at the top level  
**Fix:** Add `tags: [Users]` and ensure `tags:\n  - name: Users` exists at top level

### RULE-PATH-005
**Severity:** WARNING | **Versions:** ALL  
**Check:** Every operation has a unique, non-empty `operationId` in camelCase or snake_case.  
**Violation:** `operationId` missing, or two operations share the same ID  
**Fix:** `operationId: getUserById`

### RULE-PATH-006
**Severity:** INFO | **Versions:** ALL  
**Check:** Path parameters use consistent casing (prefer camelCase or snake_case — not a mix).  
**Violation:** `/users/{userId}` and `/orders/{order_id}` in same spec  
**Fix:** Standardize to one convention throughout

### RULE-PATH-007
**Severity:** ERROR | **Versions:** ALL  
**Check:** Every path parameter declared in the URL `{}` is defined in the `parameters` list with `in: path` and `required: true`.  
**Violation:** `GET /users/{id}` with no `parameters` block  
**Fix:** Add `parameters:\n  - name: id\n    in: path\n    required: true\n    schema:\n      type: string`

### RULE-PATH-008
**Severity:** INFO | **Versions:** ALL  
**Check:** Operations marked `deprecated: true` include a `description` explaining the replacement or timeline (e.g., "Deprecated. Use `GET /v2/users` instead. Will be removed 2025-01-01.").  
**Violation:** `deprecated: true` with no context in `description`  
**Fix:** Add a description on the operation: `description: "Deprecated. Use GET /v2/users instead. Will be removed 2025-01-01."`

### RULE-PATH-009
**Severity:** INFO | **Versions:** ALL  
**Check:** Path segments use plural nouns for collection resources and contain no verbs (REST convention).  
**Violation:** `/getUser`, `/user/{id}`, `/user/create`  
**Fix:** `/users`, `/users/{id}`, `POST /users`

---

## Category 3: Parameters

### RULE-PARAM-001
**Severity:** ERROR | **Versions:** ALL  
**Check:** Every parameter has a `name`, `in`, and `schema` (or `content` for complex types).  
**Violation:** `- in: query` with no `name` or `schema`  
**Fix:** Add all required fields

### RULE-PARAM-002
**Severity:** WARNING | **Versions:** ALL  
**Check:** Every parameter has a `description`.  
**Violation:** `name: limit` with no `description`  
**Fix:** `description: "Maximum number of results to return. Defaults to 20, max 100."`

### RULE-PARAM-003
**Severity:** WARNING | **Versions:** ALL  
**Check:** Query parameters that have a sensible default specify it via `schema.default`.  
**Violation:** `name: limit` with no `default`  
**Fix:** `schema:\n  type: integer\n  default: 20\n  maximum: 100`

### RULE-PARAM-004
**Severity:** INFO | **Versions:** ALL  
**Check:** Boolean query parameters use `schema.type: boolean`, not `string` with enum `["true","false"]`.  
**Violation:** `schema:\n  type: string\n  enum: [true, false]`  
**Fix:** `schema:\n  type: boolean`

### RULE-PARAM-005
**Severity:** WARNING | **Versions:** 3.x only  
**Check:** No `in: body` parameters (this is OAS 2.x syntax; use `requestBody` in OAS 3.x).  
**Violation:** `in: body` in an OAS 3.x spec  
**Fix:** Replace with a `requestBody` block

---

## Category 4: Request Body

### RULE-REQBODY-001
**Severity:** WARNING | **Versions:** 3.x only  
**Check:** POST, PUT, and PATCH operations that modify a resource have a `requestBody`.  
**Violation:** `POST /users` with no `requestBody`  
**Fix:** Add `requestBody` with content type and schema

### RULE-REQBODY-002
**Severity:** WARNING | **Versions:** ALL  
**Check:** `requestBody` specifies whether it is `required: true` or `required: false`.  
**Violation:** `requestBody` block with no `required` field  
**Fix:** `requestBody:\n  required: true`

### RULE-REQBODY-003
**Severity:** WARNING | **Versions:** ALL  
**Check:** `requestBody` includes at least one content type (typically `application/json`).  
**Violation:** `content: {}` (empty)  
**Fix:** `content:\n  application/json:\n    schema:\n      $ref: '#/components/schemas/CreateUserRequest'`

### RULE-REQBODY-004
**Severity:** INFO | **Versions:** ALL  
**Check:** Request body schemas use `$ref` to a named component rather than an inline anonymous schema longer than ~5 properties.  
**Violation:** Large inline `properties` block in `requestBody`  
**Fix:** Move to `components/schemas` and use `$ref`

---

## Category 5: Responses

### RULE-RESP-001
**Severity:** ERROR | **Versions:** ALL  
**Check:** Every operation defines at least a success response (2xx) and a generic error response (`default` or `4xx`/`5xx`).  
**Violation:** Operation with only `200` defined  
**Fix:** Add at minimum `400` (bad request) and `500` (server error), or a `default` response

### RULE-RESP-002
**Severity:** WARNING | **Versions:** ALL  
**Check:** `POST` operations creating a resource return `201 Created`, not `200 OK`.  
**Violation:** `POST /users` returning `200`  
**Fix:** Change to `'201':`

### RULE-RESP-003
**Severity:** WARNING | **Versions:** ALL  
**Check:** `DELETE` operations return `204 No Content` (or `200` with a body — not `201`).  
**Violation:** `DELETE /users/{id}` returning `201`  
**Fix:** Change to `'204':` with no content body

### RULE-RESP-004
**Severity:** WARNING | **Versions:** ALL  
**Check:** Operations that can return `404` (resource not found) declare it explicitly.  
**Violation:** `GET /users/{id}` with no `404` defined  
**Fix:** Add `'404':\n  description: User not found\n  content: ...`

### RULE-RESP-005
**Severity:** WARNING | **Versions:** ALL  
**Check:** Operations behind authentication declare a `401 Unauthorized` response.  
**Violation:** Authenticated endpoint with no `401`  
**Fix:** Add `'401':\n  description: Authentication required`

### RULE-RESP-006
**Severity:** INFO | **Versions:** ALL  
**Check:** Error responses use a consistent schema (e.g., `{ error: string, code: string }`), ideally via a shared `$ref`.  
**Violation:** Different error shapes across 404 and 500 responses  
**Fix:** Define an `ErrorResponse` schema in `components/schemas` and reference it everywhere

### RULE-RESP-007
**Severity:** WARNING | **Versions:** ALL  
**Check:** Every response with a body specifies at least one content type.  
**Violation:** `'200':\n  description: OK` with no `content`  
**Fix:** Add `content:\n  application/json:\n    schema:\n      $ref: '#/components/schemas/User'`

### RULE-RESP-008
**Severity:** INFO | **Versions:** ALL  
**Check:** Response schemas include at least one `example` or the `schema` references a component that has one.  
**Violation:** Schema defined but no `example` anywhere in the response  
**Fix:** Add `example:` inline or in the schema component

### RULE-RESP-009
**Severity:** WARNING | **Versions:** ALL  
**Check:** `GET` operations that return an array (or a wrapper object containing an array) document pagination — either via `limit`/`offset` query parameters, a cursor parameter, or a `Link` header. An unbounded list endpoint is a latency and memory risk for callers.  
**Violation:** `GET /orders` returning `schema: type: array` with no pagination parameters documented  
**Fix:** Add `limit` and `offset` (or `cursor`) query parameters, document their defaults and maximums, and describe the total-count or next-page mechanism in the response schema

---

## Category 6: Schema Quality

### RULE-SCHEMA-001
**Severity:** WARNING | **Versions:** ALL  
**Check:** Object schemas declare a `required` array listing all fields that are always present.  
**Violation:** Schema with `properties` but no `required` array  
**Fix:** Add `required: [id, email, createdAt]`

### RULE-SCHEMA-002
**Severity:** INFO | **Versions:** ALL  
**Check:** String properties that have a fixed set of values use `enum`.  
**Violation:** `status` property described as "one of: active, inactive, pending" in `description` only  
**Fix:** `enum: [active, inactive, pending]`

### RULE-SCHEMA-003
**Severity:** WARNING | **Versions:** ALL  
**Check:** No properties are typed as `{}` or `type: object` without any `properties` or `additionalProperties` definition (unless intentionally dynamic).  
**Violation:** `metadata:\n  type: object` with nothing else  
**Fix:** Define properties or add `additionalProperties: true` with a comment explaining the dynamic shape

### RULE-SCHEMA-004
**Severity:** ERROR | **Versions:** ALL  
**Check:** Nullable fields use the syntax appropriate for the spec version. In OAS 3.0.x: use `nullable: true` (the `null` type keyword is not valid). In OAS 3.1.x: use `type: [string, null]` or a `oneOf` with `type: null` (`nullable` was removed). In OAS 2.x: use `x-nullable: true`.  
**Violation (3.0.x):** `type: [string, null]` — `null` is not a valid type in 3.0.x  
**Fix (3.0.x):** `type: string\nnullable: true`  
**Violation (3.1.x):** `nullable: true` — the keyword was removed in 3.1  
**Fix (3.1.x):** `type: [string, null]`

### RULE-SCHEMA-005
**Severity:** WARNING | **Versions:** ALL  
**Check:** Date/time fields use `format: date-time` or `format: date` (ISO 8601), not plain strings.  
**Violation:** `createdAt:\n  type: string\n  description: "ISO 8601 timestamp"`  
**Fix:** `createdAt:\n  type: string\n  format: date-time`

### RULE-SCHEMA-006
**Severity:** INFO | **Versions:** ALL  
**Check:** Schemas in `components/schemas` have a `description`.  
**Violation:** Named schema with no top-level `description`  
**Fix:** Add `description: "Represents a registered user account."`

---

## Category 7: Security

### RULE-SEC-001
**Severity:** ERROR | **Versions:** ALL  
**Check:** All security schemes referenced in operations are defined in `components/securitySchemes` (OAS 3.x) or `securityDefinitions` (OAS 2.x).  
**Violation:** `security: [{bearerAuth: []}]` on an operation but no `bearerAuth` defined in components  
**Fix:** Add the scheme definition to `components/securitySchemes`

### RULE-SEC-002
**Severity:** WARNING | **Versions:** ALL  
**Check:** Every operation that requires authentication declares `security` (either at operation level or via a global `security` declaration).  
**Violation:** Protected endpoint with no `security` block and no global security  
**Fix:** Add `security: [{bearerAuth: []}]` to the operation or globally

### RULE-SEC-003
**Severity:** INFO | **Versions:** ALL  
**Check:** Public endpoints that intentionally bypass global security explicitly declare `security: []`.  
**Violation:** `POST /auth/login` with a global bearer security but no override  
**Fix:** Add `security: []` to the login operation

### RULE-SEC-004
**Severity:** WARNING | **Versions:** 3.x only  
**Check:** OAuth2 flows define at least one scope. Operations using OAuth2 reference at least one scope.  
**Violation:** `flows` defined but scopes is `{}`  
**Fix:** Define meaningful scopes: `scopes:\n  read:users: Read user profiles`

---

## Category 8: Servers

### RULE-SERVER-001
**Severity:** WARNING | **Versions:** 3.x only  
**Check:** At least one `servers` entry is defined (not relying on the default `http://localhost`).  
**Violation:** No `servers` block  
**Fix:** Add `servers:\n  - url: https://api.example.com/v1`

### RULE-SERVER-002
**Severity:** INFO | **Versions:** 3.x only  
**Check:** Each server entry has a `description`.  
**Violation:** `url: https://api.example.com` with no `description`  
**Fix:** `description: Production`

### RULE-SERVER-003
**Severity:** INFO | **Versions:** 3.x only  
**Check:** If multiple environments are listed (prod, staging, dev), they are all present.  
**Violation:** Only production server listed; no staging or sandbox  
**Fix:** Add staging and/or sandbox entries for developer testing

---

## Category 9: Tags

### RULE-TAG-001
**Severity:** WARNING | **Versions:** ALL  
**Check:** All tags used in operations are declared in the top-level `tags` array with a `name` and `description`.  
**Violation:** Operation uses tag `Payments` but it's not in the top-level `tags` list  
**Fix:** Add `- name: Payments\n  description: Payment authorization and capture operations`

### RULE-TAG-002
**Severity:** INFO | **Versions:** ALL  
**Check:** Top-level `tags` are ordered logically (by resource, not alphabetically — unless alphabetical is intentional).  
**Violation:** Tags declared in the order they were added  
**Fix:** Reorder to match the primary resource hierarchy

---

## Category 10: Reusability and Component Organization

### RULE-COMP-001
**Severity:** INFO | **Versions:** ALL  
**Check:** Schemas used in more than one place are defined in `components/schemas` and referenced via `$ref`.  
**Violation:** Same `User` schema properties duplicated across two response bodies  
**Fix:** Extract to `components/schemas/User` and replace duplicates with `$ref: '#/components/schemas/User'`

### RULE-COMP-002
**Severity:** INFO | **Versions:** 3.x only  
**Check:** Common response objects (e.g., `ErrorResponse`, `PaginatedList`) are in `components/responses` and referenced via `$ref`.  
**Violation:** `404` response defined identically in 8 different operations  
**Fix:** Define `components/responses/NotFound` and use `$ref: '#/components/responses/NotFound'`

### RULE-COMP-003
**Severity:** INFO | **Versions:** ALL  
**Check:** Reusable parameters (e.g., `X-Request-ID` header, `limit`/`offset`) are defined in `components/parameters`.  
**Violation:** `limit` query parameter defined separately on 15 operations  
**Fix:** Define once in `components/parameters/LimitParam` and `$ref` everywhere

### RULE-COMP-004
**Severity:** WARNING | **Versions:** ALL  
**Check:** No `$ref` pointers are broken (reference a path that doesn't exist in the spec or in an external file that isn't available).  
**Violation:** `$ref: '#/components/schemas/OrderItem'` but `OrderItem` is not defined  
**Fix:** Define the missing schema or correct the reference path
