const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const Profile = require("../model/profilemodel");
const routes = require("../route/route");

const oldId = "6a2fe4a0897783774c008984";
const replacementId = "6acdc181a4d611481f52e8fe";
const replacementUrl = `https://www.technovahub.in/tbc_connect/api/profile-page/${replacementId}`;

const configureRedirect = (t, url = replacementUrl, status = "302") => {
  for (const [key, value] of Object.entries({
    LEGACY_PROFILE_REDIRECT_URL: url,
    LEGACY_PROFILE_REDIRECT_STATUS: status,
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
};

const startServer = async (t) => {
  const app = express();
  app.use("/tbc_connect/api", routes);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}/tbc_connect/api`;
};

test("malformed profile IDs return 400 without querying MongoDB", async (t) => {
  const unexpectedQuery = () => {
    assert.fail("Malformed IDs must not reach MongoDB");
  };
  const lookup = t.mock.method(Profile, "findById", unexpectedQuery);
  const update = t.mock.method(Profile, "findByIdAndUpdate", unexpectedQuery);
  const deletion = t.mock.method(Profile, "findByIdAndDelete", unexpectedQuery);
  const base = await startServer(t);

  for (const [method, path] of [
    ["GET", "/profile-page/api"],
    ["GET", "/p/api"],
    ["GET", "/profiles/api"],
    ["GET", "/profile/api"],
    ["GET", "/getprofile/api"],
    ["PUT", "/profiles/api"],
    ["PATCH", "/profiles/api"],
    ["DELETE", "/deleteprofile/api"],
    ["GET", "/profile-page/abcdefghijklmnopqrstuvwx"],
    ["GET", "/profile-page/123456789012"],
  ]) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 400, `${method} ${path}`);
    assert.match((await response.json()).message, /Invalid profile ID/);
  }
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(deletion.mock.callCount(), 0);
});

test("a well-formed ID with no profile still returns 404", async (t) => {
  const lookup = t.mock.method(Profile, "findById", async () => null);
  const base = await startServer(t);
  const id = "507f1f77bcf86cd799439011";
  const response = await fetch(`${base}/profile-page/${id}`);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Profile not found");
  assert.equal(lookup.mock.calls[0].arguments[0], id);
});

test("a valid profile ID still renders the profile page", async (t) => {
  const id = "507F1F77BCF86CD799439011";
  t.mock.method(Profile, "findById", async () => ({ _id: id, name: "Test Profile" }));
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${id}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /<h2>Test Profile<\/h2>/);
  assert.ok(html.includes(`/tbc_connect/api/profile-page/${id}`));
});

test("printed QR URL and alias redirect only after verifying the replacement", async (t) => {
  configureRedirect(t);
  const lookup = t.mock.method(Profile, "findById", async (id) => {
    assert.equal(id, replacementId);
    return { _id: id, name: "Replacement" };
  });
  const base = await startServer(t);
  for (const path of ["profile-page", "p"]) {
    const response = await fetch(`${base}/${path}/${oldId}`, { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), replacementUrl);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const head = await fetch(`${base}/profile-page/${oldId}`, { method: "HEAD", redirect: "manual" });
  assert.equal(head.status, 302);
  assert.equal(head.headers.get("location"), replacementUrl);
  assert.equal(lookup.mock.callCount(), 3);
});

test("permanent redirect can be configured after verification", async (t) => {
  configureRedirect(t, replacementUrl, "301");
  t.mock.method(Profile, "findById", async () => ({ _id: replacementId }));
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${oldId}`, { redirect: "manual" });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), replacementUrl);
});

