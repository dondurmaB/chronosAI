# Chronos.AI Landing Page

A modern, minimalistic landing page for Chronos.AI with email subscription functionality.

## 🚀 Features

- Beautiful, responsive design with light purple, black, white, and gray color scheme
- Email subscription form with database storage
- SQLite database for storing subscriber emails
- Video demo section (ready for your demo upload)
- Three benefit cards highlighting product value
- Social proof section
- Custom logo design

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 14 or higher)
- npm (comes with Node.js)

## 🛠️ Local Setup Instructions

### 1. Download and Extract Files

Extract all files to a directory of your choice.

### 2. Set Up Project Structure

Your project directory should look like this:

```
chronosai-landing/
├── public/
│   └── index.html          (landing page HTML)
├── server.js               (backend server)
├── package.json            (dependencies)
├── .env                    (environment variables - create this!)
├── .env.example            (template for .env)
├── README.md              (this file)
├── subscribers.db         (will be created automatically)
├── subscribers.json       (will be created automatically)
└── analytics.json         (will be created automatically)
```

**IMPORTANT:** Create a folder called `public` and move the `index.html` file into it!

### 3. Set Up Environment Variables (IMPORTANT!)

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and change the admin token:

```
PORT=3000
ADMIN_TOKEN=your-very-secret-token-here-make-it-long-and-random
```

**🔒 SECURITY:** Generate a strong token:
```bash
# On Mac/Linux:
openssl rand -hex 32

# Or use any random string generator
# Example: kj3h2kjh4k23jh4kj2h3k4jh23k4jh23k4jh23k4jh23k4jh2k3j4h
```

### 4. Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

This will install:
- Express.js (web server)
- SQLite3 (database)
- CORS (cross-origin resource sharing)
- dotenv (environment variables)
- Nodemon (optional, for development)

### 4. Start the Server

**You MUST start the server for the email form to work!**

Run the server:

```bash
npm start
```

You should see:
```
Connected to SQLite database
Subscribers table ready
Server running on http://localhost:3000
```

For development with auto-reload:

```bash
npm run dev
```

### 5. Access the Website

Open your browser and navigate to:
```
http://localhost:3000
```

**Note:** If you just open the HTML file directly (file://), the form won't work because it needs the backend server running.

## 📹 Adding Your Demo Video

To add your demo video:

1. Place your video file in the `public` folder (e.g., `public/demo.mp4`)
2. Open `public/index.html`
3. Find the video section (around line 260):

```html
<div class="video-placeholder">
    📹 Upload your demo video here...
</div>
```

4. Replace it with:

```html
<video autoplay muted loop playsinline>
    <source src="demo.mp4" type="video/mp4">
    Your browser does not support the video tag.
</video>
```

Supported formats: MP4, WebM, OGG

## 💾 Database & Security

The application stores data in multiple places:

1. **SQLite Database** (`subscribers.db`) - Primary database for subscribers and analytics
2. **JSON Files**:
   - `subscribers.json` - Backup/export format for email subscribers
   - `analytics.json` - Website visit statistics

All files are created automatically when you first start the server.

### 🔒 Viewing Subscribers (Admin Only)

**IMPORTANT:** The subscriber list endpoints are now protected and require authentication!

#### Access with Authentication:

You need to include your admin token in the request header. Here are the methods:

**Method 1: Using curl (Command Line)**
```bash
# View database subscribers
curl -H "Authorization: Bearer your-admin-token-here" http://localhost:3000/api/subscribers

# View JSON file
curl -H "Authorization: Bearer your-admin-token-here" http://localhost:3000/api/subscribers/json
```

**Method 2: Using Postman or Insomnia**
1. Open Postman/Insomnia
2. Create a GET request to: `http://localhost:3000/api/subscribers`
3. Add Header:
   - Key: `Authorization`
   - Value: `Bearer your-admin-token-here`
4. Send request

**Method 3: Direct File Access (Easiest)**
Simply open the `subscribers.json` file in your project folder with any text editor. This is the simplest way to view subscribers!

**Method 4: Admin Dashboard (Best Experience!)**
Open your browser to:
```
http://localhost:3000/admin.html
```
Enter your admin token and view everything in a beautiful dashboard!

### 📊 Viewing Analytics (Admin Only)

Track how many people visited your landing page!

**Method 1: Simple Analytics Summary**
```bash
curl -H "Authorization: Bearer your-admin-token" http://localhost:3000/api/analytics
```

Returns:
```json
{
  "totalVisits": 150,
  "uniqueVisitors": 89,
  "visits": [...]
}
```

**Method 2: Detailed Analytics with Daily Breakdown**
```bash
curl -H "Authorization: Bearer your-admin-token" http://localhost:3000/api/analytics/detailed
```

Returns:
```json
{
  "overall": {
    "total": 150,
    "unique": 89
  },
  "byDate": [
    { "date": "2025-10-16", "visitsPerDay": 45, "uniqueVisitors": 32 },
    { "date": "2025-10-15", "visitsPerDay": 38, "uniqueVisitors": 28 }
  ]
}
```

**Method 3: Direct File Access**
Open `analytics.json` in your project folder to see all visit data!

### What Gets Tracked:

For each visit, the system records:
- **Timestamp** - When they visited
- **IP Address** - Unique visitor identification
- **User Agent** - Browser/device information
- **Referrer** - Where they came from (Google, Facebook, direct, etc.)
- **Path** - Which page they visited

**Privacy Note:** Only tracks page visits to the homepage, not API calls or form submissions.

#### Without Token:
If someone tries to access these endpoints without the correct token, they will get:
```json
{
  "error": "Unauthorized. Admin access only."
}
```

### Public Access (Safe):

✅ **Anyone can:** Submit their email via the form  
❌ **No one can:** View the list of subscribers without your admin token  
❌ **No one can:** View analytics without your admin token

### JSON File Format

The `subscribers.json` file looks like this:
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "subscribed_at": "2025-10-16T12:30:45.123Z"
  },
  {
    "id": 2,
    "email": "another@example.com",
    "subscribed_at": "2025-10-16T12:35:22.456Z"
  }
]
```

### Database Schema

**Subscribers Table:**
```sql
CREATE TABLE subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Analytics Table:**
```sql
CREATE TABLE analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip TEXT,
    user_agent TEXT,
    referer TEXT,
    path TEXT
)
```

