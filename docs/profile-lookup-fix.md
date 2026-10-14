# Profile lookup fix

This branch is based directly on GitHub's `master` at `0df50ca`. It excludes the two older unpushed local commits, dependency changes, `.env`, and the unrelated local route edit.

## Findings

The GitHub source already mounts the configured `/tbc_connect/api` prefix and includes the deployed PUT/PATCH handlers. Its HTML handler correctly reads `req.params.id` and queries the ObjectId `_id` in `profiles` through `Profile.findById`. The supplied ID `6a311bab0ee906263fa196eb` is syntactically valid. Its explicit missing-record response is `404` with the 17-byte body `Profile not found`, matching the log's response size. Database errors in this handler return 500, not 404.

This supports a missing query result, but does not establish whether the record was deleted, the NFC URL is stale, or the connection selects a different database than intended. A read-only check with the original workspace's credentials reached MongoDB but failed authentication (`MongoServerError`, code 8000). Existence in Render's database remains unverified; no database writes were performed. The local credential failure does not prove Render has the same problem.

## Changes

- `controller/profilecontroller.js`: validate IDs for HTML, JSON and update handlers; log invalid IDs, missing records and failures using server-only database/collection context; keep missing profiles as 404 and database failures as generic 500; avoid raw database messages in creation/update errors.
- Replace the update option `new: true` with `returnDocument: 'after'`, preserving validators, patch payload, authorization and successful response format. Handle a null update result if the document disappears between the initial lookup and update.
- `scripts/check-profile.js`: read-only existence verification using the existing `MONGO_URI`.
- `test/profile-lookup.test.js`: real Express HTTP regression checks with mocked database calls, including PUT/PATCH behavior.

Routes, authentication checks, CORS, environment-variable names, model fields, public URL builders, QR codes, CSP and the HTML template are preserved. Existing list/delete handlers are outside this patch.

Mongoose documents the update option here: https://mongoosejs.com/docs/tutorials/findoneandupdate

## Database verification and environment

No environment or database changes are required by the code. Run the diagnostic in Render's service environment with its existing `MONGO_URI`:

```sh
node scripts/check-profile.js 6a311bab0ee906263fa196eb
```

Exit 0 / `profile_exists`: record found. Exit 1 / `profile_missing`: connected successfully, but no matching ObjectId `_id` in the reported database/collection. Exit 2 / verification error or timeout: existence remains unknown. Do not publish connection URIs or credentials.

If missing, retain the 404 and compare the NFC card's encoded ID to the saved profile's actual `_id`. Reprogram a stale URL with that profile's correct public URL; recover an accidentally deleted record only from verified backups. Do not substitute another user's profile or invent a record under the missing ID.

If found while HTTP still returns 404, compare the diagnostic's database/collection with the handler logs, confirm Render's deployed commit, and inspect its runtime configuration. The field lookup itself is correct in this source. For local verification, fix the local credentials through your trusted configuration source; do not change Render's working connection because a local check failed.

## Testing

```sh
node --test test/profile-lookup.test.js
node --check controller/profilecontroller.js
```

The tests cover existing HTML/JSON aliases, correct IDs, HTML escaping, QR output and nonce CSP, 400 without database access for invalid IDs, missing records, safe database errors, creation response URLs, PUT/PATCH returning the updated profile, preserved omitted fields, authorization rejection, concurrent deletion, and update failures. They use mocked persistence and cannot establish production database contents. An existing `/me` warning comes from the unchanged router when `authController.me` is missing.

Manually check the deployed public prefix (usually `https://<render-host>/tbc_connect/api`):

1. GET `/profile-page/<verified-existing-id>` and `/getprofile/<same-id>`: 200 and the correct user's fields.
2. GET `/profile-page/<confirmed-missing-id>`: 404 `Profile not found`; GET `/profile-page/invalid-id`: 400 `Invalid profile ID`. Fetch the existing profile again to confirm the service continues responding.
3. POST `/create` with a disposable test profile: 201, saved ID in `data._id`, and working `fullProfilePageUrl`. Encode that returned URL onto a test NFC card.
4. PUT and PATCH `/profiles/<created-id>` with the existing authorization and a name change: 200 with updated `data`, same `_id`, and working `fullProfilePageUrl`. Confirm HTML/JSON show the change, the NFC URL still works, and logs contain no `new` deprecation warning.
5. In a test environment, simulate a database failure: generic 500 response, server-only diagnostic, no credential leakage. Test invalid/missing update IDs and an unauthorized user as well.

