// privateserver.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Simple proxy to XMPP alerts API
app.get('/local-xmpp', async (req, res) => {
  try {
    const response = await axios.get('https://xmpp-api.onrender.com/all-alerts');
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error proxying XMPP API:', error);
    res.status(500).json({ error: 'Proxy server failed to fetch XMPP alerts' });
  }
});

const PORT = 3300;
app.listen(PORT, () => {
  console.log(`🔐 XMPP proxy server running at http://localhost:${PORT}/local-xmpp`);
});
