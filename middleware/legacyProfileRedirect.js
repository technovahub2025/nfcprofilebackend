const Profile = require("../model/profilemodel");

const PROFILE_REDIRECTS = {
  "6a2fe4a0897783774c008984": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6acdc181a4d611481f52e8fe",
    envKey: "LEGACY_PROFILE_REDIRECT_URL",
  },
  "6a311fc60ee906263fa196ec": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6acf5f8ba4d611481f52e904",
    envKey: "LEGACY_PROFILE_REDIRECT_URL_2",
  },
  "6a2feaa9897783774c008988": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6acf59fea4d611481f52e901",
    envKey: "LEGACY_PROFILE_REDIRECT_URL_3",
  },
  "6a290cda897783774c00897c": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6acf58aea4d611481f52e900",
    envKey: "LEGACY_PROFILE_REDIRECT_URL_4",
  },
  "6a2feb1e897783774c008989": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6acf4b6ea4d611481f52e8ff",
    envKey: "LEGACY_PROFILE_REDIRECT_URL_5",
  },
  "6a18377fff67a900a751c41e": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6a18362cff67a900a751c41d",
    envKey: "LEGACY_PROFILE_REDIRECT_URL_6",
  },
  "6a18362cff67a900a751": {
    url: "https://www.technovahub.in/tbc_connect/api/profile-page/6ad89d56e4e2ee258076bcae",
    envKey: "LEGACY_PROFILE_REDIRECT_URL_7",
  },
};

// Only the mapped profiles' HTML routes use this middleware. JSON and CRUD
// routes continue to operate on their original IDs.
module.exports = async (req, res, next) => {
  const mapping = PROFILE_REDIRECTS[req.params.id.toLowerCase()];
  if (!mapping) return next();

  // The supplied mapping works by default; an environment value overrides it.
  // An explicitly empty value disables the redirect.
  const configuredUrl = String(process.env[mapping.envKey] ?? mapping.url).trim();
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
      !match || PROFILE_REDIRECTS[match[1].toLowerCase()] ||
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
        message: `Replacement profile not found. Create the profile in the current database or restore it from an available backup, then update ${mapping.envKey}.`,
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