Example PowerShell creation/update (use the application's existing authorization if required):

```powershell
$apiBase = 'https://<render-host>/tbc_connect/api'
$created = Invoke-RestMethod -Method Post -Uri "$apiBase/create" -ContentType 'application/json' -Body '{"name":"NFC lookup test"}'
$profileId = $created.data._id
Invoke-WebRequest $created.fullProfilePageUrl
Invoke-RestMethod -Method Put -Uri "$apiBase/profiles/$profileId" -ContentType 'application/json' -Body '{"name":"Updated NFC lookup test"}'
Invoke-RestMethod "$apiBase/getprofile/$profileId"
Invoke-WebRequest "$apiBase/profile-page/$profileId"
```

## Complete corrected file contents

### controller/profilecontroller.js

```javascript
const Profile = require("../model/profilemodel");
const QRCode = require("qrcode");
const crypto = require("crypto");

// Keep database diagnostics in server logs, never in the HTTP response.
const logProfileEvent = (level, event, operation, id, err) => {
  console[level]("[profile]", {
    event,
    operation,
    ...(typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id)
      ? { profileId: id }
      : {}),
    database: Profile.db.name,
    collection: Profile.collection.name,
    connectionState: Profile.db.readyState,
    ...(err ? {
      errorType: err.name,
      ...(typeof err.code === "number" ? { errorCode: err.code } : {}),
    } : {}),
  });
};

const validateProfileId = (req, res, operation, html = false) => {
  if (typeof req.params.id === "string" && /^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    return true;
  }

  logProfileEvent("warn", "invalid_id", operation);
  if (html) {
    res.status(400).send("Invalid profile ID");
  } else {
    res.status(400).json({ message: "Invalid profile ID" });
  }
  return false;
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sanitizeText = (value = "", maxLength = 1000) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeUrl = (url = "") => {
  const value = String(url || "").trim();

  if (!value) return "";

  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
};

const normalizeBasePath = (value = "/tbc_connect") => {
  const path = String(value || "/tbc_connect").trim() || "/tbc_connect";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, "");
};

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || process.env.APP_BASE_PATH);
const API_PREFIX = `${BASE_PATH}/api`;
const PUBLIC_REDIRECT_BASE = (() => {
  const base = String(process.env.PUBLIC_REDIRECT_BASE || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  return base.startsWith("http://") || base.startsWith("https://")
    ? base
    : `https://${base}`;
})();

const buildPublicProfilePageUrl = (req, profileId) => {
  if (PUBLIC_REDIRECT_BASE) {
    return `${PUBLIC_REDIRECT_BASE}/tbc_connect/api/profile-page/${profileId}`;
  }

  return `${req.protocol}://${req.get("host")}${API_PREFIX}/profile-page/${profileId}`;
};

const cleanInstagram = (value = "") =>
  value ? `https://instagram.com/${String(value).replace("@", "").trim()}` : "";

const cleanLinkedin = (value = "") => {
  if (!value) return "";

  const v = String(value).trim();

  if (v.startsWith("http://") || v.startsWith("https://")) {
    return v;
  }

  return `https://linkedin.com/in/${v
    .replace(/^@/, "")
    .trim()
    .replace(/\s+/g, "-")}`;
};

const cleanFacebook = (value = "") => {
  if (!value) return "";

  const v = String(value).trim();

  return v.startsWith("http") ? v : `https://facebook.com/${v}`;
};

const cleanYoutube = (value = "") => {
  if (!value) return "";

  const v = String(value).trim();

  return v.startsWith("http://") || v.startsWith("https://")
    ? v
    : `https://youtube.com/@${v.replace(/^@/, "")}`;
};

