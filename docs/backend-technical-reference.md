# Backend Technical Reference

This document describes the current Express and Mongoose implementation in this repository. It is based on the source code as it exists today; notes marked **Implementation note** call out behavior that may be surprising from an API consumer's perspective.

## 1. Application overview

The backend is a CommonJS Node.js application using Express 5 and Mongoose. `server.js` loads environment configuration, installs global middleware, serves static frontend assets, mounts the API router, connects to MongoDB, and starts listening after a successful database connection.

### Startup configuration

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Required MongoDB connection string. |
| `JWT_SECRET` | Required by startup and used by `authmiddleware` to verify JWTs. |
| `PORT` | HTTP port; defaults to `3000`. |
| `BASE_PATH` or `APP_BASE_PATH` | Main application prefix; defaults to `/tbc_connect`. `BASE_PATH` takes precedence. |
| `APP_BASE_URL` | Optional base URL used by the periodic self-ping. |
| `PUBLIC_REDIRECT_BASE` | Optional public host used to build profile-page URLs. |
| `LEGACY_PROFILE_REDIRECT_URL` through `_7` | Optional replacement destinations for seven legacy profile IDs. |
| `LEGACY_PROFILE_REDIRECT_STATUS` | Legacy redirect code, restricted to `301` or `302`; defaults to `302`. |

At the default base path, the router is mounted at `/tbc_connect/api`, `/tbc/api`, and `/nfc/api`. `/tbc_connect/api` remains available even when a custom `BASE_PATH` is configured. The configured main API is `${BASE_PATH}/api`.

### Global request pipeline

The server trusts one proxy hop, enables CORS for all origins and the listed common methods/headers, parses JSON and URL-encoded request bodies, serves the `public` directory at `/` and under `BASE_PATH`, applies Helmet, and logs requests with Morgan. A global error handler returns a generic 500 JSON response for errors reaching it.

Health endpoints are available at `/health` and `${BASE_PATH}/health`. The API root returns a small JSON status response. The frontend config script is served at `/config.js` and `${BASE_PATH}/config.js`.

## 2. Data models

### Profile — `model/profilemodel.js`

Mongoose model name: `Profile` (MongoDB collection inferred by Mongoose as `profiles`). Timestamps are enabled, so documents include `createdAt` and `updatedAt`.

| Field | Type | Default / notes |
| --- | --- | --- |
| `name` | String | Empty string |
| `phone` | String | Empty string |
| `email` | String | Empty string |
| `address` | String | Empty string |
| `bio` | String | Empty string |
| `googleBusiness` | String | Empty string |
| `instagram` | String | Empty string |
| `linkedin` | String | Empty string |
| `facebook` | String | Empty string |
| `youtube` | String | Empty string |
| `website` | String | Empty string |
| `userId` | ObjectId reference to `Login` | `null` by default; see implementation note below |
| `createdByEmail` | String | Empty string; used in profile ownership queries |
| `createdAt`, `updatedAt` | Date | Managed by Mongoose timestamps |

**Implementation note:** the referenced model is registered as `User` in `authmodel.js`, while the profile schema's `ref` is `Login`. The current profile endpoints do not populate this reference, so ordinary profile reads do not use the ref; update the ref if population is introduced.

### User — `model/authmodel.js`

Mongoose model name: `User` (MongoDB collection inferred as `users`).

| Field | Type | Rules |
| --- | --- | --- |
| `email` | String | Required, unique index |
| `password` | String | Required; controllers store a bcrypt hash |
| `role` | String | `user` or `admin`; defaults to `user` |
| `createdAt` | Date | Defaults to current time |

The model does not define `name` or `lastLogin`; login controllers include those in their response/update flow, but they are not persisted schema fields here.

## 3. Controllers

### Profile controller — `controller/profilecontroller.js`

The controller handles profile creation and CRUD, public JSON lookup, legacy HTML profile rendering, input normalization, ownership checks for updates, profile URL construction, and profile-related diagnostics.

- `createProfile`: builds a sanitized profile from the request body, associates `req.user` identity when present, saves it, and returns the document plus JSON and HTML URLs. Responds `201`; errors return a generic `500`.
- `getMyProfiles`: admins query all profiles; other callers query by `userId` or normalized `createdByEmail`. Results are sorted newest first.
- `getProfile` / `getProfileById`: fetches a profile by ID and returns JSON. Invalid IDs return `400`; missing records return `404`.
- `updateProfile`: validates and fetches the profile, checks ownership only when `req.user` exists, builds a patch while retaining omitted fields, then updates with Mongoose validators. Responds `403` for a present but unauthorized user, `404` when absent, and `500` on database errors.
- `deleteProfile`: deletes by ID and returns `404` if absent. The route does not currently attach auth middleware or an ownership check.
- `getProfileHtml`: renders the public HTML profile page, QR code, contact download/share actions, and available social links. It escapes text inserted into HTML, generates a per-response CSP nonce, and responds with `400`, `404`, or `500` for invalid/missing/error cases.

Input helpers trim and cap text lengths. Social fields can be supplied flat or under `social`. Profile IDs are expected to be 24 hexadecimal characters. Public HTML URLs use `PUBLIC_REDIRECT_BASE` when configured; otherwise they are derived from request protocol/host and the configured base path.

### Authentication controller — `controller/authcontroller.js`

