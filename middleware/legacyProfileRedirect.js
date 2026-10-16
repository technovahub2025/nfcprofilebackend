const Profile = require("../model/profilemodel");

const LEGACY_PROFILE_ID = "6aca2356a4d611481f52e8fd";

// Only the printed profile's HTML routes use this middleware. JSON and CRUD
// routes continue to operate on their original IDs.
module.exports = async (req, res, next) => {
  if (req.params.id.toLowerCase() !== LEGACY_PROFILE_ID) return next();

  const configuredUrl = String(process.env.LEGACY_PROFILE_REDIRECT_URL || "").trim();
  if (!configuredUrl) return next();

  // Do not cache a setup error, or a redirect whose destination may change.
  res.set("Cache-Control", "no-store");

  let destination;
  let destinationId;
  const status = String(process.env.LEGACY_PROFILE_REDIRECT_STATUS || "302");
  try {
    destination = new URL(configuredUrl);
    const match = destination.pathname.match(/\/(?:profile-page|p)\/([a-fA-F0-9]{24})\/?$/);
    if (
      !["https:", "http:"].includes(destination.protocol) ||
      destination.username || destination.password ||
      !match || match[1].toLowerCase() === LEGACY_PROFILE_ID ||
      !["301", "302"].includes(status)
    ) {
      throw new Error("Invalid legacy profile redirect configuration");
    }
    destinationId = match[1];
  } catch {
    return res.status(503).json({
      message: "Legacy profile redirect is misconfigured. Configure an absolute HTTP(S) profile-page or p URL with a different profile ID, and status 301 or 302.",
    });
  }

  try {
    // This destination must refer to a profile served from this application's
    // current database. A redirect alone cannot restore deleted profile data.
    const profile = await Profile.findById(destinationId);
    if (!profile) {
      return res.status(404).json({
        message: "Replacement profile not found. Create the profile in the current database or restore it from an available backup, then update LEGACY_PROFILE_REDIRECT_URL.",
      });
    }
    return res.redirect(Number(status), destination.href);
  } catch {
    console.error("Unable to verify the legacy redirect's replacement profile");
    return res.status(503).json({
      message: "Unable to verify the replacement profile. Please try again later.",
    });
  }
};
