const express = require('express');
const bodyParser = require('body-parser');
const { port } = require('./config');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const insightsRoutes = require('./routes/insights');

const app = express();
app.use(bodyParser.json());

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/insights', insightsRoutes);

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
