const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

const PI_API_BASE = 'api.minepi.com';
const PI_API_KEY = process.env.PI_NETWORK_API_KEY;

if (!PI_API_KEY) {
  console.error('FATAL: PI_NETWORK_API_KEY environment variable is not set.');
  console.error('Set it before starting the server, e.g. in a .env file or shell.');
  process.exit(1);
}

function piApiCall(method, path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: PI_API_BASE,
      path,
      method,
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

app.post('/api/payments/approve', async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const result = await piApiCall('POST', `/v2/payments/${paymentId}/approve`);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/complete', async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const result = await piApiCall('POST', `/v2/payments/${paymentId}/complete`);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Complete error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Pi payment server running on port ${PORT}`);
});
