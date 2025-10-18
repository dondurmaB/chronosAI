const express = require('express');
const { sql } = require('@vercel/postgres');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Admin authentication token (CHANGE THIS!)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-secret-admin-token-change-this';

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get real client IP
function getClientIP(req) {
    // Check various headers that proxies set
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, take the first one (original client)
        return forwarded.split(',')[0].trim();
    }

    // Fallback to other headers
    return req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
}

// Track all page visits (middleware)
app.use(async (req, res, next) => {
    // Only track actual page visits, not API calls or static assets
    if (req.path === '/' || req.path === '/index.html') {
        // Track in JSON file
        await trackVisitor(req);

        // Track in database
        const visitorInfo = {
            ip: getClientIP(req),
            userAgent: req.headers['user-agent'],
            referer: req.headers['referer'] || 'direct',
            path: req.path
        };

        try {
            await sql`
                INSERT INTO analytics (ip, user_agent, referer, path)
                VALUES (${visitorInfo.ip}, ${visitorInfo.userAgent}, ${visitorInfo.referer}, ${visitorInfo.path})
            `;
        } catch (err) {
            console.error('Error saving analytics:', err);
        }
    }
    next();
});

app.use(express.static('public'));

// Middleware to check admin authentication
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token || token !== ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Unauthorized. Admin access only.' });
    }
    
    next();
}

// Path for JSON backup file
const JSON_FILE_PATH = './subscribers.json';

// Initialize JSON file if it doesn't exist
async function initializeJSONFile() {
    try {
        await fs.access(JSON_FILE_PATH);
    } catch {
        // File doesn't exist, create it with empty array
        await fs.writeFile(JSON_FILE_PATH, JSON.stringify([], null, 2));
        console.log('Created subscribers.json file');
    }
}

// Initialize analytics JSON file
async function initializeAnalyticsFile() {
    try {
        await fs.access('./analytics.json');
    } catch {
        // File doesn't exist, create it with initial data
        const initialData = {
            totalVisits: 0,
            uniqueVisitors: 0,
            visits: []
        };
        await fs.writeFile('./analytics.json', JSON.stringify(initialData, null, 2));
        console.log('Created analytics.json file');
    }
}

// Track visitor
async function trackVisitor(req) {
    try {
        const data = await fs.readFile('./analytics.json', 'utf8');
        const analytics = JSON.parse(data);

        const visitorInfo = {
            timestamp: new Date().toISOString(),
            ip: getClientIP(req),
            userAgent: req.headers['user-agent'],
            referer: req.headers['referer'] || 'direct',
            path: req.path
        };

        analytics.totalVisits++;
        analytics.visits.push(visitorInfo);

        // Count unique visitors by IP (simple approach)
        const uniqueIPs = new Set(analytics.visits.map(v => v.ip));
        analytics.uniqueVisitors = uniqueIPs.size;

        await fs.writeFile('./analytics.json', JSON.stringify(analytics, null, 2));
    } catch (error) {
        console.error('Error tracking visitor:', error);
    }
}

// Save email to JSON file
async function saveToJSON(email, id) {
    try {
        // Read existing data
        const data = await fs.readFile(JSON_FILE_PATH, 'utf8');
        const subscribers = JSON.parse(data);
        
        // Add new subscriber
        subscribers.push({
            id: id,
            email: email,
            subscribed_at: new Date().toISOString()
        });
        
        // Write back to file
        await fs.writeFile(JSON_FILE_PATH, JSON.stringify(subscribers, null, 2));
        console.log(`Email saved to JSON: ${email}`);
    } catch (error) {
        console.error('Error saving to JSON file:', error);
    }
}

