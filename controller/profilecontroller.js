const Profile = require("../model/profilemodel");
const QRCode = require("qrcode");
const crypto = require("crypto");

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
    return `${PUBLIC_REDIRECT_BASE}/profile-page/${profileId}`;
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

const extractNestedSocial = (body = {}) => ({
  instagram: body.instagram || body?.social?.instagram || "",
  linkedin: body.linkedin || body?.social?.linkedin || "",
  facebook: body.facebook || body?.social?.facebook || "",
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
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!canManageProfile(profile, req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedProfile = await Profile.findByIdAndUpdate(
      req.params.id,
      buildProfilePatchPayload(req.body, profile),
      { new: true, runValidators: true }
    );

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedProfile,
      fullProfilePageUrl: buildPublicProfilePageUrl(req, updatedProfile._id),
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

exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json(profile);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.getProfileById = async (req, res) => { try { const profile = await Profile.findById(req.params.id); if (!profile) { return res.status(404).json({ message: "Profile not found", }); } res.json(profile); } catch (err) { console.error(err); res.status(500).json({ message: "Server Error", }); } };




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
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
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

<a class="btn call" href="tel:${cleanPhone}">
Call
</a>

<a class="btn email" href="mailto:${encodeURIComponent(email)}">
Email
</a>

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
    console.error(err);

    res.status(500).send("Server Error");
  }
};
