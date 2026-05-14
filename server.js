require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const Routes = require('./route/route');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// Middleware
// ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security & Logging
app.use(helmet());
app.use(morgan('dev'));

// ======================
// Health Check Route
// ======================
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 Server is running successfully'
    });
});

// ======================
// API Routes
// ======================
app.use('/api', Routes);

// ======================
// MongoDB Connection
// ======================
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected');

        // Start Server Only After DB Connection
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.log('❌ MongoDB Connection Error');
        console.log(err);
    });

// ======================
// Global Error Handler
// ======================
app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});