test("missing replacement returns 404 rather than a misleading redirect", async (t) => {
  configureRedirect(t);
  t.mock.method(Profile, "findById", async () => null);
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${oldId}`, { redirect: "manual" });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("location"), null);
  assert.match((await response.json()).message, /Create the profile/);
});

test("invalid configuration and redirect loops fail without database queries", async (t) => {
  configureRedirect(t);
  const lookup = t.mock.method(Profile, "findById", () => assert.fail("Unexpected lookup"));
  const base = await startServer(t);
  for (const url of [
    "not a URL",
    "/relative/profile-page/507f1f77bcf86cd799439011",
    "javascript:alert(1)",
    `https://www.technovahub.in/tbc_connect/api/profile-page/${oldId}`,
    `https://www.technovahub.in/tbc/api/p/${oldId.toUpperCase()}/?source=qr`,
    replacementUrl.replace("https://", "https://user:password@"),
    replacementUrl.replace(replacementId, "invalid"),
  ]) {
    process.env.LEGACY_PROFILE_REDIRECT_URL = url;
    const response = await fetch(`${base}/profile-page/${oldId}`, { redirect: "manual" });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("location"), null);
  }
  process.env.LEGACY_PROFILE_REDIRECT_URL = replacementUrl;
  process.env.LEGACY_PROFILE_REDIRECT_STATUS = "307";
  const response = await fetch(`${base}/profile-page/${oldId}`, { redirect: "manual" });
  assert.equal(response.status, 503);
  assert.equal(lookup.mock.callCount(), 0);
});

test("database failures return a retryable error without exposing details", async (t) => {
  configureRedirect(t);
  t.mock.method(Profile, "findById", async () => { throw new Error("private connection details"); });
  t.mock.method(console, "error", () => {});
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${oldId}`, { redirect: "manual" });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("location"), null);
  assert.doesNotMatch(await response.text(), /private connection details/);
});

test("unset destination preserves the old profile lookup", async (t) => {
  configureRedirect(t, "");
  const lookup = t.mock.method(Profile, "findById", async () => null);
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${oldId}`);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Profile not found");
  assert.equal(lookup.mock.calls[0].arguments[0], oldId);
});

test("configured redirect leaves other profiles and the old JSON API unchanged", async (t) => {
  configureRedirect(t);
  const lookup = t.mock.method(Profile, "findById", async (id) => ({ _id: id, name: "Existing Profile" }));
  const base = await startServer(t);
  const page = await fetch(`${base}/profile-page/${replacementId}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<h2>Existing Profile<\/h2>/);
  const json = await fetch(`${base}/profiles/${oldId}`);
  assert.equal(json.status, 200);
  assert.equal((await json.json())._id, oldId);
  assert.equal(lookup.mock.calls[1].arguments[0], oldId);
});

test("following the old QR URL reaches the replacement HTML page", async (t) => {
  configureRedirect(t);
  t.mock.method(Profile, "findById", async (id) => ({ _id: id, name: "Replacement Profile" }));
  const base = await startServer(t);
  process.env.LEGACY_PROFILE_REDIRECT_URL = `${base}/profile-page/${replacementId}`;
  const response = await fetch(`${base}/profile-page/${oldId}`);
  assert.equal(response.status, 200);
  assert.equal(response.url, process.env.LEGACY_PROFILE_REDIRECT_URL);
  assert.match(await response.text(), /<h2>Replacement Profile<\/h2>/);
});

test("the supplied mapping works without an environment override", async (t) => {
  configureRedirect(t);
  delete process.env.LEGACY_PROFILE_REDIRECT_URL;
  const lookup = t.mock.method(Profile, "findById", async (id) => ({ _id: id }));
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${oldId}`, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), replacementUrl);
  assert.equal(lookup.mock.calls[0].arguments[0], replacementId);
});

test("the previously mentioned old ID is not redirected to this person's profile", async (t) => {
  configureRedirect(t);
  const otherId = "6aca2356a4d611481f52e8fd";
  const lookup = t.mock.method(Profile, "findById", async () => null);
  const base = await startServer(t);
  const response = await fetch(`${base}/profile-page/${otherId}`, { redirect: "manual" });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("location"), null);
  assert.equal(lookup.mock.calls[0].arguments[0], otherId);
});
