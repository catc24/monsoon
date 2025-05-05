import { client, xml } from '@xmpp/client';
import WebSocket from 'ws';
import express from 'express';
import dotenv from 'dotenv';
import xml2js from 'xml2js';
import he from 'he';

dotenv.config();

const XMPP_USERNAME = process.env.XMPP_USERNAME || 'ryder.moesta';
const XMPP_PASSWORD = process.env.XMPP_PASSWORD || 'n5_7ctVaOosHZ6s';
const XMPP_SERVER   = 'nwws-oi.weather.gov';
const ROOM_JID      = 'nwws@conference.nwws-oi.weather.gov';

const wsPort   = 8080;
const httpPort = 3000;

// Replace your `let allAlerts = [];` with:
const alertMap = new Map();  // Map<VTECcore, feature>
const MAX_ALERTS = 2000;

// HTTP API now serves Map.values()



// ————— HTTP API —————
const app = express();
app.use(express.static('public')); // Add this to serve static files from a 'public' directory
app.get('/all-alerts', (req, res) => {
  res.json(Array.from(alertMap.values()));
});
app.listen(httpPort, () => {
  console.log(`HTTP ▶ http://localhost:${httpPort}/all-alerts`);
});

// ————— WebSocket —————
const wss = new WebSocket.Server({ port: wsPort });
wss.on('connection', ws => {
  console.log('WebSocket client connected');
  // Send all existing alerts to new clients
  for (const feature of alertMap.values()) {
    ws.send(JSON.stringify(feature));
  }
  
  ws.on('close', () => console.log('WebSocket client disconnected'));
});
// ————— Broadcast (no duplicates, single shot) —————
function broadcastAlert(alert) {
  const msg = JSON.stringify(alert);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}




// ————— XMPP Setup —————
const xmpp = client({
  service: `xmpp://${XMPP_SERVER}`,
  domain:  'weather.gov',
  username: XMPP_USERNAME,
  password: XMPP_PASSWORD,
});
xmpp.on('error', err => console.error('XMPP Error:', err));
xmpp.on('online', async addr => {
  console.log(`XMPP Online as ${addr}`);
  // join the room
  xmpp.send(
    xml('presence', { to: `${ROOM_JID}/${XMPP_USERNAME}` },
      xml('x', { xmlns: 'http://jabber.org/protocol/muc' })
    )
  );
});

// ————— Helpers —————
// Given the raw stanza string, extract the inner text of <x xmlns="nwws-oi">…</x>
function extractEscapedCapFragment(stanzaStr) {
  const m = stanzaStr.match(
    /<x\s+xmlns="nwws-oi"[^>]*>([\s\S]*?)<\/x>/
  );
  return m ? m[1].trim() : null;
}

function getVTECCore(vtec) {
  const parts = vtec.split('.');
  // want office, phenomenon, significance, event-tracking number
  return parts.length >= 6
    ? `${parts[2]}.${parts[3]}.${parts[4]}.${parts[5]}`
    : vtec;
}


async function unescapeAndParseXML(xmppMessage) {
  if (!xmppMessage || xmppMessage.trim() === '') {
    return [];
  }

  const unescaped = he.decode(xmppMessage);
  
  // Clean up non-XML content at the beginning
  let cleanedXml = unescaped;
  
  // Remove AWIPS headers and any numerical prefixes
  const capXmlStart = cleanedXml.indexOf('<?xml');
  if (capXmlStart > 0) {
    cleanedXml = cleanedXml.substring(capXmlStart);
  }

  try {
    // First try to parse as a complete XML document
    const result = await xml2js.parseStringPromise(cleanedXml, {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [name => name.replace(/^.*:/, '')]
    });
    
    // If we have a valid alert object, return it as a single-item array
    if (result && result.alert) {
      return [result.alert];
    }
    
    // If that fails, try to extract individual alert blocks
    const alertRegex = /<alert[\s\S]*?<\/alert>/g;
    const matches = unescaped.match(alertRegex);
    
    if (!matches) {
      return [];
    }
    
    const alerts = [];
    for (const capXml of matches) {
      try {
        // Add a simple XML declaration if not present
        const xmlString = capXml.includes('<?xml') ? capXml : `<?xml version="1.0" encoding="UTF-8"?>${capXml}`;
        
        const parsed = await xml2js.parseStringPromise(xmlString, {
          explicitArray: false,
          mergeAttrs: true,
          tagNameProcessors: [name => name.replace(/^.*:/, '')]
        });
        alerts.push(parsed.alert);
      } catch (err) {
        // Don't log parsing errors for invalid alerts
      }
    }
    
    return alerts;
  } catch (err) {
    // Extract just the <alert> tags
    const alertRegex = /<alert[\s\S]*?<\/alert>/g;
    const matches = unescaped.match(alertRegex);
    
    if (!matches) {
      return [];
    }
    
    const alerts = [];
    for (const capXml of matches) {
      try {
        // Add a simple XML declaration if not present
        const xmlString = capXml.includes('<?xml') ? capXml : `<?xml version="1.0" encoding="UTF-8"?>${capXml}`;
        
        const parsed = await xml2js.parseStringPromise(xmlString, {
          explicitArray: false,
          mergeAttrs: true,
          tagNameProcessors: [name => name.replace(/^.*:/, '')]
        });
        alerts.push(parsed.alert);
      } catch (err) {
        // Don't log parsing errors for invalid alerts
      }
    }
    
    return alerts;
  }
}



