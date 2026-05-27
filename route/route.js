const express = require("express");
const {
  createProfile,
  getProfile,
  getProfileById,
  getProfileHtml,
  updateProfile,
  getMyProfiles,
  deleteProfile,
} = require("../controller/profilecontroller");
const {
  userlogin,
  adminlogin,
  userregister,
  adminregister,
  me,
} = require("../controller/authcontroller");
const { requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();

router.post("/create", requireAuth, createProfile);
router.get("/getprofile/:id", getProfile);

router.post("/userregister", userregister);
router.post("/adminregister", adminregister);
router.post("/nfcuser", userlogin);
router.post("/nfcadmin", adminlogin);
router.get("/me", requireAuth, me);

router.post("/profiles", requireAuth, createProfile);
router.get("/profiles/mine", requireAuth, getMyProfiles);
router.get("/profiles/:id", getProfileById);
router.get("/profile/:id", getProfileById);
router.put("/profiles/:id", requireAuth, updateProfile);
router.patch("/profiles/:id", requireAuth, updateProfile);
router.get("/profile-page/:id", getProfileHtml);
router.get("/p/:id", getProfileHtml);


router.delete("/deleteprofile/:id", deleteProfile);

module.exports = router;