const extractNestedSocial = (body = {}) => ({
  instagram: body.instagram || body?.social?.instagram || "",
  linkedin: body.linkedin || body?.social?.linkedin || "",
  facebook: body.facebook || body?.social?.facebook || "",
    youtube: body.youtube || body?.social?.youtube || "",
  googleBusiness: body.googleBusiness || body?.social?.googleBusiness || "",
});

const canManageProfile = (profile, user = {}) => {
  if (!profile || !user) return false;
  if (user.role === "admin") return true;

  const userId = user.userId ? String(user.userId) : "";
  const profileUserId = profile.userId ? String(profile.userId) : "";
  const userEmail = String(user.email || "").toLowerCase().trim();
  const profileCreatedByEmail = String(profile.createdByEmail || "").toLowerCase().trim();

  if (userId && profileUserId && userId === profileUserId) return true;
  if (userEmail && profileCreatedByEmail && userEmail === profileCreatedByEmail) return true;

  return false;
};

const buildProfileUpdatePayload = (body = {}) => {
  const social = extractNestedSocial(body);

  return {
    name: sanitizeText(body.name, 120),
    phone: sanitizeText(body.phone, 40),
    email: sanitizeText(body.email, 150),
    address: sanitizeText(body.address, 250),
    bio: sanitizeText(body.bio, 500),
    googleBusiness: sanitizeText(social.googleBusiness, 150),
    instagram: sanitizeText(social.instagram, 150),
    linkedin: sanitizeText(social.linkedin, 250),
      youtube: sanitizeText(social.youtube, 250),
    facebook: sanitizeText(social.facebook, 250),
    website: sanitizeText(body.website, 250),
  };
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const buildProfilePatchPayload = (body = {}, existingProfile = {}) => {
  const social = extractNestedSocial(body);

  return {
    name: hasOwn(body, "name") ? sanitizeText(body.name, 120) : existingProfile.name,
    phone: hasOwn(body, "phone") ? sanitizeText(body.phone, 40) : existingProfile.phone,
    email: hasOwn(body, "email") ? sanitizeText(body.email, 150) : existingProfile.email,
    address: hasOwn(body, "address") ? sanitizeText(body.address, 250) : existingProfile.address,
    bio: hasOwn(body, "bio") ? sanitizeText(body.bio, 500) : existingProfile.bio,
    googleBusiness: hasOwn(body, "googleBusiness") || body?.social?.googleBusiness
      ? sanitizeText(social.googleBusiness, 150)
      : existingProfile.googleBusiness,
    instagram: hasOwn(body, "instagram") || body?.social?.instagram
      ? sanitizeText(social.instagram, 150)
      : existingProfile.instagram,
    linkedin: hasOwn(body, "linkedin") || body?.social?.linkedin
      ? sanitizeText(social.linkedin, 250)
      : existingProfile.linkedin,
    facebook: hasOwn(body, "facebook") || body?.social?.facebook
      ? sanitizeText(social.facebook, 250)
      : existingProfile.facebook,
      youtube:
  hasOwn(body, "youtube") || body?.social?.youtube
    ? sanitizeText(social.youtube, 250)
    : existingProfile.youtube,
    website: hasOwn(body, "website") ? sanitizeText(body.website, 250) : existingProfile.website,
  };
};

exports.createProfile = async (req, res) => {
  try {
    const profile = new Profile({
      userId: req.user?.userId || null,
      createdByEmail: req.user?.email || "",
      ...buildProfileUpdatePayload(req.body),
    });

    const savedProfile = await profile.save();
    const fullProfilePageUrl = buildPublicProfilePageUrl(req, savedProfile._id);

    res.status(201).json({
      success: true,
      message: "Profile created successfully",
      data: savedProfile,
      profileJsonUrl: `${API_PREFIX}/profiles/${savedProfile._id}`,
      profilePageUrl: fullProfilePageUrl,
      fullProfileJsonUrl: `${req.protocol}://${req.get("host")}${API_PREFIX}/profiles/${savedProfile._id}`,
      fullProfilePageUrl,
    });
  } catch (err) {
    logProfileEvent("error", "create_error", "createProfile", undefined, err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.updateProfile = async (req, res) => {
  if (!validateProfileId(req, res, "updateProfile")) return;

  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      logProfileEvent("warn", "not_found", "updateProfile", req.params.id);
      return res.status(404).json({ message: "Profile not found" });
    }

    if (req.user && !canManageProfile(profile, req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedProfile = await Profile.findByIdAndUpdate(
      req.params.id,
      buildProfilePatchPayload(req.body, profile),
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedProfile) {
      logProfileEvent("warn", "not_found", "updateProfile", req.params.id);
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedProfile,
      fullProfilePageUrl: buildPublicProfilePageUrl(req, updatedProfile._id),
    });
  } catch (err) {
    logProfileEvent("error", "lookup_error", "updateProfile", req.params.id, err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.getMyProfiles = async (req, res) => {
  try {
    const query =
      req.user?.role === "admin"
        ? {}
        : {
            $or: [
              { userId: req.user?.userId || null },
              { createdByEmail: String(req.user?.email || "").toLowerCase().trim() },
            ],
          };

    const profiles = await Profile.find(query).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: profiles.length,
      data: profiles,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};
// GET PROFILE JSON
exports.getProfile = async (req, res) => {
  if (!validateProfileId(req, res, "getProfile")) return;

  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      logProfileEvent("warn", "not_found", "getProfile", req.params.id);
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json(profile);
  } catch (err) {
    logProfileEvent("error", "lookup_error", "getProfile", req.params.id, err);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.getProfileById = exports.getProfile;




// DELETE PROFILE
exports.deleteProfile = async (req, res) => {
  try {
    const profile = await Profile.findByIdAndDelete(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile deleted successfully",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};

exports.getProfileHtml = async (req, res) => {
  if (!validateProfileId(req, res, "getProfileHtml", true)) return;

  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      logProfileEvent("warn", "not_found", "getProfileHtml", req.params.id);
      return res.status(404).send("Profile not found");
    }

    const nonce = crypto.randomBytes(16).toString("base64");

    res.setHeader(
      "Content-Security-Policy",
      "script-src 'self' 'nonce-" +
        nonce +
        "'; script-src-attr 'none'; style-src 'unsafe-inline'; img-src 'self' data:"
    );

    const {
      name = "",
      bio = "",
      phone = "",
      email = "",
      address = "",
      instagram: rawInstagram = "",
      linkedin: rawLinkedin = "",
      facebook: rawFacebook = "",
      youtube: rawYoutube = "",
      website = "",
      googleBusiness: rawGoogleBusiness = "",
      social = {},
    } = profile;

    const instagram = rawInstagram || social.instagram || "";
    const linkedin = rawLinkedin || social.linkedin || "";
    const facebook = rawFacebook || social.facebook || "";
    const googleBusiness = rawGoogleBusiness || social.googleBusiness || "";

    const profileUrl = buildPublicProfilePageUrl(req, profile._id);
    const qrCode = await QRCode.toDataURL(profileUrl);
    const cleanPhone = String(phone).replace(/[^\d+]/g, "");

    const instagramUrl = cleanInstagram(instagram);
    const linkedinUrl = cleanLinkedin(linkedin);
    const facebookUrl = cleanFacebook(facebook);
    const youtubeUrl = cleanYoutube(rawYoutube);
    const websiteUrl = website ? normalizeUrl(website) : "";
    const googleBusinessUrl = googleBusiness
      ? googleBusiness.startsWith("http")
        ? googleBusiness
        : `https://g.page/${googleBusiness}`
      : "";

    const socialNote = [
      bio ? `- Bio: ${bio}` : "",
      instagramUrl ? `- Instagram: ${instagramUrl}` : "",
      linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : "",
      facebookUrl ? `- Facebook: ${facebookUrl}` : "",
      googleBusinessUrl ? `- Google Business: ${googleBusinessUrl}` : "",
      websiteUrl ? `- Website: ${websiteUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const vCard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      cleanPhone ? `TEL;TYPE=CELL:${cleanPhone}` : "",
      email ? `EMAIL:${email}` : "",
      address ? `ADR:;;${address}` : "",
      websiteUrl ? `URL:${websiteUrl}` : "",
      bio ? `TITLE:${bio}` : "",
      socialNote ? `NOTE:${socialNote}` : "",
        youtubeUrl ? `- YouTube: ${youtubeUrl}` : "",
      "END:VCARD",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<title>${escapeHtml(name)} - Profile</title>

<style>
body{
  font-family:Arial;
  background:#f4f4f4;
  padding:20px;
}

.container{
  max-width:500px;
  margin:auto;
}

.card{
  background:#fff;
  padding:20px;
  border-radius:15px;
  text-align:center;
}

.avatar{
  width:90px;
  height:90px;
  border-radius:50%;
  background:#2563eb;
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:35px;
  margin:auto;
}

.qr-code{
  width:140px;
  margin-top:15px;
}

.btn{
  display:block;
  padding:10px;
  margin-top:10px;
  border-radius:10px;
  text-decoration:none;
  color:white;
}
.youtube{
  background:#FF0000;
}
.call{
  background:#16a34a;
}

.email{
  background:#2563eb;
}

.instagram{
  background:#E4405F;
}

.linkedin{
  background:#0077B5;
}

.facebook{
  background:#1877F2;
}

.googlebusiness{
  background:#4285F4;
}

.actions button{
  width:100%;
  margin-top:10px;
  padding:12px;
  border:none;
  border-radius:10px;
  color:white;
  cursor:pointer;
  font-size:16px;
}

.save{
  background:#10b981;
}

.share{
  background:#3b82f6;
}

.powered-by{
  margin-top:20px;
  font-size:14px;
  color:#666;
}

.powered-by a{
  color:#2563eb;
  text-decoration:none;
  font-weight:bold;
}
</style>
</head>

<body>

<div class="container">
<div class="card">

<div class="avatar">👤</div>

<div class="qr-container">
<img src="${qrCode}" class="qr-code"/>
</div>

<h2>${escapeHtml(name)}</h2>

<p>${escapeHtml(bio)}</p>

<p>${escapeHtml(phone)}</p>

<p>${escapeHtml(email)}</p>
${
  cleanPhone
    ? `
<a class="btn call" href="tel:${cleanPhone}">
Call
</a>
`
    : ""
}

${
  email
    ? `
<a class="btn email" href="mailto:${encodeURIComponent(email)}">
Email
</a>
`
    : ""
}

${
  instagramUrl
    ? `
<a class="btn instagram"
href="${instagramUrl}"
target="_blank"
rel="noopener noreferrer">
Instagram
</a>
`
    : ""
}

${
  linkedinUrl
    ? `
<a class="btn linkedin"
href="${linkedinUrl}"
target="_blank"
rel="noopener noreferrer">
LinkedIn
</a>
`
    : ""
}

${
  facebookUrl
    ? `
<a class="btn facebook"
href="${facebookUrl}"
target="_blank"
rel="noopener noreferrer">
Facebook
</a>
`
    : ""
}
${
  youtubeUrl
    ? `
<a class="btn youtube"
href="${youtubeUrl}"
target="_blank"
rel="noopener noreferrer">
YouTube
</a>
`
    : ""
}
${
  googleBusinessUrl
    ? `
<a class="btn googlebusiness"
href="${googleBusinessUrl}"
target="_blank"
rel="noopener noreferrer">
Google Business
</a>
`
    : ""
}

<div class="actions">
<button id="saveBtn" class="save">
💾 Save Contact
</button>

<button id="shareBtn" class="share">
🔗 Share Profile
</button>
</div>

</div>
</div>

<center>
<div class="powered-by">
Powered by
<a
href="https://www.technovahub.in"
target="_blank"
rel="noopener noreferrer"
>
Technovahub
</a>
</div>
</center>

<script nonce="${nonce}">
window.__PROFILE_DATA__ = ${JSON.stringify({
      vCard,
      profileUrl,
      name: name || "Profile",
    })};
</script>

<script nonce="${nonce}">
function saveContact(){
  const data = window.__PROFILE_DATA__;
  const blob = new Blob([data.vCard], { type:"text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contact.vcf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareProfile(){
  const data = window.__PROFILE_DATA__;

  if(navigator.share){
    await navigator.share({
      title:data.name,
      text:data.name + "'s profile",
      url:data.profileUrl,
    });
    return;
  }

  const temp = document.createElement("textarea");
  document.body.appendChild(temp);
  temp.value = data.profileUrl;
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    document.getElementById("saveBtn")?.addEventListener("click", saveContact);
    document.getElementById("shareBtn")?.addEventListener("click", shareProfile);
  }
);
</script>

</body>
</html>
`;

    res.send(html);
  } catch (err) {
    logProfileEvent("error", "lookup_error", "getProfileHtml", req.params.id, err);

    res.status(500).send("Server Error");
  }
};
```

### scripts/check-profile.js

```javascript
// Read-only check. Run in the deployment environment to verify its database.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Profile = require("../model/profilemodel");

const id = process.argv[2] || "6a311bab0ee906263fa196eb";
if (!/^[a-fA-F0-9]{24}$/.test(id)) {
  console.error("Invalid profile ID: expected 24 hexadecimal characters.");
  process.exit(2);
}
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is unavailable. Run with the deployment environment configured.");
  process.exit(2);
}

// DNS resolution can outlast the MongoDB driver's connection timeout.
const deadline = setTimeout(() => {
  console.error(JSON.stringify({ event: "verification_timeout", profileId: id }));
  process.exit(2);
}, 15000);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    const exists = await Profile.exists({ _id: id }).maxTimeMS(5000);
    console.log(JSON.stringify({
      event: exists ? "profile_exists" : "profile_missing",
      profileId: id,
      database: Profile.db.name,
      collection: Profile.collection.name,
    }));
    process.exitCode = exists ? 0 : 1;
  } catch (err) {
    console.error(JSON.stringify({
      event: "verification_error",
      errorType: err.name,
      errorCategory: /authentication|bad auth|auth failed/i.test(err.message || "")
        ? "authentication_failed"
        : "database_error",
      ...(typeof err.code === "number" ? { errorCode: err.code } : {}),
    }));
    process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
    clearTimeout(deadline);
  }
})();
```

### test/profile-lookup.test.js

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const Profile = require("../model/profilemodel");
const routes = require("../route/route");

test("profile routes distinguish valid, missing, invalid and failed lookups", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.headers["x-test-user"]) req.user = { role: "user", userId: "other-user" };
    next();
  });
  app.use("/api", routes);
  app.use("/tbc_connect/api", routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const id = "6a311bab0ee906263fa196eb";
  const originalFind = Profile.findById;
  const originalSave = Profile.prototype.save;
  const originalUpdate = Profile.findByIdAndUpdate;
  const originalWarn = console.warn;
  const originalError = console.error;
  const logs = [];
  console.warn = console.error = (...args) => logs.push(args);
  try {
    let calls = 0;
    Profile.findById = async requestedId => {
      calls++;
      assert.equal(requestedId, id);
      return { _id: id, name: "Test & Profile", phone: "+91 12345", website: "example.com" };
    };
    for (const path of ["/api/profile-page/", "/api/p/", "/tbc_connect/api/profile-page/"]) {
      const res = await fetch(base + path + id);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /Test &amp; Profile/);
      assert.match(html, /class="qr-code"/);
      assert.match(html, /data:image\/png;base64,/);
      assert.match(res.headers.get("content-security-policy"), /nonce-/);
      assert.ok(html.includes(`/tbc_connect/api/profile-page/${id}`));
    }
    for (const path of ["/api/getprofile/", "/api/profiles/", "/api/profile/"]) {
      const res = await fetch(base + path + id);
      assert.equal(res.status, 200);
      assert.equal((await res.json())._id, id);
    }
    const callsBeforeInvalid = calls;
    for (const path of ["/api/profile-page/", "/api/getprofile/"]) {
      assert.equal((await fetch(base + path + "invalid-id")).status, 400);
    }
    assert.equal(calls, callsBeforeInvalid);
    Profile.findById = async () => null;
    assert.equal((await fetch(base + "/api/profile-page/" + id)).status, 404);
    assert.equal((await fetch(base + "/api/getprofile/" + id)).status, 404);
    Profile.findById = async () => { throw new Error("private database details"); };
    for (const path of ["/api/profile-page/", "/api/getprofile/"]) {
      const res = await fetch(base + path + id);
      assert.equal(res.status, 500);
      assert.ok(!(await res.text()).includes("private database details"));
    }
    assert.ok(logs.some(([, details]) => details.event === "invalid_id"));
    assert.ok(logs.some(([, details]) => details.event === "not_found"));
    assert.ok(logs.some(([, details]) => details.event === "lookup_error"));
    assert.ok(!JSON.stringify(logs).includes("private database details"));
    Profile.prototype.save = async function () { return this; };
    for (const path of ["/api/create", "/api/profiles"]) {
      const res = await fetch(base + path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Created profile", googleBusiness: "test-business" }),
      });
      assert.equal(res.status, 201);
      const created = await res.json();
      assert.equal(created.data.name, "Created profile");
      assert.equal(created.data.googleBusiness, "test-business");
      assert.match(created.data._id, /^[a-f0-9]{24}$/);
      assert.ok(created.fullProfilePageUrl.endsWith(`/profile-page/${created.data._id}`));
    }
    const existing = { _id: id, name: "Before update", phone: "+91 12345", youtube: "test-channel" };
    Profile.findById = async requestedId => {
      assert.equal(requestedId, id);
      return existing;
    };
    let updates = 0;
    Profile.findByIdAndUpdate = async (requestedId, payload, options) => {
      updates++;
      assert.equal(requestedId, id);
      assert.deepEqual(options, { returnDocument: "after", runValidators: true });
      assert.equal(payload.phone, existing.phone);
      assert.equal(payload.youtube, existing.youtube);
      Object.assign(existing, payload);
      return existing;
    };
    for (const method of ["PUT", "PATCH"]) {
      const res = await fetch(base + "/tbc_connect/api/profiles/" + id, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "After update" }),
      });
      assert.equal(res.status, 200);
      const updated = await res.json();
      assert.equal(updated.data._id, id);
      assert.equal(updated.data.name, "After update");
      assert.ok(updated.fullProfilePageUrl.endsWith(`/profile-page/${id}`));
    }
    assert.match(await (await fetch(base + "/api/profile-page/" + id)).text(), /After update/);
    const forbidden = await fetch(base + "/api/profiles/" + id, {
      method: "PUT", headers: { "x-test-user": "other-user" },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(updates, 2);
    assert.equal((await fetch(base + "/api/profiles/invalid-id", { method: "PUT" })).status, 400);
    Profile.findById = async () => null;
    assert.equal((await fetch(base + "/api/profiles/" + id, { method: "PUT" })).status, 404);
    Profile.findById = async () => existing;
    Profile.findByIdAndUpdate = async () => null;
    assert.equal((await fetch(base + "/api/profiles/" + id, { method: "PUT" })).status, 404);
    Profile.findByIdAndUpdate = async () => { throw new Error("private database details"); };
    const failedUpdate = await fetch(base + "/api/profiles/" + id, { method: "PUT" });
    assert.equal(failedUpdate.status, 500);
    assert.ok(!(await failedUpdate.text()).includes("private database details"));
    Profile.prototype.save = async () => { throw new Error("private database details"); };
    const failedCreate = await fetch(base + "/api/create", { method: "POST" });
    assert.equal(failedCreate.status, 500);
    assert.ok(!(await failedCreate.text()).includes("private database details"));
  } finally {
    Profile.findById = originalFind;
    Profile.prototype.save = originalSave;
    Profile.findByIdAndUpdate = originalUpdate;
    console.warn = originalWarn;
    console.error = originalError;
    await new Promise(resolve => server.close(resolve));
  }
});
```
