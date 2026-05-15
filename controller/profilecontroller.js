const Profile = require("../model/profilemodel");
const QRCode = require("qrcode");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeUrl = (url = "") => {
  if (!url) return "";

  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
};

// CREATE PROFILE
exports.createProfile = async (req, res) => {
  try {
    const profile = new Profile(req.body);

    const savedProfile = await profile.save();

    res.status(201).json(savedProfile);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// GET PROFILE JSON
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

exports.getProfileById = exports.getProfile;
// GET PROFILE HTML PAGE
// GET PROFILE HTML PAGE
exports.getProfileHtml = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).send("Profile not found");
    }

    // Generate a random nonce for this request
    const crypto = require("crypto");
    const nonce = crypto.randomBytes(16).toString("base64");

    // Set CSP header with nonce
    res.setHeader(
      "Content-Security-Policy",
      "script-src 'self' 'nonce-" + nonce + "'; script-src-attr 'none'; style-src 'unsafe-inline'; img-src 'self' data:"
    );

    const {
      name = "",
      bio = "",
      phone = "",
      email = "",
      address = "",
      instagram = "",
      linkedin = "",
      facebook = "",
      website = "",
      googleBusiness = "",
    } = profile;

    const protocol =
      req.headers["x-forwarded-proto"] || req.protocol || "http";

    const profileUrl =
      `${protocol}://${req.get("host")}${req.originalUrl}`;

    const qrCode = await QRCode.toDataURL(profileUrl);

    const cleanPhone = String(phone).replace(/[^\d+]/g, "");

    const instagramUrl = instagram
      ? `https://instagram.com/${instagram.replace("@", "")}`
      : "";

    const linkedinUrl = linkedin
      ? `https://linkedin.com/in/${linkedin}`
      : "";

    const facebookUrl = facebook
      ? `https://facebook.com/${facebook}`
      : "";

    const websiteUrl = website ? normalizeUrl(website) : "";

    const googleBusinessUrl = googleBusiness
      ? googleBusiness.startsWith("http")
        ? googleBusiness
        : `https://g.page/${googleBusiness}`
      : "";

    const vCard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      cleanPhone ? `TEL:${cleanPhone}` : "",
      email ? `EMAIL:${email}` : "",
      address ? `ADR:;;${address}` : "",
      websiteUrl ? `URL:${websiteUrl}` : "",
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
body { font-family: Arial; background:#f4f4f4; padding:20px; }
.container { max-width:500px; margin:auto; }
.card { background:#fff; padding:20px; border-radius:15px; text-align:center; }

.avatar {
  width:90px; height:90px; border-radius:50%;
  background:#2563eb; color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:35px; margin:auto;
}

.qr-code {
  width:140px;
  margin-top:15px;
}

.btn {
  display:block;
  padding:10px;
  margin-top:10px;
  border-radius:10px;
  text-decoration:none;
  color:white;
}

.call { background:#16a34a; }
.email { background:#2563eb; }
.instagram { background:#E4405F; }
.linkedin { background:#0077B5; }
.facebook { background:#1877F2; }
.website { background:#333; }
.googlebusiness { background:#4285F4; }
.actions button {
  width:100%;
  margin-top:10px;
  padding:12px;
  border:none;
  border-radius:10px;
  color:white;
  cursor:pointer;
  font-size: 16px;
}

.save { background:#10b981; }
.share { background:#3b82f6; }
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

<a class="btn call" href="tel:${cleanPhone}">Call</a>
<a class="btn email" href="mailto:${email}">Email</a>

${
  instagramUrl
    ? `<a class="btn instagram" href="${instagramUrl}" target="_blank">Instagram</a>`
    : ""
}

${
  linkedinUrl
    ? `<a class="btn linkedin" href="${linkedinUrl}" target="_blank">LinkedIn</a>`
    : ""
}

${
  googleBusinessUrl
    ? `<a class="btn googlebusiness" href="${googleBusinessUrl}" target="_blank">Google Business</a>`
    : ""
}

${
  facebookUrl
    ? `<a class="btn facebook" href="${facebookUrl}" target="_blank">Facebook</a>`
    : ""
}

<div class="actions">
  <button id="saveBtn" class="save" data-vcard="${encodeURIComponent(vCard)}">💾 Save Contact</button>
  <button id="shareBtn" class="share" data-profile-url="${encodeURIComponent(profileUrl)}" data-name="${encodeURIComponent(name || "Profile")}">🔗 Share Profile</button>
</div>

</div>
</div>

<script nonce="${nonce}">

function showError(title, err) {
  console.error(title, err);
  alert(title + "\n\n" + (err?.message || err || "Unknown error"));
}

function saveContact() {
  console.log("✅ Save Contact clicked!");
  try {
    const vcardData = decodeURIComponent(document.getElementById("saveBtn").getAttribute("data-vcard"));
    const blob = new Blob([vcardData], {
      type: "text/vcard;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "contact.vcf";

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    showError("SAVE CONTACT FAILED", err);
  }
}

async function shareProfile() {
  console.log("✅ Share Profile clicked!");
  try {
    const shareBtn = document.getElementById("shareBtn");
    const profileUrl = decodeURIComponent(shareBtn.getAttribute("data-profile-url"));
    const name = decodeURIComponent(shareBtn.getAttribute("data-name"));

    if (navigator.share) {
      await navigator.share({
        title: name,
        text: name + "'s profile",
        url: profileUrl
      });
      return;
    }

    const temp = document.createElement("textarea");
    document.body.appendChild(temp);
    temp.value = profileUrl;
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);

    alert("Link copied!");

  } catch (err) {
    showError("SHARE PROFILE FAILED", err);
  }
}

function attachEventListeners() {
  const saveBtn = document.getElementById("saveBtn");
  const shareBtn = document.getElementById("shareBtn");

  console.log("Attaching event listeners...");
  console.log("saveBtn:", saveBtn);
  console.log("shareBtn:", shareBtn);

  if (saveBtn) {
    saveBtn.addEventListener("click", saveContact);
    console.log("Save contact listener attached");
  } else {
    console.error("saveBtn not found!");
  }
  if (shareBtn) {
    shareBtn.addEventListener("click", shareProfile);
    console.log("Share profile listener attached");
  } else {
    console.error("shareBtn not found!");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachEventListeners);
} else {
  attachEventListeners();
}

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