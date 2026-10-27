# Keep the existing TechnovaHub QR working

Seven independent mappings are configured by default:

| Old profile ID | Replacement profile ID | Optional environment override |
| --- | --- | --- |
| `6a2fe4a0897783774c008984` | `6acdc181a4d611481f52e8fe` | `LEGACY_PROFILE_REDIRECT_URL` |
| `6a311fc60ee906263fa196ec` | `6acf5f8ba4d611481f52e904` | `LEGACY_PROFILE_REDIRECT_URL_2` |
| `6a2feaa9897783774c008988` | `6acf59fea4d611481f52e901` | `LEGACY_PROFILE_REDIRECT_URL_3` |
| `6a290cda897783774c00897c` | `6acf58aea4d611481f52e900` | `LEGACY_PROFILE_REDIRECT_URL_4` |
| `6a2feb1e897783774c008989` | `6acf4b6ea4d611481f52e8ff` | `LEGACY_PROFILE_REDIRECT_URL_5` |
| `6a18377fff67a900a751c41e` | `6ad89d56e4e2ee258076bcae` | `LEGACY_PROFILE_REDIRECT_URL_6` |
| `6a18362cff67a900a751c41d` | `6ad89d56e4e2ee258076bcae` | `LEGACY_PROFILE_REDIRECT_URL_7` |

Each override applies only to its own mapping. An absent variable uses the
default; an explicitly empty variable disables that mapping. All destinations
are checked in the current database before redirecting. No mapping may
target another mapped old ID, preventing redirect chains and loops.

The backend is Express 5 with Mongoose. `server.js` mounts `route/route.js`
at `/tbc_connect/api` by default (also `/tbc/api` and `/nfc/api`). The HTML
handler is `getProfileHtml` in `controller/profilecontroller.js`.

The new middleware runs before that handler for the seven mapped IDs above,
on `/profile-page/:id` and its `/p/:id` alias.
JSON, creation, update, deletion, and other profile IDs retain their behavior.
The original `/tbc_connect/api` mount is retained even if BASE_PATH changes.

## Configure and deploy

1. Connect this deployment to a working MongoDB database using its existing
   `MONGO_URI` and `JWT_SECRET` environment settings. The server requires a
   successful database connection before it starts listening.
2. Create a replacement profile using your existing profile creation flow or
   `POST /tbc_connect/api/profiles` with JSON such as
   `{"name":"Your name","phone":"Your phone","email":"Your email"}`.
   The creation response includes `data._id` and `fullProfilePageUrl`.
   Alternatively restore a profile from an actual available backup. This
   change cannot recover the deleted MongoDB cluster or its data.
3. Open the replacement profile's full URL and confirm it displays the correct
   information. Its host and route must serve this application and current
   database; arbitrary external websites are not supported by this mapping.
4. Set these environment variables on the deployed backend (or in a local
   `.env`, which must stay private):

   ```dotenv
   LEGACY_PROFILE_REDIRECT_URL=https://www.technovahub.in/tbc_connect/api/profile-page/6acdc181a4d611481f52e8fe
   LEGACY_PROFILE_REDIRECT_STATUS=302
   ```

   The URL above is the supplied replacement profile. Verify it against the actual
   database before deploying. Do not set the destination to the original ID.
   `.env.example` contains this mapping for reference. If the URL variable is absent,
   this mapping is also the code default. An existing environment value overrides it.
5. Deploy and restart the backend handling `www.technovahub.in`. Keep the domain,
   TLS certificate, and proxy mapping for the old URL operational.
6. Verify the old URL returns a redirect to the correct destination:

   ```powershell
   curl.exe -I "https://www.technovahub.in/tbc_connect/api/profile-page/6a2fe4a0897783774c008984"
   curl.exe -L "https://www.technovahub.in/tbc_connect/api/profile-page/6a2fe4a0897783774c008984"
   ```

   Expect `302` and a `Location` header in the first check, then the replacement
   HTML page in the second. Finally scan the original printed QR.
7. After verification, optionally set `LEGACY_PROFILE_REDIRECT_STATUS=301` for a
   permanent redirect and restart. Responses use `Cache-Control: no-store` so
   clients can obtain updated mappings and database checks on subsequent visits.

No redirect is enabled while the URL setting is explicitly empty: the original lookup
continues. A missing replacement returns 404 with creation/restoration guidance.
Invalid configuration returns 503; database lookup failures return 503 without
exposing connection details. Configuration accepts absolute HTTP(S) profile URLs
ending in `/profile-page/<id>` or `/p/<id>` and rejects embedded credentials and
destinations using the old ID.

## Files

- `middleware/legacyProfileRedirect.js`: complete redirect implementation.
- `route/route.js`: attach it to the two HTML profile routes.
- `server.js`: retain the printed URL's mount if BASE_PATH changes.
- `.env.example`: destination and redirect status configuration.
- `test/profile-routes.test.js`: HTTP regression and redirect tests.
- `LEGACY_PROFILE_REDIRECT.md`: setup and deployment instructions.

Run `node --test test/profile-routes.test.js`. Tests use a local HTTP server and
mock database lookups, including following a redirect to a replacement page;
they do not prove that a real production replacement profile exists.

The physical QR image and its encoded URL remain unchanged. No new QR artifact
is generated by this change; existing profile rendering behavior is preserved.