function isExpired(feature) {
  if (!feature?.properties?.expires) return false;
  
  const expires = new Date(feature.properties.expires);
  const now = new Date();
  return expires < now;
}

  
// New function to extract alert details
// Update the extractAlertDetails function to include tornadoDetection
function extractAlertDetails(alert) {
  if (!alert || !alert.info) return null;

  const info = Array.isArray(alert.info) ? alert.info[0] : alert.info;
  if (!info) return null;

  const parameters = Array.isArray(info.parameter) ? info.parameter : (info.parameter ? [info.parameter] : []);
  
  const getParam = (name) => {
    const param = parameters.find(p => p?.valueName === name);
    return param ? param.value : null;
  };

  return {
    identifier: alert.identifier,
    messageType: alert.msgType,
    sent: alert.sent,
    event: info.event,
    urgency: info.urgency,
    severity: info.severity,
    certainty: info.certainty,
    areaDesc: info.area?.areaDesc || null,
    vtec: getParam('VTEC'),
    tornadoDamageThreat: getParam('tornadoDamageThreat'),
    tornadoDetection: getParam('tornadoDetection'),
    thunderstormDamageThreat: getParam('thunderstormDamageThreat'),
  };
}

// ————— Better polygon diff (normalize + epsilon) —————
function polygonsAreEqual(oldPolygon, newPolygon) {
  if (!oldPolygon || !newPolygon) return false;

  // rotate so smallest-x point is first
  const normalize = poly => {
    const minPt = poly.reduce((m, p) => p[0] < m[0] ? p : m, poly[0]);
    const i     = poly.indexOf(minPt);
    return [...poly.slice(i), ...poly.slice(0, i)];
  };

  oldPolygon = normalize(oldPolygon);
  newPolygon = normalize(newPolygon);

  if (oldPolygon.length !== newPolygon.length) return false;

  const eps = 1e-6;
  for (let i = 0; i < oldPolygon.length; i++) {
    const [x1, y1] = oldPolygon[i];
    const [x2, y2] = newPolygon[i];
    if (Math.abs(x1 - x2) > eps || Math.abs(y1 - y2) > eps) {
      return false;
    }
  }
  return true;
}



// Decode entities and parse a CAP XML fragment into a JS object
async function parseCapXml(escapedFragment) {
  if (!escapedFragment) return null;
  
  const decoded = he.decode(escapedFragment);
  try {
    // parseStringPromise returns { alert: { … } }
    return await xml2js.parseStringPromise(decoded);
  } catch (err) {
    return null;
  }
}

// Pull out the polygon coords from the parsed CAP
function extractPolygon(infoNode) {
  if (!infoNode || !infoNode.area) return null;
  
  // Handle both array and direct object formats
  const area = Array.isArray(infoNode.area) ? infoNode.area[0] : infoNode.area;
  if (!area) return null;
  
  // Handle both array and string formats for polygon
  const polyText = Array.isArray(area.polygon) ? area.polygon[0] : area.polygon;
  if (!polyText) return null;
  
  try {
    return polyText
      .split(' ')
      .map(pair => pair.split(',').map(Number));
  } catch (err) {
    return null;
  }
}

