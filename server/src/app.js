'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config');
const requestContext = require('./middleware/requestContext');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Behind Nginx: trust the proxy so req.ip / rate-limit use X-Forwarded-For.
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// Security headers. This is a JSON API (no first-party HTML), so we relax the
// default cross-origin resource policy to allow the SPA on another origin.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// CORS
const allowAll = config.cors.origins.includes('*');
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / non-browser tools (no Origin header).
      if (!origin || allowAll) return cb(null, true);
      if (config.cors.origins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Content-Range', 'Accept-Ranges', 'Content-Length'],
    maxAge: 86400,
  })
);

// Body parsers. NOTE: express.json only parses application/json bodies, so the
// streaming multipart upload route is never buffered here.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(requestContext);

// Light global rate limit (login has its own stricter one).
app.use('/api', apiLimiter);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
