require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const https = require('https');
const path = require('path');

const Routes = require('./route/route');

// ======================
// Environment Variables
// ======================

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];

const missingEnvVars = requiredEnvVars.filter(
    (key) => !process.env[key]
);

if (missingEnvVars.length > 0) {
    console.error(
        `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
    process.exit(1);
}

// ======================
// App Configuration
// ======================

const app = express();

const PORT = process.env.PORT || 3000;

// ======================
// Base Path
// ======================

const normalizeBasePath = (value = '/tbc_connect') => {
    const pathValue =
        String(value || '/tbc_connect').trim() || '/tbc_connect';

    const withLeadingSlash = pathValue.startsWith('/')
        ? pathValue
        : `/${pathValue}`;

    return withLeadingSlash.replace(/\/+$/, '');
};

const BASE_PATH = normalizeBasePath(
    process.env.BASE_PATH || process.env.APP_BASE_PATH
);

const APP_BASE_URL =
    process.env.APP_BASE_URL ||
    `http://localhost:${PORT}${BASE_PATH}`;

// ======================
// Legacy Paths
// ======================

const LEGACY_BASE_PATH = '/tbc';
const LEGACY_NFC_BASE_PATH = '/nfc';

const API_PATH = `${BASE_PATH}/api`;
const LEGACY_API_PATH = `${LEGACY_BASE_PATH}/api`;
const LEGACY_NFC_API_PATH = `${LEGACY_NFC_BASE_PATH}/api`;

// ======================
// Public Directory
// ======================

const PUBLIC_DIR = path.join(__dirname, 'public');

const sendIndex = (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
};

// ======================
// Middleware
// ======================

app.set('trust proxy', 1);

// ======================
// CORS
// ======================
// Allow ALL origins
// Allow ALL required HTTP methods
// Allow common request headers
// ======================

app.use(
    cors({
        origin: '*',

        methods: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
            'HEAD'
        ],

        allowedHeaders: [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'Authorization'
        ]
    })
);

// ======================
// CORS Preflight
// ======================

app.options('*', cors());

// ======================
// Body Parsers
// ======================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

// ======================
// Static Files
// ======================

app.use(express.static(PUBLIC_DIR));

app.use(
    BASE_PATH,
    express.static(PUBLIC_DIR)
);

// ======================
// Security
// ======================

app.use(helmet());

// ======================
// Logging
// ======================

app.use(morgan('dev'));

// ======================
// App Routes
// ======================

// Main frontend routes
app.get(
    [
        '/',
        '/index.html',
        BASE_PATH,
        `${BASE_PATH}/`
    ],
    sendIndex
);

// ======================
// Health Check
// ======================

app.get(
    `${BASE_PATH}/health`,
    (req, res) => {
        res.status(200).json({
            success: true,
            message: 'Health check ok',
            basePath: BASE_PATH
        });
    }
);

app.get(
    '/health',
    (req, res) => {
        res.status(200).json({
            success: true,
            message: 'Health check ok'
        });
    }
);

// ======================
// Frontend Config
// ======================

app.get(
    [
        '/config.js',
        `${BASE_PATH}/config.js`
    ],
    (req, res) => {

        res.type('application/javascript').send(
            `window.APP_CONFIG = ${JSON.stringify({
                basePath: BASE_PATH,
                apiBase: API_PATH,
                publicRedirectBase:
                    process.env.PUBLIC_REDIRECT_BASE || ''
            })};`
        );
    }
);

// ======================
// API Root
// ======================

app.get(
    API_PATH,
    (req, res) => {
        res.status(200).json({
            success: true,
            message: 'API route is working successfully',
            basePath: BASE_PATH
        });
    }
);

// ======================
// Legacy API Root
// ======================

app.get(
    LEGACY_API_PATH,
    (req, res) => {
        res.status(200).json({
            success: true,
            message: 'Legacy API route is working successfully'
        });
    }
);

// ======================
// API Routes
// ======================

// Current API
app.use(
    API_PATH,
    Routes
);

// Legacy API
app.use(
    LEGACY_API_PATH,
    Routes
);

// Legacy NFC API
app.use(
    LEGACY_NFC_API_PATH,
    Routes
);

// ======================
// MongoDB Connection
// ======================

mongoose
    .connect(process.env.MONGO_URI)

    .then(async () => {

        console.log('MongoDB Connected');

        console.log(
            `Connected DB: ${mongoose.connection.db.databaseName}`
        );

        // ======================
        // Count Profiles
        // ======================

        try {

            const profileCount =
                await mongoose.connection.db
                    .collection('profiles')
                    .countDocuments();

            console.log(
                `Profiles in DB: ${profileCount}`
            );

        } catch (countErr) {

            console.log(
                'Could not read profiles count:',
                countErr.message
            );
        }

        // ======================
        // Start Server
        // ======================

        app.listen(
            PORT,
            () => {

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    `API mounted at ${API_PATH}`
                );

                console.log(
                    `CORS: All origins allowed`
                );

                console.log(
                    `Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD`
                );
            }
        );

        // ======================
        // KEEP SERVER ALIVE
        // ======================

        setInterval(() => {

            https.get(
                `${APP_BASE_URL}/health`,

                (res) => {

                    console.log(
                        `Self Ping Status: ${res.statusCode}`
                    );
                }

            ).on(
                'error',
                (err) => {

                    console.log(
                        'Self Ping Error:',
                        err.message
                    );
                }
            );

        }, 15 * 60 * 1000);

    })

    .catch((err) => {

        console.log(
            'MongoDB Connection Error'
        );

        console.log(err);

    });

// ======================
// Global Error Handler
// ======================

app.use(
    (err, req, res, next) => {

        console.error(err.stack);

        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
);   