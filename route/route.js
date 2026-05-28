const express = require("express");
const profileController = require("../controller/profilecontroller");
const authController = require("../controller/authcontroller");
const authMiddleware = require("../middleware/authmiddleware");

const ensureHandler = (name, handler) => {
  if (typeof handler !== "function") {
    throw new TypeError(`Route handler "${name}" must be a function`);
  }
  return handler;
};

const createProfile = ensureHandler("createProfile", profileController.createProfile);
const getProfile = ensureHandler("getProfile", profileController.getProfile);
const getProfileById = ensureHandler("getProfileById", profileController.getProfileById);
const getProfileHtml = ensureHandler("getProfileHtml", profileController.getProfileHtml);
const updateProfile = ensureHandler("updateProfile", profileController.updateProfile);
const getMyProfiles = ensureHandler("getMyProfiles", profileController.getMyProfiles);
const deleteProfile = ensureHandler("deleteProfile", profileController.deleteProfile);

const userlogin = ensureHandler("userlogin", authController.userlogin);
const adminlogin = ensureHandler("adminlogin", authController.adminlogin);
const userregister = ensureHandler("userregister", authController.userregister);
const adminregister = ensureHandler("adminregister", authController.adminregister);
const me = typeof authController.me === "function" ? authController.me : null;

const requireAuth = ensureHandler("requireAuth", authMiddleware.requireAuth);

const router = express.Router();

router.post("/create", requireAuth, createProfile);
router.get("/getprofile/:id", getProfile);

router.post("/userregister", userregister);
router.post("/adminregister", adminregister);
router.post("/nfcuser", userlogin);
router.post("/nfcadmin", adminlogin);
if (me) {
  router.get("/me", requireAuth, me);
} else {
  console.warn('Skipping "/me" route because authController.me is missing');
}

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
