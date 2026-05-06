const Login = require('../model/authmodel');

const bcrypt = require('bcrypt');

exports.userregister = async (req, res) => {
  try {
    const { email, password, role = "user" } = req.body;

    // Check existing user
    const existingUser = await Login.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 8); // reduce from 10 → 8 (faster)

    const user = new Login({
      email,
      password: hashedPassword,
      role,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

exports.adminregister = async (req, res) => {
  try {
    const { email, password, role = "admin" } = req.body;

    // Check existing user
    const existingUser = await Login.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 8); // reduce from 10 → 8 (faster)

    const user = new Login({
      email,
      password: hashedPassword,
      role,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
exports.userlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Login.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Send response first
    res.status(200).json({
      message: "Login successful",
      user: {
        email: user.email,
        name: user.name,
        role: "user",
        lastLogin: new Date()
      }
    });

    // Update lastLogin after response
    await Login.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message });
  }
};


exports.adminlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Login.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Send response first
    res.status(200).json({
      message: "Login successful",
      user: {
        email: user.email,
        name: user.name,
        role: "admin",
        lastLogin: new Date()
      }
    });

    // Update lastLogin after response
    await Login.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message });
  }
};


