
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
// ENV VALIDATION
// ======================

const requiredEnvVars = [
    'MONGO_URI',
    'JWT_SECRET'
];

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
// APP SETUP
// ======================

const app = express();

const PORT = process.env.PORT || 3000;

// ======================
// BASE PATH HELPERS
// ======================

const normalizeBasePath = (value = '/tbc_connect') => {

    const pathValue =
        String(value || '/tbc_connect').trim() || '/tbc_connect';

    const withLeadingSlash =
        pathValue.startsWith('/')
            ? pathValue
            : `/${pathValue}`;

    return withLeadingSlash.replace(/\/+$/, '');
};

const BASE_PATH = normalizeBasePath(
    process.env.BASE_PATH ||
    process.env.APP_BASE_PATH
);

const APP_BASE_URL =
    process.env.APP_BASE_URL ||
    `http://localhost:${PORT}${BASE_PATH}`;

const LEGACY_BASE_PATH = '/tbc';

const LEGACY_NFC_BASE_PATH = '/nfc';

const API_PATH = `${BASE_PATH}/api`;

const LEGACY_API_PATH = `${LEGACY_BASE_PATH}/api`;

const LEGACY_NFC_API_PATH = `${LEGACY_NFC_BASE_PATH}/api`;

const PUBLIC_DIR = path.join(__dirname, 'public');

const sendIndex = (req, res) => {
    res.sendFile(
        path.join(PUBLIC_DIR, 'index.html')
    );
};

// ======================
// TRUST PROXY
// ======================

app.set('trust proxy', 1);

// ======================
// CORS CONFIG
// ======================

const allowedOrigins = [

    'https://www.technovahub.in',

    'http://localhost:3000',

    'http://localhost:5173',

    // Add deployment frontend URLs here
    // 'https://yourapp.vercel.app',
    // 'https://yourapp.netlify.app',
];

const corsOptions = {

    origin: function (origin, callback) {

        // Allow requests without origin
        // Postman / Mobile apps / Curl

        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.log('Blocked by CORS:', origin);

        return callback(
            new Error('Not allowed by CORS')
        );
    },

    credentials: true,

    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ]
};

// Apply CORS globally
app.use(cors(corsOptions));

// ======================
// MIDDLEWARE
// ======================

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(PUBLIC_DIR));

app.use(
    BASE_PATH,
    express.static(PUBLIC_DIR)
);

// ======================
// SECURITY & LOGGING
// ======================

app.use(helmet());

app.use(morgan('dev'));

// ======================
// APP ROUTES
// ======================

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
// HEALTH CHECK
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

app.get('/health', (req, res) => {

    res.status(200).json({
        success: true,
        message: 'Health check ok'
    });
});

// ======================
// CONFIG ROUTE
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
                    process.env.PUBLIC_REDIRECT_BASE || '',

            })};`
        );
    }
);

// ======================
// API ROOT
// ======================

app.get(API_PATH, (req, res) => {

    res.status(200).json({

        success: true,

        message: 'API route is working successfully',

        basePath: BASE_PATH
    });
});

// ======================
// LEGACY API SUPPORT
// ======================

app.get(
    LEGACY_API_PATH,
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                'Legacy API route is working successfully'
        });
    }
);

// ======================
// API ROUTES
// ======================

app.use(API_PATH, Routes);

app.use(LEGACY_API_PATH, Routes);

app.use(LEGACY_NFC_API_PATH, Routes);

// ======================
// MONGODB CONNECTION
// ======================

mongoose
    .connect(process.env.MONGO_URI)

    .then(async () => {

        console.log('MongoDB Connected');

        console.log(
            `Connected DB: ${mongoose.connection.db.databaseName}`
        );

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
        // START SERVER
        // ======================

        app.listen(PORT, () => {

            console.log(
                `Server running on port ${PORT}`
            );

            console.log(
                `API mounted at ${API_PATH}`
            );
        });

        // ======================
        // KEEP SERVER ALIVE
        // ======================

        setInterval(() => {

            https
                .get(
                    `${APP_BASE_URL}/health`,
                    (res) => {

                        console.log(
                            `Self Ping Status: ${res.statusCode}`
                        );
                    }
                )

                .on('error', (err) => {

                    console.log(
                        'Self Ping Error:',
                        err.message
                    );
                });

        }, 15 * 60 * 1000);
    })

    .catch((err) => {

        console.log(
            'MongoDB Connection Error'
        );

        console.log(err);
    });

// ======================
// GLOBAL ERROR HANDLER
// ======================

app.use((err, req, res, next) => {

    console.error(err.stack);

    // Handle CORS Errors

    if (
        err.message === 'Not allowed by CORS'
    ) {

        return res.status(403).json({

            success: false,

            message:
                'CORS Error: Origin not allowed'
        });
    }

    res.status(500).json({

        success: false,

        message: 'Internal Server Error'
    });

});