// Convert the CAP object into your desired GeoJSON+LD format
function capToGeoJson(capObj) {
  if (!capObj || !capObj.alert) return null;

  try {
    const a = capObj.alert;
    
    // Handle both array and direct object formats for info
    const info = Array.isArray(a.info) ? a.info[0] : a.info;
    if (!info) return null;
    
    // Try to extract polygon, if available
    const polygon = extractPolygon(info);

    // Handle identifier in both array and direct string formats
    const identifier = Array.isArray(a.identifier) ? a.identifier[0] : a.identifier;
    if (!identifier) return null;

    const feature = {
      id: `urn:oid:${identifier}`,
      type: 'Feature',
      geometry: polygon ? { type: 'Polygon', coordinates: [polygon] } : null, // Only include geometry if polygon exists
      properties: {
        '@id': `urn:oid:${identifier}`,
        '@type': 'wx:Alert',
        id: `urn:oid:${identifier}`,
        areaDesc: Array.isArray(info.areaDesc) ? info.areaDesc[0] : (info.area?.areaDesc || ''),
        geocode: {
          SAME: extractGeocodeSAME(info),
          UGC: extractGeocodeUGC(info),
        },
        affectedZones: [], // can fill if you have a mapping
        sent: Array.isArray(a.sent) ? a.sent[0] : a.sent,
        effective: Array.isArray(info.effective) ? info.effective[0] : 
                  (info.effective || (Array.isArray(a.sent) ? a.sent[0] : a.sent) || null),
        expires: Array.isArray(info.expires) ? info.expires[0] : (info.expires || null),
        status: Array.isArray(a.status) ? a.status[0] : a.status,
        messageType: Array.isArray(a.msgType) ? a.msgType[0] : a.msgType,
        category: Array.isArray(info.category) ? info.category[0] : info.category,
        severity: Array.isArray(info.severity) ? info.severity[0] : info.severity,
        certainty: Array.isArray(info.certainty) ? info.certainty[0] : info.certainty,
        urgency: Array.isArray(info.urgency) ? info.urgency[0] : info.urgency,
        event: Array.isArray(info.event) ? info.event[0] : info.event,
        sender: Array.isArray(a.sender) ? a.sender[0] : a.sender,
        senderName: Array.isArray(info.senderName) ? info.senderName[0] : info.senderName,
        headline: Array.isArray(info.headline) ? info.headline[0] : info.headline,
        description: Array.isArray(info.description) ? info.description[0] : info.description,
        instruction: Array.isArray(info.instruction) ? info.instruction[0] : info.instruction,
        response: Array.isArray(info.responseType) ? info.responseType[0] : info.responseType,
        parameters: extractParameters(info)
      }
    };

    // If there's no geometry, remove the geometry field
    if (!feature.geometry) {
      delete feature.geometry;
    }

    return feature;
  } catch (err) {
    return null;
  }
}


// Helper functions to extract geocodes and parameters
function extractGeocodeSAME(info) {
  try {
    if (!info.geocode && !info.area?.geocode) return [];
    
    // Handle new format (direct object)
    if (info.area?.geocode) {
      const geocodes = Array.isArray(info.area.geocode) ? info.area.geocode : [info.area.geocode];
      return geocodes
        .filter(g => g && g.valueName === 'SAME')
        .map(g => g.value);
    }
    
    // Handle old format (arrays)
    const geocodes = Array.isArray(info.geocode) ? info.geocode : [info.geocode];
    return geocodes
      .filter(g => g && Array.isArray(g.valueName) ? g.valueName[0] === 'SAME' : g.valueName === 'SAME')
      .map(g => Array.isArray(g.value) ? g.value[0] : g.value);
  } catch (err) {
    return [];
  }
}

function extractGeocodeUGC(info) {
  try {
    if (!info.geocode && !info.area?.geocode) return [];
    
    // Handle new format (direct object)
    if (info.area?.geocode) {
      const geocodes = Array.isArray(info.area.geocode) ? info.area.geocode : [info.area.geocode];
      return geocodes
        .filter(g => g && g.valueName === 'UGC')
        .map(g => g.value);
    }
    
    // Handle old format (arrays)
    const geocodes = Array.isArray(info.geocode) ? info.geocode : [info.geocode];
    return geocodes
      .filter(g => g && Array.isArray(g.valueName) ? g.valueName[0] === 'UGC' : g.valueName === 'UGC')
      .map(g => Array.isArray(g.value) ? g.value[0] : g.value);
  } catch (err) {
    return [];
  }
}

