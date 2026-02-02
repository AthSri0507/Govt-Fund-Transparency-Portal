const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { port } = require('./config');
const authRoutes = require('./routes/auth');
const biometricRoutes = require('./routes/biometric');
const projectRoutes = require('./routes/projects');
const insightsRoutes = require('./routes/insights');
const adminRoutes = require('./routes/admin');
const projectRequestRoutes = require('./routes/projectRequests');
const galleryRoutes = require('./routes/gallery');

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(bodyParser.json());

// Serve static files for gallery uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/auth', biometricRoutes); // Biometric routes under /api/auth
app.use('/api/projects', projectRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/project-requests', projectRequestRoutes);
app.use('/api', galleryRoutes); // Gallery routes for project images

app.get('/', (req, res) => res.json({ message: 'Gov Project Fund Monitoring API' }));

// Global error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Export app for testing; only start server when run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
}

module.exports = app;
