const mongoose = require("mongoose");
const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  bio: String,

  // 👇 moved out of "social"
  googleBusiness: { type: String, default: "" },
  instagram: { type: String, default: "" },
  linkedin: { type: String, default: "" },
  facebook: { type: String, default: "" },

  // Optional image
  profileImageBase64: {
    type: String,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model("Profile", profileSchema);