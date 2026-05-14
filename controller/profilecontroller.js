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

  return url.startsWith("http://") ||
    url.startsWith("https://")
    ? url
    : `https://${url}`;
};

// CREATE PROFILE

exports.createProfile = async (req, res) => {

  try {

    const profile =
      new Profile(req.body);

    const savedProfile =
      await profile.save();

    res.status(201).json(savedProfile);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Server Error"
    });
  }
};

// GET PROFILE

exports.getProfile = async (req, res) => {

  try {

    const profile =
      await Profile.findById(
        req.params.id
      );

    if (!profile) {

      return res.status(404).json({
        message: "Profile not found"
      });
    }

    res.json(profile);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Server Error"
    });
  }
};

exports.getProfileById =
  exports.getProfile;

// PROFILE HTML PAGE

exports.getProfileHtml =
async (req, res) => {

  try {

    const profile =
      await Profile.findById(
        req.params.id
      );

    if (!profile) {

      return res
        .status(404)
        .send("Profile not found");
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
      googleBusiness = ""
    } = profile;

    const protocol =
      req.headers["x-forwarded-proto"] ||
      req.protocol ||
      "https";

    const profileUrl =
`${protocol}://${req.get("host")}${req.originalUrl}`;

    // QR CODE

    const qrCodeDataUrl =
      await QRCode.toDataURL(
        profileUrl,
        {
          width: 250,
          margin: 2
        }
      );

    // SOCIAL LINKS

    const instagramUrl =
      instagram
        ? `https://instagram.com/${instagram.replace("@", "")}`
        : "";

    const linkedinUrl =
      linkedin
        ? `https://linkedin.com/in/${linkedin}`
        : "";

    const facebookUrl =
      facebook
        ? `https://facebook.com/${facebook}`
        : "";

    const websiteUrl =
      website
        ? normalizeUrl(website)
        : "";

    const googleBusinessUrl =
      googleBusiness
        ? (
            googleBusiness.startsWith("http")
              ? googleBusiness
              : `https://g.page/${googleBusiness}`
          )
        : "";

    res.send(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0"
/>

<title>
${escapeHtml(name)}
</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#f5f5f5;
  padding:20px;
}

.container{
  max-width:500px;
  margin:auto;
}

.card{
  background:#fff;
  border-radius:20px;
  padding:25px;
  box-shadow:0 5px 20px rgba(0,0,0,0.1);
}

.avatar{
  width:100px;
  height:100px;
  border-radius:50%;
  background:#667eea;
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:40px;
  margin:auto;
}

h1{
  text-align:center;
  margin-top:15px;
}

.bio{
  text-align:center;
  color:#666;
}

.btn{
  display:block;
  text-decoration:none;
  padding:12px;
  margin-top:10px;
  border-radius:10px;
  text-align:center;
  color:#fff;
  font-weight:bold;
}

.call{
  background:#4CAF50;
}

.email{
  background:#2196F3;
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

.website{
  background:#333;
}

.action-btn{
  width:100%;
  border:none;
  padding:14px;
  margin-top:12px;
  border-radius:12px;
  color:white;
  font-size:16px;
  font-weight:bold;
  cursor:pointer;
}

.share-btn{
  background:#0f766e;
}

.save-btn{
  background:#2563eb;
}

.qr-wrap{
  margin-top:20px;
  text-align:center;
}

.qr-wrap img{
  width:220px;
  height:220px;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<div class="avatar">
👤
</div>

<h1>
${escapeHtml(name)}
</h1>

${
  bio
    ? `<p class="bio">
        ${escapeHtml(bio)}
      </p>`
    : ""
}

${
  phone
    ? `<a
        href="tel:${phone}"
        class="btn call"
      >
      📞 Call
      </a>`
    : ""
}

${
  email
    ? `<a
        href="mailto:${email}"
        class="btn email"
      >
      ✉️ Email
      </a>`
    : ""
}

${
  instagramUrl
    ? `<a
        href="${instagramUrl}"
        target="_blank"
        class="btn instagram"
      >
      📷 Instagram
      </a>`
    : ""
}

${
  linkedinUrl
    ? `<a
        href="${linkedinUrl}"
        target="_blank"
        class="btn linkedin"
      >
      💼 LinkedIn
      </a>`
    : ""
}

${
  facebookUrl
    ? `<a
        href="${facebookUrl}"
        target="_blank"
        class="btn facebook"
      >
      📘 Facebook
      </a>`
    : ""
}

${
  websiteUrl
    ? `<a
        href="${websiteUrl}"
        target="_blank"
        class="btn website"
      >
      🌐 Website
      </a>`
    : ""
}

${
  googleBusinessUrl
    ? `<a
        href="${googleBusinessUrl}"
        target="_blank"
        class="btn website"
      >
      🏢 Google Business
      </a>`
    : ""
}

<button
type="button"
class="action-btn share-btn"
onclick="shareProfile()"
>
📤 Share Profile
</button>

<button
type="button"
class="action-btn save-btn"
onclick="saveContact()"
>
💾 Save Contact
</button>

<div class="qr-wrap">

<img
src="${qrCodeDataUrl}"
alt="QR Code"
/>

</div>

</div>

</div>

<script>

const contactData = {
  name: "${name}",
  phone: "${phone}",
  email: "${email}",
  address: "${address}"
};

function shareProfile() {

  const shareData = {
    title: contactData.name,
    text:
      "Phone: " +
      contactData.phone +
      "\\nEmail: " +
      contactData.email,
    url: window.location.href
  };

  if (navigator.share) {

    navigator.share(shareData)
      .catch((err) => {
        console.log(err);
      });

  } else {

    navigator.clipboard.writeText(
      window.location.href
    );

    alert("Profile link copied");
  }
}



function saveContact() {

  const vcard =
"BEGIN:VCARD\\n" +
"VERSION:3.0\\n" +
"FN:" + contactData.name + "\\n" +
"TEL:" + contactData.phone + "\\n" +
"EMAIL:" + contactData.email + "\\n" +
"ADR:" + contactData.address + "\\n" +
"END:VCARD";

  const blob = new Blob(
    [vcard],
    {
      type:
        "text/vcard;charset=utf-8"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    (contactData.name || "contact") +
    ".vcf";

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

</script>

</body>

</html>

    `);

  } catch (err) {

    console.error(err);

    res.status(500).send(
      "Server Error"
    );
  }
};