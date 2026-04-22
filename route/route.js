const express = require("express");
const { createProfile, getProfile } = require("../controller/profilecontroller");
const router = express.Router();


// 👉 CREATE
router.post("/create", createProfile);
router.get("/getprofile/:id", getProfile);

module.exports = router;