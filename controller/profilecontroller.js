const Profile = require("../model/profilemodel");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(name)} - Business Profile</title>
<style>
body{
    font-family: Arial, sans-serif;
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
.call{ background:#4CAF50; }
.email{ background:#2196F3; }
.instagram{ background:#E4405F; }
.linkedin{ background:#0077B5; }
.facebook{ background:#1877F2; }
.website{ background:#333; }
.info{
    margin-top:20px;
}
.info p{
    margin:10px 0;
}
</style>
</head>
<body>
<div class="container">
<div class="card">
<div class="avatar">👤</div>
<h1>${escapeHtml(name)}</h1>
${bio ? `<p class="bio">${escapeHtml(bio)}</p>` : ""}
<div class="info">
${phone ? `<p><b>Phone:</b> ${escapeHtml(phone)}</p>` : ""}
${email ? `<p><b>Email:</b> ${escapeHtml(email)}</p>` : ""}
${address ? `<p><b>Address:</b> ${escapeHtml(address)}</p>` : ""}
</div>
${phone ? `<a href="tel:${escapeHtml(phone)}" class="btn call">📞 Call</a>` : ""}
${email ? `<a href="mailto:${escapeHtml(email)}" class="btn email">✉️ Email</a>` : ""}
${instagram ? `<a href="${escapeHtml(instagram)}" target="_blank" class="btn instagram">📷 Instagram</a>` : ""}
${linkedin ? `<a href="${escapeHtml(linkedin)}" target="_blank" class="btn linkedin">💼 LinkedIn</a>` : ""}
${facebook ? `<a href="${escapeHtml(facebook)}" target="_blank" class="btn facebook">📘 Facebook</a>` : ""}
${website ? `<a href="${escapeHtml(website)}" target="_blank" class="btn website">🌐 Website</a>` : ""}
${googleBusiness ? `<a href="${escapeHtml(googleBusiness)}" target="_blank" class="btn website">🏢 Google Business</a>` : ""}
</div>
</div>
</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
