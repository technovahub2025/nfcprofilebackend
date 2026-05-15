const Profile = require("../model/profilemodel");
const QRCode = require("qrcode");
const crypto = require("crypto");

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

// SOCIAL HELPERS
const cleanInstagram = (value = "") =>
  value
    ? `https://instagram.com/${value.replace("@", "").trim()}`
    : "";

const cleanLinkedin = (value = "") => {
  if (!value) return "";

  const v = value.trim();

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

  return value.startsWith("http")
    ? value
    : `https://facebook.com/${value.trim()}`;
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
      instagram = "",
      linkedin = "",
      facebook = "",
      website = "",
      googleBusiness = "",
    } = profile;

    const protocol =
      req.headers["x-forwarded-proto"] ||
      req.protocol ||
      "http";

    const profileUrl = `${protocol}://${req.get(
      "host"
    )}${req.originalUrl}`;

    const qrCode = await QRCode.toDataURL(profileUrl);

    const cleanPhone = String(phone).replace(
      /[^\d+]/g,
      ""
    );

    // SOCIAL URLS
    const instagramUrl = cleanInstagram(instagram);

    const linkedinUrl = cleanLinkedin(linkedin);

    const facebookUrl = cleanFacebook(facebook);

    const websiteUrl = website
      ? normalizeUrl(website)
      : "";

    const googleBusinessUrl = googleBusiness
      ? googleBusiness.startsWith("http")
        ? googleBusiness
        : `https://g.page/${googleBusiness}`
      : "";

    // NOTE SECTION
    const socialNote = [
      bio ? `• Bio: ${bio}` : "",

      instagramUrl
        ? `• Instagram: ${instagramUrl}`
        : "",

      linkedinUrl
        ? `• LinkedIn: ${linkedinUrl}`
        : "",

      facebookUrl
        ? `• Facebook: ${facebookUrl}`
        : "",

      googleBusinessUrl
        ? `• Google Business: ${googleBusinessUrl}`
        : "",

      websiteUrl
        ? `• Website: ${websiteUrl}`
        : "",
    ]
      .filter(Boolean)
      .join("\\n");

    // VCARD
    const vCard = [
      "BEGIN:VCARD",
      "VERSION:3.0",

      `FN:${name}`,

      cleanPhone
        ? `TEL;TYPE=CELL:${cleanPhone}`
        : "",

      email
        ? `EMAIL:${email}`
        : "",

      address
        ? `ADR:;;${address}`
        : "",

      websiteUrl
        ? `URL:${websiteUrl}`
        : "",

      bio
        ? `TITLE:${bio}`
        : "",

      socialNote
        ? `NOTE:${socialNote}`
        : "",

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

<a class="btn email" href="mailto:${email}">
Email
</a>

${
  instagramUrl
    ? `
<a class="btn instagram"
href="${instagramUrl}"
target="_blank">
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
target="_blank">
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
target="_blank">
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
target="_blank">
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

<script nonce="${nonce}">
window.__PROFILE_DATA__ = ${JSON.stringify({
  vCard,
  profileUrl,
  name: name || "Profile",
})};
</script>

<script nonce="${nonce}">

function showError(title, err){
  console.error(title, err);

  alert(
    title +
    "\\n\\n" +
    (err?.message || err || "Unknown error")
  );
}

function saveContact(){
  try{

    const data = window.__PROFILE_DATA__;

    const blob = new Blob(
      [data.vCard],
      {
        type:"text/vcard;charset=utf-8",
      }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "contact.vcf";

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

  }catch(err){
    showError("SAVE CONTACT FAILED", err);
  }
}

async function shareProfile(){

  try{

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

    alert("Link copied!");

  }catch(err){
    showError("SHARE PROFILE FAILED", err);
  }
}

document.addEventListener(
  "DOMContentLoaded",
  () => {

    document
      .getElementById("saveBtn")
      ?.addEventListener(
        "click",
        saveContact
      );

    document
      .getElementById("shareBtn")
      ?.addEventListener(
        "click",
        shareProfile
      );
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