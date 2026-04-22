const Profile = require("../model/profilemodel");

exports.createProfile = async (req, res) => {
  try {
    // Add request timeout
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: "Request timeout" });
      }
    }, 10000); // 10 second timeout

    const profile = new Profile({
      ...req.body,
      profileImageBase64: req.body.profileImageBase64 || null
    });

    const saved = await profile.save();
    clearTimeout(timeout);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

   const profileUrl = `${baseUrl}/api/getprofile/${saved._id}`;

    res.status(201).json({
      message: "Profile created",
      id: saved._id,
      url: profileUrl,  // use this in QR
      data: saved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    // Add request timeout
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: "Request timeout" });
      }
    }, 10000); // 10 second timeout

    const profile = await Profile.findById(req.params.id);
    clearTimeout(timeout);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};