// Initialize Postgres database tables
async function initializeDatabase() {
    try {
        // Initialize JSON files
        await initializeJSONFile();
        await initializeAnalyticsFile();

        // Create subscribers table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        console.log('Subscribers table ready');

        // Create analytics table
        await sql`
            CREATE TABLE IF NOT EXISTS analytics (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip TEXT,
                user_agent TEXT,
                referer TEXT,
                path TEXT
            )
        `;
        console.log('Analytics table ready');
        console.log('Connected to Postgres database');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

// Initialize database on startup
initializeDatabase();

// API endpoint to handle email subscriptions
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    try {
        // Insert email into database
        const result = await sql`
            INSERT INTO subscribers (email)
            VALUES (${email})
            RETURNING id
        `;

        const subscriberId = result.rows[0].id;
        console.log(`New subscriber: ${email} (ID: ${subscriberId})`);

        // Also save to JSON file
        await saveToJSON(email, subscriberId);

        res.status(200).json({
            success: true,
            message: 'Successfully subscribed',
            id: subscriberId
        });
    } catch (err) {
        if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
            return res.status(409).json({ error: 'This email is already registered' });
        }
        console.error('Database error:', err);
        console.error('Error details:', err.message, err.code);
        return res.status(500).json({ error: 'Failed to save email', details: err.message });
    }
});

// API endpoint to get all subscribers (admin use only - PROTECTED)
app.get('/api/subscribers', requireAuth, async (req, res) => {
    try {
        const result = await sql`
            SELECT id, email, subscribed_at
            FROM subscribers
            ORDER BY subscribed_at DESC
        `;
        res.status(200).json({ subscribers: result.rows });
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
});

// API endpoint to get JSON file content (admin use only - PROTECTED)
app.get('/api/subscribers/json', requireAuth, async (req, res) => {
    try {
        const data = await fs.readFile(JSON_FILE_PATH, 'utf8');
        const subscribers = JSON.parse(data);
        res.status(200).json({ subscribers: subscribers });
    } catch (error) {
        console.error('Error reading JSON file:', error);
        res.status(500).json({ error: 'Failed to read JSON file' });
    }
});

// API endpoint to get analytics (admin use only - PROTECTED)
app.get('/api/analytics', requireAuth, async (req, res) => {
    try {
        // Get analytics from database
        const totalVisitsResult = await sql`
            SELECT COUNT(*) as total FROM analytics
        `;

        const uniqueVisitorsResult = await sql`
            SELECT COUNT(DISTINCT ip) as unique_visitors FROM analytics
        `;

        const analytics = {
            totalVisits: Number(totalVisitsResult.rows[0]?.total) || 0,
            uniqueVisitors: Number(uniqueVisitorsResult.rows[0]?.unique_visitors) || 0,
            visits: [] // Legacy field for compatibility
        };

        res.status(200).json(analytics);
    } catch (error) {
        console.error('Error reading analytics:', error);
        res.status(500).json({ error: 'Failed to read analytics' });
    }
});

// API endpoint to get detailed analytics from database (admin use only - PROTECTED)
app.get('/api/analytics/detailed', requireAuth, async (req, res) => {
    try {
        // Get stats by date
        const byDate = await sql`
            SELECT
                COUNT(*) as total_visits,
                COUNT(DISTINCT ip) as unique_visitors,
                DATE(timestamp) as date,
                COUNT(*) as visits_per_day
            FROM analytics
            GROUP BY DATE(timestamp)
            ORDER BY DATE(timestamp) DESC
        `;

        // Get overall stats
        const overallResult = await sql`
            SELECT
                COUNT(*) as total,
                COUNT(DISTINCT ip) as unique_visitors
            FROM analytics
        `;

        const overall = {
            total: Number(overallResult.rows[0]?.total) || 0,
            uniqueVisitors: Number(overallResult.rows[0]?.unique_visitors) || 0
        };

        // Transform snake_case to camelCase for frontend
        const byDateFormatted = byDate.rows.map(row => ({
            date: row.date,
            totalVisits: Number(row.total_visits),
            uniqueVisitors: Number(row.unique_visitors),
            visitsPerDay: Number(row.visits_per_day)
        }));

        res.status(200).json({
            overall: overall,
            byDate: byDateFormatted
        });
    } catch (err) {
        console.error('Database error:', err);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        return res.status(500).json({ error: 'Failed to fetch detailed analytics', details: err.message });
    }
});

// Serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the admin page
app.get('/admn.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admn.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});