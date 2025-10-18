const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

// Track all page visits (middleware)
app.use(async (req, res, next) => {
    // Only track actual page visits, not API calls or static assets
    if (req.path === '/' || req.path === '/index.html') {
        // Track in JSON file
        await trackVisitor(req);
        
        // Track in database
        const visitorInfo = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers['referer'] || 'direct',
            path: req.path
        };
        
        db.run(
            'INSERT INTO analytics (ip, user_agent, referer, path) VALUES (?, ?, ?, ?)',
            [visitorInfo.ip, visitorInfo.userAgent, visitorInfo.referer, visitorInfo.path],
            (err) => {
                if (err) console.error('Error saving analytics:', err);
            }
        );
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
            ip: req.ip || req.connection.remoteAddress,
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

// Initialize SQLite database
const db = new sqlite3.Database('./subscribers.db', async (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        
        // Initialize JSON file
        await initializeJSONFile();
        
        // Initialize analytics file
        await initializeAnalyticsFile();
        
        // Create subscribers table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('Subscribers table ready');
            }
        });
        
        // Create analytics table
        db.run(`
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip TEXT,
                user_agent TEXT,
                referer TEXT,
                path TEXT
            )
        `, (err) => {
            if (err) {
                console.error('Error creating analytics table:', err);
            } else {
                console.log('Analytics table ready');
            }
        });
    }
});

// API endpoint to handle email subscriptions
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    // Insert email into database
    const query = 'INSERT INTO subscribers (email) VALUES (?)';
    
    db.run(query, [email], async function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'This email is already registered' });
            }
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save email' });
        }

        const subscriberId = this.lastID;
        console.log(`New subscriber: ${email} (ID: ${subscriberId})`);
        
        // Also save to JSON file
        await saveToJSON(email, subscriberId);
        
        res.status(200).json({ 
            success: true, 
            message: 'Successfully subscribed',
            id: subscriberId 
        });
    });
});

// API endpoint to get all subscribers (admin use only - PROTECTED)
app.get('/api/subscribers', requireAuth, (req, res) => {
    const query = 'SELECT id, email, subscribed_at FROM subscribers ORDER BY subscribed_at DESC';
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch subscribers' });
        }
        res.status(200).json({ subscribers: rows });
    });
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
        // Get data from JSON file
        const data = await fs.readFile('./analytics.json', 'utf8');
        const analytics = JSON.parse(data);
        
        // Get total unique visitors from database
        db.get('SELECT COUNT(DISTINCT ip) as uniqueVisitors FROM analytics', [], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch analytics' });
            }
            
            analytics.uniqueVisitors = row.uniqueVisitors;
            res.status(200).json(analytics);
        });
    } catch (error) {
        console.error('Error reading analytics:', error);
        res.status(500).json({ error: 'Failed to read analytics' });
    }
});

// API endpoint to get detailed analytics from database (admin use only - PROTECTED)
app.get('/api/analytics/detailed', requireAuth, (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as totalVisits,
            COUNT(DISTINCT ip) as uniqueVisitors,
            DATE(timestamp) as date,
            COUNT(*) as visitsPerDay
        FROM analytics
        GROUP BY DATE(timestamp)
        ORDER BY timestamp DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch detailed analytics' });
        }
        
        // Also get overall stats
        db.get('SELECT COUNT(*) as total, COUNT(DISTINCT ip) as unique FROM analytics', [], (err2, overall) => {
            if (err2) {
                console.error('Database error:', err2);
                return res.status(500).json({ error: 'Failed to fetch overall stats' });
            }
            
            res.status(200).json({
                overall: overall,
                byDate: rows
            });
        });
    });
});

// Serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});