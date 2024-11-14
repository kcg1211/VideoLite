// backend/index.js
require('http').maxHeaderSize = 65536;
require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const cors = require('cors');

const app = express();

// Import routes
const apiRoute = require('./routes/api');

// Use environment variables for configuration
const PORT = 8000;
const clientOrigin = process.env.CLIENT_ORIGIN

// Middleware
app.use(cookieParser());
app.use(fileUpload());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));


// CORS Configuration
app.use(cors({
   origin: clientOrigin || 'http://localhost:3000',  // Ensure origin matches the frontend
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
   credentials: true,
   preflightContinue: false,  // Let express handle OPTIONS preflight requests automatically
}));

// Add a route for the root URL
app.get('/', (req, res) => {
   res.send('Video compression backend!'); // Send a simple text response
});

// API Routes
app.use('/api', apiRoute);

// Start server
app.listen(PORT, () => {
   console.log(`Server running at port ${PORT}`);
});