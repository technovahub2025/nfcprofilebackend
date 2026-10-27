const express = require("express");
const profileController = require("../controller/profilecontroller");
const authController = require("../controller/authcontroller");
const legacyProfileRedirect = require("../middleware/legacyProfileRedirect");

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

const router = express.Router();

// Reject malformed IDs before Mongoose attempts to cast them for a lookup.
router.param("id", (req, res, next, id) => {
  const isMappedLegacyHtmlProfile =
    id.toLowerCase() === "6a18362cff67a900a751" &&
    ["/profile-page/:id", "/p/:id"].includes(req.route?.path);

  if (!/^[a-fA-F0-9]{24}$/.test(id) && !isMappedLegacyHtmlProfile) {
    return res.status(400).json({
      message: "Invalid profile ID. Expected a 24-character hexadecimal profile ID.",
    });
  }

  next();
});

router.post("/create", createProfile);
router.get("/getprofile/:id", getProfile);
router.post("/userregister", userregister);
router.post("/adminregister", adminregister);
router.post("/nfcuser", userlogin);
router.post("/nfcadmin", adminlogin);

if (me) {
  router.get("/me", me);
} else {
  console.warn('Skipping "/me" route because authController.me is missing');
}

router.post("/profiles", createProfile);
router.get("/profiles/mine", getMyProfiles);
router.get("/profiles/:id", getProfileById);
router.get("/profile/:id", getProfileById);

router.put("/profiles/:id", updateProfile);
router.patch("/profiles/:id", updateProfile);

router.get("/profile-page/:id", legacyProfileRedirect, getProfileHtml);
router.get("/p/:id", legacyProfileRedirect, getProfileHtml);

router.delete("/deleteprofile/:id", deleteProfile);

module.exports = router;
