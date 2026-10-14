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