## 🌐 Deploying to Production

### Option 1: Traditional Web Hosting (Shared Hosting)

Most shared hosting doesn't support Node.js. For these, you'll need to:
1. Use a static site generator or
2. Switch to a hosting provider that supports Node.js (see Option 2)

### Option 2: Cloud Hosting (Recommended)

#### Deploy to Heroku:

1. Install the [Heroku CLI](https://devcli.heroku.com/)
2. Login to Heroku:
   ```bash
   heroku login
   ```
3. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```
4. Add a Procfile to your project root:
   ```
   web: node server.js
   ```
5. Deploy:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

#### Deploy to DigitalOcean App Platform:

1. Push your code to GitHub
2. Go to [DigitalOcean](https://www.digitalocean.com/products/app-platform)
3. Create a new app from your GitHub repository
4. Configure the build command: `npm install`
5. Configure the run command: `npm start`
6. Deploy

#### Deploy to Railway:

1. Go to [Railway.app](https://railway.app/)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js and deploy

#### Deploy to Render:

1. Go to [Render.com](https://render.com/)
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Deploy

### Option 3: VPS (DigitalOcean, Linode, AWS EC2)

1. SSH into your server
2. Install Node.js and npm
3. Clone/upload your project
4. Install dependencies: `npm install`
5. Use PM2 to run the server:
   ```bash
   npm install -g pm2
   pm2 start server.js
   pm2 save
   pm2 startup
   ```
6. Set up Nginx as a reverse proxy
7. Configure SSL with Let's Encrypt

### Environment Variables

For production, set these environment variables on your hosting platform:

```bash
PORT=3000  # Usually auto-set by hosting provider
ADMIN_TOKEN=your-secure-production-token-different-from-dev
```

Most cloud platforms have a UI for setting environment variables. Never hardcode sensitive tokens in your code!

## 🔧 Customization

### Colors

The color scheme uses:
- **Primary Purple**: `#8b5cf6` and `#6d28d9`
- **Background**: Light purple gradient (`#f5f3ff` to white)
- **Text**: Black (`#1a1a1a`) and gray (`#4a5568`)

To change colors, edit the CSS variables in `public/index.html`.

### Logo

The logo is an SVG clock icon with a purple gradient background. To customize:
- Edit the SVG in the header section
- Or replace with your own logo image

### Content

Edit the HTML in `public/index.html` to change:
- Headlines and copy
- Benefit descriptions
- Social proof text
- Footer information

## 📊 Monitoring Subscribers

To export subscribers to CSV or integrate with email services:

1. **View in browser:**
   - Database version: `GET /api/subscribers`
   - JSON file version: `GET /api/subscribers/json`

2. **Access JSON file directly:**
   - Open `subscribers.json` in your project folder
   - Copy/paste into your email marketing platform

3. **Export to CSV:**
   - You can use online JSON to CSV converters
   - Or write a simple script to convert the JSON file

The JSON file is human-readable and easy to import into tools like:
- Mailchimp
- SendGrid
- Google Sheets
- Excel
- Any email marketing platform

## 🔒 Security Considerations

For production:

1. ✅ **Admin token protection** - Already implemented! Subscriber endpoints require authentication
2. **Add rate limiting** to prevent spam submissions
3. **Add CAPTCHA** to the form (Google reCAPTCHA)
4. **Implement email validation/verification** (send confirmation emails)
5. **Use environment variables** for sensitive data (already set up with .env)
6. **Add HTTPS** (SSL certificate - free with Let's Encrypt)
7. **Sanitize user inputs** (basic validation already in place)
8. **Change default admin token** before deploying!

### 🔑 Admin Token Security:

**DO:**
- ✅ Use a long, random string (32+ characters)
- ✅ Store in `.env` file (never commit to git)
- ✅ Use different tokens for development and production
- ✅ Generate with: `openssl rand -hex 32`

**DON'T:**
- ❌ Use simple passwords like "admin123"
- ❌ Commit `.env` file to git
- ❌ Share your token publicly
- ❌ Use the same token as the example

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Kill the process using port 3000
npx kill-port 3000
```

**Database locked:**
```bash
# Remove the database and restart
rm subscribers.db
npm start
```

**Cannot find module:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## 📝 License

Copyright © 2025 Chronos.AI. All rights reserved.

## 🤝 Support

For questions or issues, please contact your development team.

---

Built with ❤️ for busy professionals who deserve better scheduling.# chronosAI
