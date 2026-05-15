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
    res.status(500).json({ message: "Server Error" });
  }
};

// GET PROFILE JSON
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getProfileById = exports.getProfile;

// GET PROFILE HTML PAGE
exports.getProfileHtml = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).send("Profile not found");
    }

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

    res.send(`
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

.actions button {
  width:100%;
  margin-top:10px;
  padding:12px;
  border:none;
  border-radius:10px;
  color:white;
  cursor:pointer;
}

.save { background:#10b981; }
.share { background:#3b82f6; }

.qr-container {
  margin-top:15px;
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
  facebookUrl
    ? `<a class="btn facebook" href="${facebookUrl}" target="_blank">Facebook</a>`
    : ""
}

${
  websiteUrl
    ? `<a class="btn website" href="${websiteUrl}" target="_blank">Website</a>`
    : ""
}

${
  googleBusinessUrl
    ? `<a class="btn website" href="${googleBusinessUrl}" target="_blank">Google Business</a>`
    : ""
}

<div class="actions">
  <button id="saveBtn">💾 Save Contact</button>
  <button id="shareBtn">🔗 Share Profile</button>
</div>

</div>
</div>

<script>

const vcard = ${JSON.stringify(vCard)};
const profileUrl = ${JSON.stringify(profileUrl)};

function saveContact() {
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "contact.vcf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

async function shareProfile() {
  try {
    if (navigator.share) {
      await navigator.share({
        title: ${JSON.stringify(name || "Profile")},
        text: ${JSON.stringify(name ? `${name}'s profile` : "Profile")},
        url: profileUrl
      });
      return;
    }

    await navigator.clipboard.writeText(profileUrl);
    alert("Copied!");
  } catch (e) {
    prompt("Copy link:", profileUrl);
  }
}

document.getElementById("saveBtn")
  .addEventListener("click", saveContact);

document.getElementById("shareBtn")
  .addEventListener("click", shareProfile);

</script>

</body>
</html>
`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};