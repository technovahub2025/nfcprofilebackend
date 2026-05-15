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

    const profileUrl = `${protocol}://${req.get("host")}${req.originalUrl}`;

    // QR CODE
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

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<title>${escapeHtml(name)} - Business Profile</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f4f4f4;
  padding: 20px;
}

.container {
  max-width: 500px;
  margin: auto;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.1);
}

.avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin: auto;
}

.qr-container {
  text-align: center;
  margin-top: 20px;
}

.qr-code {
  width: 150px;
  height: 150px;
  border-radius: 12px;
  background: white;
  padding: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.1);
}

h1 {
  text-align: center;
  margin-top: 15px;
}

.bio {
  text-align: center;
  color: #666;
  margin-top: 10px;
}

.info {
  margin-top: 20px;
}

.info p {
  margin: 10px 0;
  font-size: 15px;
}

.btn {
  display: block;
  text-decoration: none;
  padding: 12px;
  margin-top: 10px;
  border-radius: 10px;
  text-align: center;
  color: white;
  font-weight: bold;
}

.call {
  background: #16a34a;
}

.email {
  background: #2563eb;
}

.instagram {
  background: #E4405F;
}

.linkedin {
  background: #0077B5;
}

.facebook {
  background: #1877F2;
}

.website {
  background: #333;
}

.actions {
  margin-top: 20px;
}

.action-btn {
  width: 100%;
  border: none;
  padding: 14px;
  margin-top: 12px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  cursor: pointer;
}

.save {
  background: linear-gradient(135deg, #059669, #10b981);
}

.share {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
}

.footer {
  margin-top: 25px;
  text-align: center;
}

.footer a {
  text-decoration: none;
  color: #666;
  font-size: 14px;
}

</style>
</head>

<body>

<div class="container">

  <div class="card">

    <div class="avatar">👤</div>

    <div class="qr-container">
      <img
        src="${qrCode}"
        alt="QR Code"
        class="qr-code"
      />
    </div>

    <h1>${escapeHtml(name)}</h1>

    ${
      bio
        ? `<p class="bio">${escapeHtml(bio)}</p>`
        : ""
    }

    <div class="info">

      ${
        phone
          ? `<p><b>Phone:</b> ${escapeHtml(phone)}</p>`
          : ""
      }

      ${
        email
          ? `<p><b>Email:</b> ${escapeHtml(email)}</p>`
          : ""
      }

      ${
        address
          ? `<p><b>Address:</b> ${escapeHtml(address)}</p>`
          : ""
      }

    </div>

    ${
      phone
        ? `<a href="tel:${escapeHtml(cleanPhone)}" class="btn call">📞 Call</a>`
        : ""
    }

    ${
      email
        ? `<a href="mailto:${escapeHtml(email)}" class="btn email">✉️ Email</a>`
        : ""
    }

    ${
      instagramUrl
        ? `<a href="${escapeHtml(instagramUrl)}" target="_blank" class="btn instagram">📷 Instagram</a>`
        : ""
    }

    ${
      linkedinUrl
        ? `<a href="${escapeHtml(linkedinUrl)}" target="_blank" class="btn linkedin">💼 LinkedIn</a>`
        : ""
    }

    ${
      facebookUrl
        ? `<a href="${escapeHtml(facebookUrl)}" target="_blank" class="btn facebook">📘 Facebook</a>`
        : ""
    }

    ${
      websiteUrl
        ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" class="btn website">🌐 Website</a>`
        : ""
    }

    ${
      googleBusinessUrl
        ? `<a href="${escapeHtml(googleBusinessUrl)}" target="_blank" class="btn website">🏢 Google Business</a>`
        : ""
    }

    <div class="actions">

      <button
        type="button"
        class="action-btn save"
        onclick="saveContact()">
        💾 Save Contact
      </button>

      <button
        type="button"
        class="action-btn share"
        onclick="shareProfile()">
        🔗 Share Profile
      </button>

    </div>

    <div class="footer">
      <a href="https://www.technovahub.in/" target="_blank">
        Powered by TechNovaHub
      </a>
    </div>

  </div>

</div>

<script>

const vcard = ${JSON.stringify(vCard)};
const profileUrl = ${JSON.stringify(profileUrl)};

function saveContact() {

  const blob = new Blob([vcard], {
    type: "text/vcard;charset=utf-8"
  });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = ${JSON.stringify(
    (name || "contact") + ".vcf"
  )};

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}

function shareProfile() {

  const shareData = {
    title: ${JSON.stringify(name || "Business Profile")},
    text: ${JSON.stringify(
      name ? `${name}'s profile` : "Business profile"
    )},
    url: profileUrl
  };

  if (navigator.share) {

    navigator.share(shareData)
      .catch(() => {});

    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {

    navigator.clipboard.writeText(profileUrl)
      .then(() => {
        alert("Profile link copied");
      });

    return;
  }

  window.prompt(
    "Copy this profile link:",
    profileUrl
  );
}

</script>

</body>
</html>
`);
  } catch (err) {
    console.error(err);

    res.status(500).send("Server Error");
  }
};