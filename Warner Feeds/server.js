const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch'); // For fetching alerts from external APIs

// Create the Express app instance
const app = express();

// Enable Cross-Origin Resource Sharing (CORS) for frontend access
app.use(cors());

// Serve static files (like index.html, CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// Proxy endpoint for fetching alerts from the XMPP API
app.get('/api/xmpp-alerts', async (req, res) => {
  if (req.method === 'GET') {
    try {
      // Fetch the latest alerts from the XMPP API
      const response = await axios.get('https://xmpp-api.onrender.com/all-alerts');
      
      // If successful, send the alerts data as a JSON response
      res.status(200).json(response.data);
    } catch (error) {
      console.error('Error fetching from XMPP API:', error);
      
      // If an error occurs, send a 500 error with an appropriate message
      res.status(500).json({ error: 'Failed to fetch data from XMPP API' });
    }
  } else {
    // If the method is not GET, return a 405 Method Not Allowed error
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
});

// Endpoint for fetching warnings from the weather.gov API
app.get('/api/fetch-warnings', async (req, res) => {
  try {
    const response = await fetch('https://api.weather.gov/alerts/active?area=MI');
    const data = await response.json();
    
    // Filter the warnings as needed (just an example)
    const warnings = data.features.filter(feature =>
      feature.properties.event === "Tornado Warning"
    );

    res.status(200).json(warnings);  // Send filtered warnings as JSON response
  } catch (error) {
    console.error('Error fetching weather warnings:', error);
    res.status(500).json({ error: 'Failed to fetch warnings' });
  }
});

// Serve the main page (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Define the port and start the server
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
