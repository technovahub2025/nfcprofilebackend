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
