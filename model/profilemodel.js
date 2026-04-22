const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  bio: String,

  social: {
    googleBusiness: String,
    instagram: String,
    linkedin: String,
    facebook: String
  },

  // Optional image
  profileImageBase64: {
    type: String,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model("Profile", profileSchema);