function extractParameters(info) {
  try {
    if (!info.parameter) return {};
    
    const parameters = Array.isArray(info.parameter) ? info.parameter : [info.parameter];
    
    return parameters.reduce((acc, p) => {
      if (!p) return acc;
      
      const name = Array.isArray(p.valueName) ? p.valueName[0] : p.valueName;
      const value = Array.isArray(p.value) ? p.value[0] : p.value;
      
      if (!name) return acc;
      
      acc[name] = acc[name] || [];
      acc[name].push(value);
      return acc;
    }, {});
  } catch (err) {
    return {};
  }
}

setInterval(() => {
  for (const [core, feature] of alertMap.entries()) {
    if (isExpired(feature)) {
      alertMap.delete(core);
      console.log(`Pruned expired alert ${feature.id}`);
      broadcastAlert({ type: 'alert-canceled', id: feature.id });
    }
  }
}, 5000);

function addAlert(feature) {
  if (!feature?.properties) return;

  const id    = feature.id;
  const vtecs = feature.properties.parameters?.VTEC || [];
  const keys  = vtecs.length ? vtecs.map(getVTECCore) : [id];

  console.log('VTEC codes:', vtecs);
  console.log('Generated keys:', keys);

  let shouldBroadcast = false;

  // 1) Handle CANCEL messages (this includes handling CAN in VTEC even if messageType is 'alert')
  if (feature.properties.messageType === 'Cancel' || vtecs.some(vtec => vtec.includes('CAN'))) {
    keys.forEach(key => {
      if (alertMap.has(key)) {
        const old = alertMap.get(key);
        alertMap.delete(key);
        console.log(`Canceled ${old.id} via VTEC ${key}`);
        shouldBroadcast = true;
      }
    });
    if (shouldBroadcast) broadcastAlert({ type: 'alert-canceled', id });
    return;
  }

  // 2) Skip if already expired
  if (isExpired(feature)) {
    console.log(`Skipping expired ${id}`);
    return;
  }

  // 3) Handle additions and updates (including CONs)
  keys.forEach(key => {
    const existing = alertMap.get(key);
    if (existing) {
      const oldPoly = existing?.geometry?.coordinates?.[0];
      const newPoly = feature?.geometry?.coordinates?.[0];

      const polygonChanged = JSON.stringify(oldPoly) !== JSON.stringify(newPoly);
      const statusChanged = JSON.stringify(existing.properties) !== JSON.stringify(feature.properties);

      if (polygonChanged || statusChanged) {
        alertMap.set(key, feature);
        console.log(`Updated alert ${key} (polygonChanged=${polygonChanged}, statusChanged=${statusChanged})`);
        shouldBroadcast = true;
      } else {
        console.log(`Skipped unchanged alert ${key}`);
      }
    } else {
      alertMap.set(key, feature);
      console.log(`Added new alert ${key}`);
      shouldBroadcast = true;
    }
  });

  if (shouldBroadcast) broadcastAlert(feature);

  // 4) Evict oldest alert if we exceed the maximum size
  if (alertMap.size > MAX_ALERTS) {
    let oldestKey  = null;
    let oldestTime = Infinity;
    for (const [key, feat] of alertMap) {
      const expires = new Date(feat.properties.expires).valueOf();
      if (expires < oldestTime) {
        oldestTime = expires;
        oldestKey  = key;
      }
    }
    if (oldestKey) {
      alertMap.delete(oldestKey);
      console.log(`Evicted oldest alert (${oldestKey})`);
    }
  }
}

// ————— Main stanza handler —————
xmpp.on('stanza', async stanza => {
  if (!stanza.is('message')) return;

  const raw = stanza.toString();
  const frag = extractEscapedCapFragment(raw);
  if (!frag) return;

  const alerts = await unescapeAndParseXML(frag);
  if (!alerts.length) return;

  for (const alert of alerts) {
    const feat = capToGeoJson({ alert });
    if (feat) addAlert(feat); // This will handle new, canceled, or updated alerts
  }
});


  

xmpp.start().catch(console.error);
