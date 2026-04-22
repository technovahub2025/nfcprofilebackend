const Profile = require("../model/profilemodel");

exports.createProfile = async (req, res) => {
  try {
    const profile = new Profile({
      ...req.body,
      profileImageBase64: req.body.profileImageBase64 || null
    });

    const saved = await profile.save();

    // 👉 Get base URL dynamically
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // 👉 Generate profile URL
    const profileUrl = `${baseUrl}/api/getprofile/${saved._id}`;

    res.status(201).json({
      message: "Profile created",
      id: saved._id,
      url: profileUrl,  // 👈 use this in QR
      data: saved
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
};