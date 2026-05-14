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

exports.createProfile = async (req, res) => {

  try {

    const profile =
      new Profile(req.body);

    const savedProfile =
      await profile.save();

    res
      .status(201)
      .json(savedProfile);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Server Error"
    });
  }
};

exports.getProfile = async (req, res) => {

  try {

    const profile =
      await Profile.findById(
        req.params.id
      );

    if (!profile) {

      return res
        .status(404)
        .json({
          message:
            "Profile not found"
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
      googleBusiness = "",
    } = profile;

    const protocol =
      req.headers[
        "x-forwarded-proto"
      ] ||
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
          margin: 2,
        }
      );

    const cleanPhone =
      String(phone).replace(
        /[^\d+]/g,
        ""
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

    // VCARD

    const vCard = [

      "BEGIN:VCARD",

      "VERSION:3.0",

      `FN:${name}`,

      phone
        ? `TEL;TYPE=CELL:${cleanPhone}`
        : "",

      email
        ? `EMAIL;TYPE=INTERNET:${email}`
        : "",

      address
        ? `ADR;TYPE=HOME:;;${address}`
        : "",

      websiteUrl
        ? `URL:${websiteUrl}`
        : "",

      instagramUrl
        ? `X-SOCIALPROFILE;TYPE=instagram:${instagramUrl}`
        : "",

      linkedinUrl
        ? `X-SOCIALPROFILE;TYPE=linkedin:${linkedinUrl}`
        : "",

      facebookUrl
        ? `X-SOCIALPROFILE;TYPE=facebook:${facebookUrl}`
        : "",

      googleBusinessUrl
        ? `NOTE:Google Business - ${googleBusinessUrl}`
        : "",

      bio
        ? `NOTE:${bio}`
        : "",

      "END:VCARD",

    ]
    .filter(Boolean)
    .join("\n");

    res.send(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8" />

<meta
name="viewport"
content="width=device-width, initial-scale=1.0"
/>

<title>
${escapeHtml(name)} - Business Profile
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
  background:white;
  border-radius:20px;
  padding:25px;
  box-shadow:0 5px 20px rgba(0,0,0,0.1);
}

.avatar{
  width:100px;
  height:100px;
  border-radius:50%;
  background:#667eea;
  color:white;
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
  margin-top:10px;
}

.btn{
  display:block;
  text-decoration:none;
  padding:12px;
  margin-top:10px;
  border-radius:10px;
  text-align:center;
  color:white;
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

.info{
  margin-top:20px;
}

.info p{
  margin:10px 0;
}

.actions{
  margin-top:18px;
}

.action-btn{
  width:100%;
  display:block;
  padding:12px;
  border:none;
  border-radius:12px;
  cursor:pointer;
  color:white;
  font-size:16px;
  font-weight:bold;
  margin-top:10px;
}

.share-btn{
  background:linear-gradient(
    135deg,
    #0f766e,
    #14b8a6
  );
}

.save-btn{
  background:linear-gradient(
    135deg,
    #2563eb,
    #3b82f6
  );
}

.qr-wrap{
  margin-top:20px;
  padding:16px;
  border-radius:16px;
  background:#fafafa;
  text-align:center;
  border:1px solid #eee;
}

.qr-wrap img{
  width:220px;
  height:220px;
  display:block;
  margin:auto;
}

.qr-wrap p{
  margin:12px 0 0;
  color:#666;
  font-size:14px;
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

<div class="info">

${
  phone
    ? `<p>
        <b>Phone:</b>
        ${escapeHtml(phone)}
      </p>`
    : ""
}

${
  email
    ? `<p>
        <b>Email:</b>
        ${escapeHtml(email)}
      </p>`
    : ""
}

${
  address
    ? `<p>
        <b>Address:</b>
        ${escapeHtml(address)}
      </p>`
    : ""
}

</div>

${
  phone
    ? `<a
        href="tel:${escapeHtml(phone)}"
        class="btn call"
      >
      Call
      </a>`
    : ""
}

${
  email
    ? `<a
        href="mailto:${escapeHtml(email)}"
        class="btn email"
      >
      Email
      </a>`
    : ""
}

${
  instagramUrl
    ? `<a
        href="${escapeHtml(instagramUrl)}"
        target="_blank"
        class="btn instagram"
      >
      Instagram
      </a>`
    : ""
}

${
  linkedinUrl
    ? `<a
        href="${escapeHtml(linkedinUrl)}"
        target="_blank"
        class="btn linkedin"
      >
      LinkedIn
      </a>`
    : ""
}

${
  facebookUrl
    ? `<a
        href="${escapeHtml(facebookUrl)}"
        target="_blank"
        class="btn facebook"
      >
      Facebook
      </a>`
    : ""
}

${
  websiteUrl
    ? `<a
        href="${escapeHtml(websiteUrl)}"
        target="_blank"
        class="btn website"
      >
      Website
      </a>`
    : ""
}

${
  googleBusinessUrl
    ? `<a
        href="${escapeHtml(googleBusinessUrl)}"
        target="_blank"
        class="btn website"
      >
      Google Business
      </a>`
    : ""
}

<div class="actions">

<button
type="button"
class="action-btn share-btn"
onclick="shareProfile()"
>
Share Profile + QR
</button>

<button
type="button"
class="action-btn save-btn"
onclick="saveContact()"
>
Save Contact
</button>

</div>

<div class="qr-wrap">

<img
src="${qrCodeDataUrl}"
alt="Profile QR Code"
/>

<p>
Scan to open profile
</p>

</div>

</div>

</div>

<script>

// SHARE PROFILE + QR

async function shareProfile() {

  try {

    const qrImage =
      document.querySelector(
        ".qr-wrap img"
      );

    const response =
      await fetch(qrImage.src);

    const blob =
      await response.blob();

    const qrFile =
      new File(
        [blob],
        "profile-qr.png",
        {
          type:"image/png"
        }
      );

    const shareText =
\`${name}

Phone: ${phone || ""}

Email: ${email || ""}

Address: ${address || ""}

Profile:
${profileUrl}\`;

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({
        files:[qrFile]
      })
    ) {

      await navigator.share({

        title:
          "${name}",

        text:
          shareText,

        url:
          "${profileUrl}",

        files:[qrFile]

      });

      return;
    }

    await navigator.clipboard
      .writeText(shareText);

    alert(
      "Profile copied"
    );

  } catch (err) {

    console.error(err);

    alert(
      "Unable to share profile"
    );
  }
}

// SAVE CONTACT

function saveContact() {

  const vcard =
    ${JSON.stringify(vCard)};

  const blob =
    new Blob(
      [vcard],
      {
        type:"text/vcard"
      }
    );

  const link =
    document.createElement("a");

  link.href =
    window.URL.createObjectURL(blob);

  link.download =
    ${JSON.stringify(
      (name || "contact") + ".vcf"
    )};

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
}

</script>

</body>

</html>

    `);

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send("Server Error");
  }
};