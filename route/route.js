const express = require("express");
const {
  createProfile,
  getProfile,
  getProfileById,
  getProfileHtml,
  updateProfile,
} = require("../controller/profilecontroller");
const {
  userlogin,
  adminlogin,
  userregister,
  adminregister,
} = require("../controller/authcontroller");

const router = express.Router();

router.post("/create", createProfile);
router.get("/getprofile/:id", getProfile);
router.put("/profiles/:id", updateProfile);
router.post("/userregister", userregister);
router.post("/adminregister", adminregister);
router.post("/nfcuser", userlogin);
router.post("/nfcadmin", adminlogin);

router.post("/profiles", createProfile);
router.get("/profiles/:id", getProfileById);
router.get("/profile-page/:id", getProfileHtml);
router.get("/p/:id", getProfileHtml);

module.exports = router;
