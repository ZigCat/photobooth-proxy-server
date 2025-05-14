require('dotenv').config();
const express = require('express');
const proxy = require('express-http-proxy');
const axios = require('axios');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// API key check
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.query.proxy_key || req.headers['x-proxy-key'];
  const validApiKey = process.env.PROXY_API_KEY;

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
};

// Simple health check
app.get('/', (req, res) => {
  res.send('Прокси-сервер работает!');
});

app.use(
  '/api',
  apiKeyAuth,
  proxy(process.env.BASE_URL, {
    proxyReqPathResolver: (req) => {
      const path = req.originalUrl.replace(/^\/api/, '');
      const queryParams = new URLSearchParams(req.query);
      queryParams.set('api_key', process.env.SMARTVEND_API_KEY);
      const fullPath = `${path}?${queryParams.toString()}`;
      console.log('Proxying to:', `${process.env.BASE_URL}${fullPath}`);
      return fullPath;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers = { ...srcReq.headers };
      delete proxyReqOpts.headers.host;
      delete proxyReqOpts.headers.connection;
      delete proxyReqOpts.headers['x-proxy-key'];
      delete proxyReqOpts.headers.proxy_key;
        const noBody =
            !srcReq.body ||
            typeof srcReq.body !== 'object' ||
            Object.keys(srcReq.body).length === 0;

        if (noBody) {
            delete proxyReqOpts.headers['content-type'];
            delete proxyReqOpts.headers['content-length'];
        }

        return proxyReqOpts;
    },
    proxyReqBodyDecorator: (bodyContent, srcReq) => {
      if (
        ['POST', 'PUT', 'PATCH'].includes(srcReq.method) &&
        srcReq.body &&
        typeof srcReq.body === 'object' &&
        Object.keys(srcReq.body).length > 0
      ) {
        console.log('Sending request body:', srcReq.body);
        return JSON.stringify(srcReq.body);
      } else {
        console.log('Empty or no request body, skipping body send');
        return '';
      }
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      console.log('Response from target server:', {
        status: proxyRes.statusCode,
        data: proxyResData.toString(),
      });
      userRes.status(proxyRes.statusCode);
      return proxyResData;
    },
  })
);

app.listen(PORT, () => {
  console.log(`Прокси-сервер запущен на порту ${PORT}`);
  console.log(`Для проверки откройте: http://localhost:${PORT}`);
  console.log(`Для отправки запросов используйте: http://localhost:${PORT}/api/...`);
});
