const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    bio: { type: String, default: "" },
    googleBusiness: { type: String, default: "" },
    instagram: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    facebook: { type: String, default: "" },
    youtube: { type: String, default: "" },
    website: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Login", default: null },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);
