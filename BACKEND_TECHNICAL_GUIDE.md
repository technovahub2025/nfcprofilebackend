# Backend Technical Guide

Short reference for the Node.js backend in this repository. It describes what the code currently does.

## What the backend does

The backend serves the web app, provides profile and account APIs, and stores data in MongoDB. Express receives HTTP requests, route handlers select the work, controllers apply the application logic, and Mongoose reads or writes database records.

## Main parts

| File or folder | Simple definition |
| --- | --- |
| `server.js` | Starts the web server, connects to MongoDB, and installs shared request handling. |
| `route/route.js` | Lists API paths and connects each path to its controller. |
| `controller/profilecontroller.js` | Creates, reads, updates, and deletes profiles; also builds the public profile HTML page. |
| `controller/authcontroller.js` | Registers users and checks login credentials. |
| `model/profilemodel.js` | Defines the fields stored for each profile. |
| `model/authmodel.js` | Defines the fields stored for each user account. |
| `middleware/authmiddleware.js` | Provides JWT login and role checks. These checks are currently not attached to routes. |
| `middleware/legacyProfileRedirect.js` | Redirects configured old HTML profile links to replacement profiles. |
| `public/` | Static website files served by Express. |
| `scripts/check-profile.js` | Utility script for checking a profile record. |
| `test/` | Automated route and profile lookup checks. |

## Technology terms

| Term | Simple definition |
| --- | --- |
| Node.js | Runs JavaScript on the server. |
| Express | Handles HTTP requests and routes them to code. |
| MongoDB | Database that stores profile and account records. |
| Mongoose | Defines MongoDB data shapes and performs database queries. |
| Middleware | Code that runs while a request travels through the server. |
| Controller | Code that performs the requested operation and sends a response. |
| API | URLs that other applications use to exchange data with this backend. |
| JSON | Text format used for API request and response data. |
| JWT | Signed token format commonly used to prove a user's identity. |
| bcrypt | Library used to hash passwords before storage and compare them at login. |
| ObjectId | MongoDB's identifier format; profile routes normally expect 24 hexadecimal characters. |
| CORS | Browser rule that controls which websites may call the API. |

## Request flow

1. Express receives a request.
2. Shared middleware handles CORS, request bodies, static files, security headers, and request logs.
3. The API router matches the path and validates profile IDs.
4. A controller handles the operation; HTML profile requests first pass through the legacy redirect middleware.
5. Mongoose reads or writes MongoDB, then the server returns JSON, HTML, or a redirect.

## API routes

Paths below are relative to the API prefix. By default, add `/tbc_connect/api` in front. The same routes are also mounted at `/tbc/api` and `/nfc/api`.

| Method and path | Purpose |
| --- | --- |
| `POST /profiles` or `POST /create` | Create a profile. |
| `GET /profiles/:id` or `GET /getprofile/:id` | Read a profile as JSON. |
| `GET /profile/:id` | Older JSON profile route. |
| `GET /profiles/mine` | List profiles associated with the current user context. |
| `PUT /profiles/:id` or `PATCH /profiles/:id` | Update a profile. |
| `DELETE /deleteprofile/:id` | Delete a profile. |
| `GET /profile-page/:id` or `GET /p/:id` | Show a public HTML profile page; configured old IDs may redirect first. |
| `POST /userregister` | Register an account with the user role by default. |
| `POST /adminregister` | Register an account with the admin role by default. |
| `POST /nfcuser` | Check user login credentials. |
| `POST /nfcadmin` | Check admin login credentials. |

The server also exposes `/health` and `${BASE_PATH}/health` for a basic health response, plus `/config.js` for frontend configuration.

## Data stored

### Profiles

Profiles contain contact and public page fields: name, phone, email, address, bio, website, and social links. MongoDB also records `createdAt` and `updatedAt` timestamps. `userId` and `createdByEmail` can associate a profile with an account.

### User accounts

Accounts contain a unique email, a bcrypt password hash, and a role (`user` or `admin`). The schema does not store the `name` or `lastLogin` fields included in login responses.

## Configuration

Set these values in the deployment environment or a private `.env` file:

| Variable | Meaning |
| --- | --- |
| `MONGO_URI` | MongoDB connection string; required to start. |
| `JWT_SECRET` | Secret used to verify JWTs; required at startup. |
| `PORT` | Listening port; defaults to `3000`. |
| `BASE_PATH` | Main URL prefix; defaults to `/tbc_connect`. |
| `APP_BASE_PATH` | Alternate base path setting used when `BASE_PATH` is absent. |
| `APP_BASE_URL` | Full URL used by the periodic health ping. |
| `PUBLIC_REDIRECT_BASE` | Optional public base URL used when generating profile page links. |
| `LEGACY_PROFILE_REDIRECT_URL` through `LEGACY_PROFILE_REDIRECT_URL_7` | Optional destination override for the matching old profile link. An explicitly empty value disables that redirect. |
| `LEGACY_PROFILE_REDIRECT_STATUS` | Redirect status: `302` by default or `301` for permanent redirects. |

The example settings are in [.env.example](.env.example). Never commit real secrets.

## Current legacy profile redirects

The HTML routes check these old IDs before loading a profile:

| Old ID | Replacement ID | Override |
| --- | --- | --- |
| `6a2fe4a0897783774c008984` | `6acdc181a4d611481f52e8fe` | `LEGACY_PROFILE_REDIRECT_URL` |
| `6a311fc60ee906263fa196ec` | `6acf5f8ba4d611481f52e904` | `LEGACY_PROFILE_REDIRECT_URL_2` |
| `6a2feaa9897783774c008988` | `6acf59fea4d611481f52e901` | `LEGACY_PROFILE_REDIRECT_URL_3` |
| `6a290cda897783774c00897c` | `6acf58aea4d611481f52e900` | `LEGACY_PROFILE_REDIRECT_URL_4` |
| `6a2feb1e897783774c008989` | `6acf4b6ea4d611481f52e8ff` | `LEGACY_PROFILE_REDIRECT_URL_5` |
| `6a18377fff67a900a751c41e` | `6ad89d56e4e2ee258076bcae` | `LEGACY_PROFILE_REDIRECT_URL_6` |
| `6a18362cff67a900a751c41d` | `6ad89d56e4e2ee258076bcae` | `LEGACY_PROFILE_REDIRECT_URL_7` |

Before redirecting, the middleware checks that the destination ID exists in the connected database. It sends `404` if the replacement record is missing, `503` if redirect configuration or database verification fails, and otherwise sends the configured redirect. The redirect middleware only applies to the HTML profile routes.

## Important current behavior

- MongoDB must connect before the server starts listening.
- The server allows cross-origin requests from all origins and logs requests with Morgan.
- JWT authentication helpers exist, but routes currently do not attach them. Treat account and profile routes as unauthenticated unless deployment code adds protection.
- Login checks credentials but does not issue a JWT, so it does not currently create a token for `requireAuth`.
- `adminregister` is an open route and accepts a requested role. Do not treat it as a secure admin creation process without adding access controls.
- Profile deletion currently has no route-level authentication or ownership check.
- The server pings its own health URL every 15 minutes.

## Running and checking

Install dependencies with `npm install`. Start the server with `node server.js` after configuring `MONGO_URI` and `JWT_SECRET`. The project has Node test files under `test/`; run them with `node --test` when you want to check the API behavior.

For the profile redirect deployment steps, see [LEGACY_PROFILE_REDIRECT.md](LEGACY_PROFILE_REDIRECT.md). For the longer profile lookup notes, see [docs/profile-lookup-fix.md](docs/profile-lookup-fix.md).
