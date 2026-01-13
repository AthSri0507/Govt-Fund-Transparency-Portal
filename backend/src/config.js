const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 4000,
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'gov_user',
    password: process.env.MYSQL_PASSWORD || 'changeme',
    database: process.env.MYSQL_DATABASE || 'gov_projects_app'
  },
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gov_feedback_app',
  jwt: {
    secret: process.env.JWT_SECRET || 'replace_with_strong_secret',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d'
  }
};