- `userregister`: checks for an existing email, hashes the password with bcrypt (cost factor 8), creates a user, and returns email/role. Duplicate email returns `400`.
- `adminregister`: similar registration flow with a default admin role.
- `userlogin`: looks up email, compares password using bcrypt, and returns a user payload with role `user`.
- `adminlogin`: same credential check, returning role `admin`.

Invalid credentials return `401`; unexpected errors currently return `500` with the underlying error message. **Implementation note:** these login handlers do not issue a JWT, even though the auth middleware expects Bearer JWTs. Also, `adminregister` is currently an open route and accepts `role` from the request body, so route access should be reviewed before relying on it as a secure role boundary.

## 4. Routes — `route/route.js`

Paths below are relative to any API mount prefix. For example, `/profiles/:id` is served at `/tbc_connect/api/profiles/:id` by default.

| Method | Relative path | Handler / behavior |
| --- | --- | --- |
| POST | `/create` | Create profile (`createProfile`) |
| GET | `/getprofile/:id` | Public profile JSON (`getProfile`) |
| POST | `/userregister` | Register user |
| POST | `/adminregister` | Register admin |
| POST | `/nfcuser` | User login |
| POST | `/nfcadmin` | Admin login |
| GET | `/me` | Mounted only if `authController.me` exists; it does not currently exist, so skipped with a startup warning |
| POST | `/profiles` | Create profile alias |
| GET | `/profiles/mine` | Profiles associated with current `req.user` (all if admin) |
| GET | `/profiles/:id` | Public JSON lookup |
| GET | `/profile/:id` | Legacy JSON lookup alias |
| PUT | `/profiles/:id` | Update profile |
| PATCH | `/profiles/:id` | Partial update using same update handler |
| GET | `/profile-page/:id` | Legacy redirect check, then public HTML page |
| GET | `/p/:id` | Short HTML route alias with legacy redirect check |
| DELETE | `/deleteprofile/:id` | Delete profile |

`router.param("id", ...)` rejects IDs that do not match 24 hexadecimal characters before route handlers execute. Routes are registered so `/profiles/mine` precedes `/profiles/:id`.

**Authentication wiring:** `authmiddleware.js` exports `requireAuth` and `requireRole`, but `route.js` does not currently apply either middleware to any route. Consequently, `req.user` is generally unset through the current router, `/profiles/mine` is not protected and usually queries profiles with null user ID/empty email, and create/update/delete routes are not authenticated by route middleware. The profile update controller allows updates when `req.user` is absent and only checks ownership when a user object is present. Treat this as the current implementation, not as a recommended security policy.

## 5. Middleware

### `middleware/authmiddleware.js`

- `requireAuth` reads `Authorization: Bearer <token>`, requires `JWT_SECRET`, verifies the JWT, and places `sub`, `email`, and `role` on `req.user` as `userId`, `email`, and `role`. Missing token returns `401`; invalid/expired token returns `401`; missing secret returns `500`.
- `requireRole(...allowedRoles)` requires `req.user` and checks its role. Missing identity returns `401`; disallowed role returns `403`.

These middleware functions are available but are not currently mounted on the routes.

### `middleware/legacyProfileRedirect.js`

This async middleware is attached only to `/profile-page/:id` and `/p/:id`. For seven hard-coded legacy profile IDs it reads that mapping's environment override (an explicitly empty override disables the redirect), validates an absolute HTTP(S) destination with a different valid profile ID, checks that the replacement exists in the current MongoDB database, then sends a 301 or 302 redirect. It sets `Cache-Control: no-store`. Invalid configuration and database verification errors return `503`; a missing replacement returns `404`. Non-mapped IDs continue to `getProfileHtml` unchanged. JSON routes and CRUD endpoints do not use this redirect middleware.

## 6. Typical request flow

```text
HTTP request
  -> server.js global middleware (CORS, body parsers, static, Helmet, Morgan)
  -> API mount (for example /tbc_connect/api)
  -> route/route.js ID parameter validation, when path has :id
  -> legacyProfileRedirect, for /profile-page/:id and /p/:id only
  -> profile or auth controller
  -> Mongoose model / MongoDB
  -> JSON, HTML, or redirect response
```

## 7. Operational and behavior notes

- MongoDB connection is established before the server begins listening. Startup requires both `MONGO_URI` and `JWT_SECRET`.
- A periodic self-ping calls `${APP_BASE_URL}/health` (defaulting to localhost plus port/base path).
- Profile lookup failures are logged with structured profile operation details; public lookup responses avoid exposing database internals.
- Registration/login responses and profile APIs have different error handling: auth controller errors may expose `error.message`, while profile lookup/create/update handlers return generic errors.
- Existing deployment-specific redirect mappings and setup steps are described in [LEGACY_PROFILE_REDIRECT.md](../LEGACY_PROFILE_REDIRECT.md). The profile lookup fix history/details are in [profile-lookup-fix.md](profile-lookup-fix.md).

## 8. Source map

| Concern | Source |
| --- | --- |
| Server setup, middleware registration, mounts | `server.js` |
| Profile persistence schema | `model/profilemodel.js` |
| User persistence schema | `model/authmodel.js` |
| Profile operations and HTML renderer | `controller/profilecontroller.js` |
| Registration and login | `controller/authcontroller.js` |
| API route table | `route/route.js` |
| JWT authentication and role checks | `middleware/authmiddleware.js` |
| Legacy profile redirects | `middleware/legacyProfileRedirect.js` |
