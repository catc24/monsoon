const eventTypes = {
    "Tornado Warning": "tornado-warning",
    "Observed Tornado Warning": "observed-tornado-warning",
    "PDS Tornado Warning": "pds-tornado-warning",
    "Tornado Emergency": "tornado-emergency",
    "Severe Thunderstorm Warning": "severe-thunderstorm-warning", 
    "Severe Thunderstorm Warning (Considerable)": "severe-thunderstorm-considerable", 
    "Severe Thunderstorm Warning (Destructive)": "pds-severe-thunderstorm-warning", 
    "Flash Flood Warning": "flash-flood-warning",
    "Flash Flood Emergency": "flash-flood-emergency",
    "Tornado Watch": "tornado-watch",
    "Severe Thunderstorm Watch": "severe-thunderstorm-watch",
    "Winter Weather Advisory": "winter-weather-advisory",
    "Winter Storm Watch": "winter-storm-watch",
    "Winter Storm Warning": "winter-storm-warning",
    "Special Weather Statement": "special-weather-statement",
    "Ice Storm Warning": "ice-storm-warning",
    "Blizzard Warning": "blizzard-warning"
};

const priority = {
    "Tornado Emergency": 1,
    "PDS Tornado Warning": 2,
    "Observed Tornado Warning": 3,
    "Tornado Warning": 4,
    "Severe Thunderstorm Warning (Destructive)": 5, 
    "Severe Thunderstorm Warning (Considerable)": 6, 
    "Severe Thunderstorm Warning": 7, 
    "Special Weather Statement": 8,
    "Tornado Watch": 9,
    "Severe Thunderstorm Watch": 10,
    "Flash Flood Emergency": 11,
    "Flash Flood Warning": 12,
    "Blizzard Warning": 13,
    "Ice Storm Warning": 14,
    "Winter Storm Warning": 15,
    "Winter Storm Watch": 16,
    "Winter Weather Advisory": 17,
};

// FIPS → State abbreviation map
const STATE_FIPS_TO_ABBR = {
    Any: "US",
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY"
  };
  
  // Extracts state from a 6-digit SAME code
  function getStateFromSAME(sameCode) {
    const fips = sameCode.slice(1, 3);
    return STATE_FIPS_TO_ABBR[fips] || "Unknown";
  }
  
let notificationsMuted = false; // Flag to mute notifications

let currentTimeZone = 'ET';
// Add this near your other global variables where you have previousWarnings and previousWarningVersions
let notifiedWarnings = new Map(); // Map to track warnings we've already shown notifications for

const warningListElement = document.getElementById('warningList');
const expirationElement = document.getElementById('expiration');
const eventTypeElement = document.getElementById('eventType');
const countiesElement = document.getElementById('counties');

const tornadoCountElement = document.getElementById('tornadoCount');
const thunderstormCountElement = document.getElementById('thunderstormCount');
const floodCountElement = document.getElementById('floodCount');
const winterWeatherCountElement = document.getElementById('winterWeatherCount'); 

// Connect to your Node.js WebSocket server
const socket = new WebSocket("");

// Handle incoming alerts
socket.addEventListener("message", (event) => {
    const warning = JSON.parse(event.data);
    activeWarnings.push({ properties: warning });
    displayNotification({ properties: warning });
    updateDashboard();
});

socket.addEventListener("open", () => {
    console.log("✅ Connected to XMPP bridge server");
});

socket.addEventListener("error", (error) => {
    console.error("❌ WebSocket Error:", error);
});



socket.addEventListener("message", (event) => {
    const warning = JSON.parse(event.data);
    activeWarnings.push({ properties: warning });
    displayNotification({ properties: warning });
    updateDashboard();
});

let previousWarningIds = new Set(); 

const labels = {
    tornado: "🌪️TORNADO WARNINGS",
    thunderstorm: "⛈️SEVERE THUNDERSTORM WARNINGS",
    flood: "💦FLASH FLOOD WARNINGS",
    winter: "❄️WINTER WEATHER WARNINGS"
};

let currentWarningIndex = 0;
let activeWarnings = [];
// Add this near your other global variables
let previousWarningVersions = new Map();
let previousWarnings = new Map();

document.body.addEventListener('click', enableSound);

function enableSound() {
    document.body.removeEventListener('click', enableSound);
}

const headerElement = document.createElement('div');
headerElement.textContent = "Latest Alerts:"; 
headerElement.className = 'warning-list-header'; 

warningListElement.prepend(headerElement);

const checkboxContainer = document.querySelector('.checkbox-container');

// Initialize selectedAlerts with common alert types
selectedAlerts = new Set([
    "Tornado Warning", 
    "Severe Thunderstorm Warning", 
    "Flash Flood Warning",
    "Flood Warning",         // Added
    "Flood Advisory",        // Added
    "Special Weather Statement"  // Added
]);



function toggleslider() {
    var slider = document.getElementById('sliderContainer');
    var body = document.body;

    if (slider.style.transform === 'translateY(0%)') {
        slider.style.transform = 'translateY(-100%)';
        body.classList.remove('overlay');
    } else {
        slider.style.transform = 'translateY(0%)';
        body.classList.add('overlay');
    }
}




function handleApiResponse(response) {
    try {
        // First clean up the response a little
        let cleanResponse = response.trim()
            .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas before ] or }
            .replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, ''); // Remove weird invisible characters

        let parsedResponse = JSON.parse(cleanResponse);

        // If it's a single object, auto-wrap it
        if (!Array.isArray(parsedResponse)) {
            console.warn("Received a single alert object, wrapping it into an array.");
            parsedResponse = [parsedResponse];
        }

        // Now safe to proceed
        parsedResponse.forEach(alert => {
            const eventName = getEventName(alert); // Get the event name
            const counties = formatCountiesNotification(alert.properties.areaDesc); // Get formatted counties
            
            console.log(`Event: ${eventName}, Counties: ${counties}`);
            
            const warning = {
                properties: {
                    event: eventName,
                    areaDesc: counties,
                    expires: alert.properties.expires,
                    description: alert.properties.description,
                    instruction: alert.properties.instruction
                }
            };
            showNotification(warning);
        });

    } catch (error) {
        console.error("Error parsing response:", error);
        alert("⚠️ Invalid JSON input!\n\nTip: Make sure your JSON is valid, no missing commas, brackets, etc.\nAlso make sure to wrap your object inside [ ] if needed!");
    }
}


function adjustMessageFontSize(messageElement) {
    const originalFontSize = 36; // Starting with larger font size
    let currentFontSize = originalFontSize;
    
    // Set initial font size
    messageElement.style.fontSize = `${currentFontSize}px`;
    
    // Check if the content overflows - gradually reduce font size until it fits
    while (messageElement.scrollHeight > messageElement.clientHeight && currentFontSize > 20) {
        // Reduce font size by smaller increments for better precision
        currentFontSize -= 1;
        messageElement.style.fontSize = `${currentFontSize}px`;
    }
    
    // If we've gone down to minimum size but text still doesn't fit
    if (messageElement.scrollHeight > messageElement.clientHeight) {
        // Trim the text content with ellipsis
        const originalText = messageElement.textContent;
        let textLength = originalText.length;
        
        while (messageElement.scrollHeight > messageElement.clientHeight && textLength > 0) {
            textLength -= 5;
            messageElement.textContent = originalText.substring(0, textLength) + "...";
        }
    }
}

// Show the custom alert builder when the button is clicked
const countiesInput = document.getElementById('countiesInput');

document.getElementById("generateAlertButton").addEventListener("click", function() {
    const eventType = document.getElementById("alertType").value;
    const damageThreat = document.getElementById("damageThreat").value;
    const detection = document.getElementById("detection").value;
    const counties = countiesInput.value.split(",").map(county => county.trim());
    const expirationTime = parseInt(document.getElementById("expiration").value, 10);

    // Create expiration date
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + expirationTime);

    // Prepare the counties string
    const areaDesc = counties.map(county => county.trim()).join("; ");
    countiesElement.textContent = `Counties: ${counties.join(', ')}`;

    // Define parameters based on event type
    const parameters = {
        thunderstormDamageThreat: ["NONE"],
        tornadoDamageThreat: ["NONE"],
        tornadoDetection: detection
    };

    if (eventType.includes("Tornado Warning")) {
        if (eventType.includes("PDS Tornado Warning")) {
            parameters.tornadoDamageThreat = ["CONSIDERABLE"];
        } else if (eventType.includes("Tornado Emergency")) {
            parameters.tornadoDamageThreat = ["CATASTROPHIC"];
        } else if (eventType.includes("Observed Tornado Warning")) {
            parameters.tornadoDetection = ["OBSERVED"];
        }
    } else if (eventType.includes("Severe Thunderstorm Warning")) {
        if (eventType.includes("Severe Thunderstorm Warning (Considerable)")) {
            parameters.thunderstormDamageThreat = ["CONSIDERABLE"];
        } else if (eventType.includes("Severe Thunderstorm Warning (Destructive)")) {
            parameters.thunderstormDamageThreat = ["DESTRUCTIVE"];
        }
    }

    // Generate random VTEC code
    const randomVTEC = generateRandomString(4) + '.' + generateRandomString(4) + '.' + generateRandomString(4) + '.' + generateRandomString(4);
    const randomID = `urn:oid:urn:oid:2.49.0.1.840.0.${generateRandomString(32)}.001.1`;

    // Create warning object
    const warning = {
        id: randomID,
        properties: {
            event: eventType,
            areaDesc: areaDesc,
            expires: expirationDate.toISOString(),
            VTEC: randomVTEC,
            parameters: parameters
        }
    };

    // Call the function to display the generated warning notification
    showNotification(warning);
});

// Function to generate random alphanumeric string
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
}

function notifyWarningExpired(eventName, warningId, areaDesc = "N/A") {
    const expiredWarning = {
        properties: {
            event: `A weather alert expired - This was a ${eventName} near ${areaDesc}`,
            id: warningId,
            areaDesc: `This was a ${eventName} near ${areaDesc}`,
            alertColor: '#FFE4C4'
        }
    };
}

function testNotification(eventName) {
    // Use the getEventName function to get the proper event name
    const eventType = getEventName({ properties: { event: eventName, parameters: {} } });

    // Create date object for current time plus 30 minutes
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 30);
    
    // List of all available counties for testing
    const allCounties = [
        "Washtenaw, MI", "Lenawee, MI", "Monroe, MI", "Wayne, MI", "Oakland, MI", 
        "Macomb, MI", "Livingston, MI", "Genesee, MI", "Ingham, MI", "Jackson, MI", 
        "Hillsdale, MI", "Calhoun, MI", "Eaton, MI", "Shiawassee, MI", "Clinton, MI", 
        "Lapeer, MI", "St. Clair, MI", "Barry, MI", "Kent, MI", "Ottawa, MI", 
        "Muskegon, MI", "Saginaw, MI", "Bay, MI", "Midland, MI", "Isabella, MI",
        "Gratiot, MI", "Ionia, MI", "Montcalm, MI", "Mecosta, MI", "Newaygo, MI"
    ];
    
    // Randomly determine how many counties to include (between 1 and 20)
    const countyCount = Math.floor(Math.random() * 20) + 1;
    
    // Shuffle the array and take the first 'countyCount' elements
    const shuffledCounties = allCounties.sort(() => 0.5 - Math.random());
    const selectedCounties = shuffledCounties.slice(0, countyCount);
    
    // Join counties with the proper separator
    const areaDesc = "TEST - " + selectedCounties.join("; ");
    
    // Function to generate a random alphanumeric string of a given length
    function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars[randomIndex];
        }
        return result;
    }
    
    // Generate a random VTEC code using random characters
    const randomVTEC = `${generateRandomString(4)}.${generateRandomString(4)}.${generateRandomString(4)}.${generateRandomString(4)}`;
    
    // Generate a random ID in the specified urn:oid format
    const randomID = `urn:oid:2.49.0.1.840.0.${generateRandomString(32)}.001.1`;

    // Randomize messageType between "Alert" and "Update"
    const messageType = Math.random() < 0.5 ? "Alert" : "Update";

    // Generate a random current version
    const currentVersion = `v${Math.floor(Math.random() * 1000)}`; // Example versioning

    // Set default parameters for the warning
    const parameters = {
        thunderstormDamageThreat: ["NONE"],
        tornadoDamageThreat: ["NONE"],
        tornadoDetection: ["RADAR INDICATED"]  // Ensure this is an array
    };

    // Update parameters based on the event name
    if (eventName.includes("Tornado Warning")) {
        if (eventName.includes("PDS Tornado Warning")) {
            parameters.tornadoDamageThreat = ["CONSIDERABLE"];  // PDS Tornado Warning
        } else if (eventName.includes("Tornado Emergency")) {
            parameters.tornadoDamageThreat = ["CATASTROPHIC"];  // Tornado Emergency
        } else if (eventName.includes("Observed Tornado Warning")) {
            parameters.tornadoDetection = ["OBSERVED"];  // Set detection to OBSERVED
        }
    } else if (eventName.includes("Severe Thunderstorm Warning")) {
        if (eventName.includes("Considerable")) {
            parameters.thunderstormDamageThreat = ["CONSIDERABLE"];  // Considerable Thunderstorm
        } else if (eventName.includes("Destructive")) {
            parameters.thunderstormDamageThreat = ["DESTRUCTIVE"];  // Destructive Thunderstorm
        }
    } else if (eventName.includes("Flash Flood Warning")) {
        if (eventName.includes("Flash Flood Emergency")) {
            parameters.flashFloodDamageThreat = ["CATASTROPHIC"];  // Flash Flood Emergency
        }
    }

    // Create warning object with updated parameters
    const warning = {
        id: randomID, // Add the random ID
        properties: {
            event: eventType, // Use the event name returned by getEventName
            areaDesc: areaDesc,
            actionSection: "THIS IS A TEST MESSAGE. DO NOT TAKE ACTION ON THIS MESSAGE.",
            expires: expirationDate.toISOString(), // Add the expiration date in ISO format
            VTEC: randomVTEC, // Add the random VTEC code
            parameters: parameters,  // Add the updated parameters (damage threats, detection)
            messageType: messageType, // Add the randomized message type
            currentVersion: currentVersion // Add the current version
        }
    };
    if (!window.activeWarningsSet) {
        window.activeWarningsSet = new Set();
    }
    window.activeWarningsSet.add(randomID);
    
    // Add to previous warnings map
    if (!previousWarnings) {
        previousWarnings = new Map();
    }
    previousWarnings.set(randomID, warning);
    
    // Add to active warnings array
    if (!activeWarnings) {
        activeWarnings = [];
    }
    activeWarnings.push(warning);

    // Update warning counters
    updateWarningCounters(warning);
    
    // Update the warning list display
    updateWarningList(activeWarnings);
    
    // Update highest alert bar
    updateHighestAlert();
    
    // Show notification with the updated warning object
    showNotification(warning);
}

function updateWarningCounters(warning) {
    const eventType = warning.properties.event;
    
    // Get current counts
    let tornadoCount = parseInt(tornadoCountElement.textContent.split(':')[1]?.trim() || 0);
    let thunderstormCount = parseInt(thunderstormCountElement.textContent.split(':')[1]?.trim() || 0);
    let floodCount = parseInt(floodCountElement.textContent.split(':')[1]?.trim() || 0);
    let winterWeatherCount = parseInt(winterWeatherCountElement.textContent.split(':')[1]?.trim() || 0);
    
    // Update counts based on event type
    if (eventType.includes("Tornado Warning")) {
        tornadoCount++;
        tornadoCountElement.textContent = `${labels.tornado}: ${tornadoCount}`;
    } else if (eventType.includes("Severe Thunderstorm Warning")) {
        thunderstormCount++;
        thunderstormCountElement.textContent = `${labels.thunderstorm}: ${thunderstormCount}`;
    } else if (eventType.includes("Flash Flood Warning")) {
        floodCount++;
        floodCountElement.textContent = `${labels.flood}: ${floodCount}`;
    } else if (eventType.includes("Winter") || eventType.includes("Ice") || eventType.includes("Blizzard")) {
        winterWeatherCount++;
        winterWeatherCountElement.textContent = `${labels.winter}: ${winterWeatherCount}`;
    }
}

// Helper function to update the highest alert bar
function updateHighestAlert() {
    // Sort active warnings by priority
    const sortedWarnings = [...activeWarnings].sort((a, b) => {
        const priorityA = priority[getEventName(a)] || 999;
        const priorityB = priority[getEventName(b)] || 999;
        return priorityA - priorityB;
    });
    
    // If there are warnings, show the highest priority one in the alert bar
    if (sortedWarnings.length > 0) {
        const highestAlert = sortedWarnings[0];
        const eventName = getEventName(highestAlert);
        
        // Update the emergency alert message if available
        const emergencyAlert = document.querySelector('.emergency-alert');
        if (emergencyAlert) {
            emergencyAlert.style.display = 'block';
            
            // Set appropriate message based on event type
            if (eventName === "Tornado Emergency" || eventName === "PDS Tornado Warning") {
                emergencyAlert.innerHTML = "THIS IS AN EXTREMELY DANGEROUS SITUATION. TAKE COVER NOW!";
            } else if (eventName === "Observed Tornado Warning") {
                emergencyAlert.innerHTML = "A TORNADO IS ON THE GROUND! TAKE COVER NOW!";
            } else if (eventName === "Severe Thunderstorm Warning (Destructive)") {
                emergencyAlert.innerHTML = "THESE ARE VERY DANGEROUS STORMS!";
            } else {
                emergencyAlert.innerHTML = getCallToAction(eventName);
            }
            
            // Apply the appropriate styling class
            emergencyAlert.className = 'emergency-alert';
            const styleClass = eventTypes[eventName];
            if (styleClass) {
                emergencyAlert.classList.add(styleClass);
            }
        }
    }
}


// Modify the addAlert function to handle cancellations
function addAlert(feature) {
    // Check if this is a cancellation message

    
    // For non-cancellation messages or if the alert to cancel wasn't found,
    // add to the alerts array as normal
    allAlerts.push(feature);
    if (allAlerts.length > MAX_ALERTS) allAlerts.shift();
  }
  

function testMostRecentAlert() {
    if (activeWarnings.length > 0) {
        const mostRecentWarning = activeWarnings[0]; 
        showNotification(mostRecentWarning);
    } else {
        alert("No active warnings to test.");
    }
}

function getEventName(alert) {
    if (!alert || !alert.properties) return "Unknown Event";

    const props = alert.properties;
    const event = props.event || "Unknown Event";
    const params = props.parameters || {};

    const thunderThreat = params.thunderstormDamageThreat?.[0]?.toUpperCase();
    const tornadoThreat = params.tornadoDamageThreat?.[0]?.toUpperCase();
    const tornadoDetection = params.tornadoDetection?.[0]?.toUpperCase();
    const flashFloodThreat = params.flashFloodDamageThreat?.[0]?.toUpperCase();

    // Tornado Warning handling
    if (event.includes('Tornado Warning')) {
        if (tornadoThreat === 'CATASTROPHIC') return 'Tornado Emergency';
        if (tornadoThreat === 'CONSIDERABLE') return 'PDS Tornado Warning';
        if (tornadoDetection === 'OBSERVED') return 'Observed Tornado Warning';
        return 'Tornado Warning';
    }

    // Severe Thunderstorm Warning handling
    if (event.includes('Severe Thunderstorm Warning')) {
        if (thunderThreat === 'CONSIDERABLE') return 'Severe Thunderstorm Warning (Considerable)';
        if (thunderThreat === 'DESTRUCTIVE') return 'Severe Thunderstorm Warning (Destructive)';
        return 'Severe Thunderstorm Warning';
    }
    
    // Flash Flood Warning handling
    if (event.includes('Flash Flood Warning')) {
        if (flashFloodThreat === 'CATASTROPHIC') return 'Flash Flood Emergency';
        return 'Flash Flood Warning';
    }

    // Return the original event name for other alerts
    return event;
}





let currentCountyIndex = 0;

let isNotificationQueueEnabled = false; 
let notificationQueue = []; 
let isShowingNotification = false; 

document.getElementById('singleNotificationToggleButton').addEventListener('click', () => {
    isNotificationQueueEnabled = !isNotificationQueueEnabled; 
    const buttonText = isNotificationQueueEnabled ? "Disable Single Notification Queue" : "Enable Single Notification Queue";
    document.getElementById('singleNotificationToggleButton').textContent = buttonText; 
});

function showNotification(warning) {
    // Get the event name using getEventName
    const eventName = getEventName(warning);
    console.log(`Event Name in Notification: ${eventName}`);  // Log the event name

    // Check messageType for issuance vs update status
    const warningId = warning.id;
    const currentVersion = warning.properties.parameters?.NWSheadline?.[0] || warning.properties.sent;
    const messageType = warning.properties?.messageType;  // Get the messageType field

    console.log(`Warning ID: ${warningId}`);
    console.log(`Current Version: ${currentVersion}`);
    console.log(`Message Type: ${messageType}`);

    // ALWAYS update tracking maps first
    previousWarningIds.add(warningId);
    previousWarnings.set(warningId, eventName);
    previousWarningVersions.set(warningId, currentVersion);
    console.log(`Updated tracking maps for warning ID: ${warningId}`);

    // Then check if notification is needed
    const isNew = !notifiedWarnings.has(warningId);
    const isUpdated = !isNew && notifiedWarnings.get(warningId) !== currentVersion;
    const previousEvent = previousWarnings.get(warningId);
    const isUpgrade = !isNew && previousEvent && previousEvent !== eventName;

    console.log(`Notification Status - New: ${isNew}, Updated: ${isUpdated}, Upgrade: ${isUpgrade}`);

    // Only show notification if it's new, updated, or upgraded
    if (isNew || isUpdated || isUpgrade) {
        // Determine notification type for labeling
        let notificationType = "NEW WEATHER ALERT:";  // Default to New if not upgrade or update
        if (messageType === 'Update' || isUpdated) {
            notificationType = "UPDATED ALERT:";  // For updates
        } else if (isUpgrade) {
            notificationType = "ALERT UPGRADED:";  // For upgraded alerts
        }

        console.log(`Determined Notification Type: ${notificationType}`);

        // Store the current version so we don't notify again until it changes
        notifiedWarnings.set(warningId, currentVersion);
        console.log(`Stored current version for warning ID: ${warningId}`);

        // Display the notification
        if (isNotificationQueueEnabled) {
            notificationQueue.push({ warning, notificationType });
            console.log(`Added to notification queue: ${notificationType} for ${eventName}`);
            processNotificationQueue();
        } else {
            displayNotification(warning, notificationType);
            console.log(`Displayed notification immediately for ${eventName}`);
        }

        console.log(`🔔 Notification shown for ${eventName} (ID: ${warningId}, ${isNew ? 'New' : isUpdated ? 'Updated' : 'Upgraded'})`);
    } else {
        console.log(`🔇 Skipping notification for already notified ${eventName} (ID: ${warningId})`);
    }
}





function processNotificationQueue() {
    if (isShowingNotification || notificationQueue.length === 0) {
        return; 
    }

    isShowingNotification = true; 
    const {warning, notificationType} = notificationQueue.shift(); 
    displayNotification(warning, notificationType); 

    setTimeout(() => {
        isShowingNotification = false; 
        processNotificationQueue(); 
    }, 5000); 
}

function typeEffect(element, text, delay = 25, startDelay = 150) {
    element.textContent = '';
    let index = 0;

    setTimeout(() => {
        const typingInterval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
            } else {
                clearInterval(typingInterval);
            }
        }, delay);
    }, startDelay);
}
function getHighestActiveAlert() {
    if (!activeWarnings || activeWarnings.length === 0) {
        return { alert: 'N/A', color: '#476FB9' };
    }

    // Sort warnings by priority
    const sortedWarnings = [...activeWarnings].sort((a, b) => {
        const eventNameA = getEventName(a); // Use getEventName instead of properties.event
        const eventNameB = getEventName(b); // Use getEventName instead of properties.event
        
        return priority[eventNameA] - priority[eventNameB];
    });

    const highestAlert = sortedWarnings[0];
    const eventName = getEventName(highestAlert); // Use getEventName for consistent naming

    return {
        alert: eventName, // Use the processed eventName
        color: getAlertColor(eventName),
        originalAlert: highestAlert // Store the original alert object
    };
}



function updateClock() {
    const now = new Date();
  
    const displayTime = new Date(now.getTime() - (currentTimeZone === 'CT' ? 1 : 0) * 60 * 60 * 1000);
  
    let hours = displayTime.getHours();
    const minutes = displayTime.getMinutes().toString().padStart(2, '0');
    const seconds = displayTime.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
  
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm} ${currentTimeZone}`;
    const dateString = `${(displayTime.getMonth() + 1).toString().padStart(2, '0')}/${displayTime.getDate().toString().padStart(2, '0')}/${(displayTime.getFullYear() % 100).toString().padStart(2, '0')}`;
  
    document.getElementById('clockDisplay').innerHTML = `<span class="time">${timeString}</span><span class="date">${dateString}</span>`;
  }
  
  function toggleTimeZone() {
    if (currentTimeZone === 'ET') {
      currentTimeZone = 'CT';
      document.getElementById('toggleTimeZone').textContent = 'Switch to Eastern Time';
    } else {
      currentTimeZone = 'ET';
      document.getElementById('toggleTimeZone').textContent = 'Switch to Central Time';
    }
    updateClock();
  }

  
  setInterval(updateClock, 1000);
  updateClock();
  
  let lastAlertText = '';
  let lastAlertColor = '';
  let lastWarningsCount = 0;
  
  function updateAlertBar() {
    const highestAlert = getHighestActiveAlert();
    const alertBar = document.getElementById('alertBar');
    const alertText = document.getElementById('highestAlertText');
    const activeAlertsBox = document.querySelector('.active-alerts-box');

    // Use getEventName to get standardized display name if we have a valid alert object
    const currentText = highestAlert.alert === 'N/A' ? 'INDIANA WEATHER ONLINE' : 
                        (highestAlert.originalAlert ? getEventName(highestAlert.originalAlert) : highestAlert.alert);
    const currentColor = highestAlert.color || '#476FB9';
    const currentCount = activeWarnings.length;

    // Skip update if there's no change
    if (
        currentText === lastAlertText &&
        currentColor === lastAlertColor &&
        currentCount === lastWarningsCount
    ) return;

    lastAlertText = currentText;
    lastAlertColor = currentColor;
    lastWarningsCount = currentCount;

    if (highestAlert.alert === 'N/A' && activeWarnings.length === 0) {
        alertText.textContent = 'INDIANA WEATHER ONLINE';
        alertBar.style.backgroundColor = '#476FB9';
        activeAlertsBox.style.display = 'none';
    } else if (highestAlert.alert) {
        alertText.textContent = currentText; // Use the processed text from getEventName
        alertBar.style.backgroundColor = highestAlert.color;
        alertBar.style.setProperty('--glow-color', highestAlert.color);
        activeAlertsBox.textContent = 'HIGHEST ACTIVE ALERT';
        activeAlertsBox.style.display = 'block';
    } else {
        alertText.textContent = 'No valid alert found.';
        alertBar.style.backgroundColor = '#476FB9';
        activeAlertsBox.style.display = 'none';
    }
}


// Add this to your existing JavaScript file (script.js)

// Create a modal container for the detailed warning info
function createWarningDetailModal() {
    // Only create if it doesn't exist yet
    if (!document.getElementById('warning-detail-modal')) {
        const modalContainer = document.createElement('div');
        modalContainer.id = 'warning-detail-modal';
        modalContainer.className = 'warning-detail-modal';
        modalContainer.style.display = 'none';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'warning-detail-content';
        
        const closeButton = document.createElement('span');
        closeButton.className = 'close-modal';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = function() {
            document.getElementById('warning-detail-modal').style.display = 'none';
        };
        
        modalContent.appendChild(closeButton);
        modalContainer.appendChild(modalContent);
        document.body.appendChild(modalContainer);
        
        // Close modal when clicking outside of it
        window.addEventListener('click', function(event) {
            if (event.target === modalContainer) {
                modalContainer.style.display = 'none';
            }
        });
    }
}

// When populating the modal with alert data, add this to your function:
function showAlertDetails(warning) {
    // Set the title and other basic info
    document.getElementById('alertTitle').textContent = getEventName(warning);
    document.getElementById('alertDescription').textContent = warning.properties.areaDesc;
    
    // Extract and display the parameter values
    const parameters = warning.properties.parameters || {};
    
    // Set values with fallbacks if they don't exist
    document.getElementById('maxWindGust').textContent = parameters.maxWindGust || 'Not specified';
    document.getElementById('maxHailSize').textContent = parameters.maxHailSize || 'Not specified';
    document.getElementById('tornadoDetection').textContent = parameters.tornadoDetection || 'Not specified';
    document.getElementById('tornadoDamageThreat').textContent = parameters.tornadoDamageThreat || 'None';
    
    // Format the expiration date
    const expiresDate = new Date(warning.properties.expires);
    document.getElementById('expires').textContent = formatDate(expiresDate);
    
    // Show the modal
    document.getElementById('alertDetailModal').classList.remove('hidden');
}


// Function to draw a polygon based on coordinates


function setupFlashingEffect(content) {
    content.classList.add('flashing');
    
    // Create a small canvas for a flashing indicator
    const indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'emergency-indicator';
    content.prepend(indicatorContainer);
    
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 30;
    indicatorContainer.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    let isWhite = true;
    const flashInterval = setInterval(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(15, 15, 10, 0, 2 * Math.PI);
        ctx.fillStyle = isWhite ? 'white' : 'red';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        
        isWhite = !isWhite;
    }, 1000); // Flash every second
    
    // Clean up interval when modal is closed
    const modal = document.getElementById('warning-detail-modal');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style' && modal.style.display === 'none') {
                clearInterval(flashInterval);
                observer.disconnect();
            }
        });
    });
    
    observer.observe(modal, { attributes: true });
}

// Function to display warning details in the modal
// Enhanced function to display warning details in the modal
function displayWarningDetails(warning) {
    createWarningDetailModal();
    
    const modal = document.getElementById('warning-detail-modal');
    const content = modal.querySelector('.warning-detail-content');
    
    // Clear previous content
    content.innerHTML = '';
    
    // Add close button
    const closeButton = document.createElement('span');
    closeButton.className = 'close-modal';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = function() {
        modal.style.display = 'none';
    };
    content.appendChild(closeButton);
    
    // Get event name and set color
    const eventName = getEventName(warning);
    const eventClass = eventTypes[eventName] || 'unknown-event';
    content.className = `warning-detail-content ${eventClass}`;
    
    // Create header section
    const header = document.createElement('div');
    header.className = 'detail-section detail-header';
    
    // Add appropriate emoji based on warning type
    const emoji = getWarningEmoji(eventName);
    
    const title = document.createElement('h2');
    title.innerHTML = `${emoji} <span class="event-emoji"></span>${eventName}`;
    header.appendChild(title);
    
    const areaDesc = document.createElement('h3');
    areaDesc.textContent = warning.properties.areaDesc;
    header.appendChild(areaDesc);
    
    content.appendChild(header);
    
    // Information container - wrap in detail-section
    const infoSection = document.createElement('div');
    infoSection.className = 'detail-section';
    
    const infoTitle = document.createElement('h4');
    infoTitle.textContent = '⏱️ Timing & Details';
    infoSection.appendChild(infoTitle);
    
    const infoContainer = document.createElement('div');
    infoContainer.className = 'detail-info';
    
    // Add various details if they exist
    const params = warning.properties.parameters || {};
    const details = [
        { label: 'Issued', value: new Date(warning.properties.sent).toLocaleString() },
        { label: 'Expires', value: new Date(warning.properties.expires).toLocaleString() }
    ];
    
    // Add storm motion if available
    if (params.eventMotionDescription && params.eventMotionDescription[0]) {
        const motionDesc = params.eventMotionDescription[0];
        if (motionDesc.includes('storm')) {
            const parts = motionDesc.split('...');
            if (parts.length >= 3) {
                const dirSpeed = parts[2].split('DEG')[0].trim() + '° at ' + 
                                parts[2].split('KT')[0].split('DEG')[1].trim() + ' kt';
                details.push({ label: 'Storm Motion', value: dirSpeed });
            }
        }
    }
    
    // Add wind information if available
    if (params.maxWindGust && params.maxWindGust[0]) {
        details.push({ 
            label: 'Maximum Wind Gust', 
            value: params.maxWindGust[0],
            critical: parseInt(params.maxWindGust[0]) >= 70 
        });
    }
    
    // Add hail information if available
    if (params.maxHailSize && params.maxHailSize[0]) {
        details.push({ 
            label: 'Maximum Hail Size', 
            value: `${params.maxHailSize[0]} inches`,
            critical: parseFloat(params.maxHailSize[0]) >= 1.5
        });
    }
    
    // Add tornado information if available
    if (params.tornadoDetection && params.tornadoDetection[0]) {
        details.push({ 
            label: 'Tornado Detection', 
            value: params.tornadoDetection[0],
            critical: params.tornadoDetection[0].toLowerCase().includes('observed')
        });
    }
    
    if (params.tornadoDamageThreat && params.tornadoDamageThreat[0]) {
        details.push({ 
            label: 'Tornado Damage Threat', 
            value: params.tornadoDamageThreat[0],
            critical: params.tornadoDamageThreat[0].toLowerCase() !== 'possible'
        });
    }

    if (params.thunderstormDamageThreat && params.thunderstormDamageThreat[0]) {
        const tsThreat = params.thunderstormDamageThreat[0];
        details.push({
          label: 'Thunderstorm Damage Threat',
          value: tsThreat,
          // flag “critical” if it’s CONSIDERABLE or worse
          critical: ['CONSIDERABLE','DESTRUCTIVE','CATASTROPHIC']
                     .includes(tsThreat.toUpperCase())
        });
      }
    
    // Create the details elements
    details.forEach(detail => {
        if (detail.value) {
            const detailRow = document.createElement('div');
            detailRow.className = 'detail-row';
            
            const label = document.createElement('span');
            label.className = 'detail-label';
            label.textContent = detail.label + ': ';
            
            const value = document.createElement('span');
            value.className = detail.critical ? 'detail-value critical' : 'detail-value';
            value.textContent = detail.value;
            
            detailRow.appendChild(label);
            detailRow.appendChild(value);
            infoContainer.appendChild(detailRow);
        }
    });
    
    infoSection.appendChild(infoContainer);
    content.appendChild(infoSection);
    
    // Add description in its own section
    if (warning.properties.description) {
        const descSection = document.createElement('div');
        descSection.className = 'detail-section';
        
        const descTitle = document.createElement('h4');
        descTitle.textContent = '📝 Description';
        descSection.appendChild(descTitle);
        
        const descText = document.createElement('div');
        descText.className = 'description-text';
        descText.textContent = warning.properties.description;
        descSection.appendChild(descText);
        
        content.appendChild(descSection);
    }
    
    // Add instruction in its own section
    if (warning.properties.instruction) {
        const instrSection = document.createElement('div');
        instrSection.className = 'detail-section instructions';
        
        const instrTitle = document.createElement('h4');
        instrTitle.textContent = '⚠️ Instructions';
        instrSection.appendChild(instrTitle);
        
        const instrText = document.createElement('div');
        instrText.className = 'instruction-text';
        instrText.textContent = warning.properties.instruction;
        instrSection.appendChild(instrText);
        
        content.appendChild(instrSection);
    }
    
    // Draw polygon if available
    if (warning.geometry && warning.geometry.type === 'Polygon' && warning.geometry.coordinates) {
        const areaSection = document.createElement('div');
        areaSection.className = 'detail-section areas';
        
        const polygonTitle = document.createElement('h4');
        polygonTitle.textContent = '🗺️ Warning Area';
        areaSection.appendChild(polygonTitle);
        
        const polygonContainer = drawPolygon(warning.geometry.coordinates, content, eventClass);
        if (polygonContainer) {
            areaSection.appendChild(polygonContainer);
            content.appendChild(areaSection);
        }
    }
    
    // Display the modal with animation
    modal.style.display = 'block';
    content.style.animation = 'fadeIn 0.3s ease-in-out';
    
    // Set up flashing effect for certain warnings
    if (eventName === 'Tornado Emergency' || eventName === 'PDS Tornado Warning') {
        setupFlashingEffect(content);
    } else {
        content.classList.remove('flashing');
    }
    
    // Make the modal draggable
    makeElementDraggable(content);
}

// Function to make the warning detail modal draggable
function makeElementDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector('.detail-header') || element;
    
    if (header) {
        header.style.cursor = 'move';
        header.onmousedown = dragMouseDown;
    }
    
    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Get the mouse cursor position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calculate the new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Function to get appropriate emoji for warning type
function getWarningEmoji(eventName) {
    const emojiMap = {
        'Tornado Warning': '🌪️',
        'Observed Tornado Warning': '🌪️',
        'PDS Tornado Warning': '⚠️🌪️',
        'Tornado Emergency': '🚨🌪️',
        'Severe Thunderstorm Warning': '⛈️',
        'Severe Thunderstorm Warning (Considerable)': '⚡⛈️',
        'Severe Thunderstorm Warning (Destructive)': '💥⛈️',
        'Flash Flood Warning': '🌊',
        'Flash Flood Emergency': '🚨🌊',
        'Flood Warning': '💧',
        'Flood Advisory': '💦',
        'Winter Storm Warning': '❄️',
        'Winter Weather Advisory': '🌨️',
        'Ice Storm Warning': '🧊',
        'Blizzard Warning': '☃️❄️',
        'Special Weather Statement': 'ℹ️',
        'Tornado Watch': '👀🌪️',
        'Severe Thunderstorm Watch': '👀⛈️'
    };
    
    return emojiMap[eventName] || '⚠️';
}

// Enhanced function to draw polygon with flashing effect
function drawPolygon(coordinates, container) {
    if (!coordinates || !coordinates.length) return null;

    // Check if polygon already exists in the container and remove it
    const existing = container.querySelector('.polygon-container');
    if (existing) existing.remove();

    const polygonContainer = document.createElement('div');
    polygonContainer.className = 'polygon-container';

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    polygonContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    const points = coordinates[0];
    if (!points || !points.length) return null;
    
    
    if (!points || !points.length) return null;
    
    // Find min/max to scale the polygon
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    points.forEach(point => {
        const lat = point[0];
        const lon = point[1];
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
    });
    
    // Add some padding
    const latPadding = (maxLat - minLat) * 0.1;
    const lonPadding = (maxLon - minLon) * 0.1;
    minLat -= latPadding;
    maxLat += latPadding;
    minLon -= lonPadding;
    maxLon += lonPadding;
    
    // Scale function to map coordinates to canvas
    const scaleX = (lon) => {
        return canvas.width * (lon - minLon) / (maxLon - minLon);
    };
    
    const scaleY = (lat) => {
        return canvas.height * (1 - (lat - minLat) / (maxLat - minLat));
    };
    
    // Draw the polygon
    ctx.beginPath();
    ctx.moveTo(scaleX(points[0][1]), scaleY(points[0][0]));
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(scaleX(points[i][1]), scaleY(points[i][0]));
    }
    
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.stroke();
    
    return polygonContainer;
}

// Function to get polygon color based on warning type class
function getPolygonColor(eventClass) {
    const colorMap = {
        'tornado-warning': 'rgba(255, 0, 0, 0.6)',
        'observed-tornado-warning': 'rgba(139, 0, 0, 0.6)',
        'pds-tornado-warning': 'rgba(128, 0, 128, 0.6)',
        'tornado-emergency': 'rgba(255, 192, 203, 0.6)',
        'severe-thunderstorm-warning': 'rgba(255, 165, 0, 0.6)',
        'flash-flood-warning': 'rgba(0, 100, 0, 0.6)',
        'ice-storm-warning': 'rgba(160, 28, 127, 0.6)'
        // Add more colors for other warning types as needed
    };
    
    return colorMap[eventClass] || 'rgba(255, 255, 255, 0.3)';
}








function getAlertColor(eventName) {
    switch (eventName) {
        case "Tornado Warning":
            return '#FF0000';
        case "Observed Tornado Warning":
            return '#FF00FF';
        case "PDS Tornado Warning":
            return '#FF00FF';
        case "Tornado Emergency":
            return '#FF0080';
        case "Severe Thunderstorm Warning":
            return '#FF8000';
        case "Severe Thunderstorm Warning (Considerable)":
            return '#FF8000';
        case "Severe Thunderstorm Warning (Destructive)":
            return '#FF8000';
        case "Flash Flood Warning":
            return '#228B22';
        case "Flash Flood Emergency":
            return '#8B0000';
        case "Tornado Watch":
            return '#8b0000';
        case "Severe Thunderstorm Watch":
            return '#DB7093';
        case "Winter Weather Advisory":
            return '#7B68EE';
        case "Winter Storm Warning":
            return '#FF69B4';
        case "Winter Storm Watch":
            return '#6699CC';
        case "Ice Storm Warning":
            return '#8B008B';
        case "Blizzard Warning":
            return '#FF4500';
        case "Special Weather Statement":
            return '#FFE4B5';
        default:
            return 'rgba(255, 255, 255, 0.9)';
    }
}

setInterval(updateAlertBar, 50);

const audioElements = {
    TorIssSound: new Audio("https://audio.jukehost.co.uk/ClbCqxfWssr6dlRXqx3lXVqKQPPVeRgQ"),
    TorPDSSound: new Audio("https://audio.jukehost.co.uk/MePPuUhuqZzUMt6vBRqvBYDydDVxNhBi"),
    PDSSVRSound: new Audio("https://audio.jukehost.co.uk/DvWZ5IjakUW0fHpqc3t2ozBS1BGFxDN4"),
    SVRCSound: new Audio("https://audio.jukehost.co.uk/Xkv300KaF6MJghFS9oQ5BMTWfSDle4IW"),
    SVRCNEWSound: new Audio("https://audio.jukehost.co.uk/cAZ0FjIgLrbX8kxErMb6DAKTq0BwKdlz"),
    TORUPG: new Audio("https://audio.jukehost.co.uk/o6LRilMzywJkfY9QVreGyUjobxERtgwV"),
    TOREISS: new Audio("https://audio.jukehost.co.uk/DELgBfmWgrg8lakettLP9mD9nomZaVA3"),
    TOAWatch: new Audio("https://audio.jukehost.co.uk/MZxVbo8EmFP4XP6vTKaGPtUfGIU6IFdK"),
    SVAWatch: new Audio("https://audio.jukehost.co.uk/vOROpwVlXRik9TS2wXvJvtYInR8o2qMQ")
};

// Lower volume for TORPDS and TOREISS
audioElements.TorPDSSound.volume = 0.4;  // 50%
audioElements.TOREISS.volume = 0.4;      // 50%

function playSoundById(soundId) {
    const sound = audioElements[soundId];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.error('Error playing sound:', error));
    } else {
        audioElements.SVRCSound.currentTime = 0;
        audioElements.SVRCSound.play().catch(error => console.error('Error playing fallback sound:', error));
    }
}

let scriptStartTime = Date.now(); // Store the time when the script starts


function displayNotification(warning, notificationType = "") {
    const currentTime = Date.now();
    
    // Check if 5 seconds have passed since the script started
    if (currentTime - scriptStartTime < 5000) {
        console.log("Waiting for 5 seconds before showing notifications...");
        return; // Exit early to prevent showing the notification
    }

    if (notificationsMuted) {
        console.log("Notifications are muted. Skipping display.");
        return; // Exit early if notifications are muted
    }

    const eventName = getEventName(warning);
    const messageType = warning.properties?.messageType;

    // Only show notification if it's a new or upgraded alert
    if (messageType !== 'Alert' && messageType !== 'Update') {
        return; // Exit early if it's not a new or upgraded alert
    }

    // Set the correct notification type
    if (messageType === 'Alert') {
        notificationType = "NEW WEATHER ALERT:";
    } else if (messageType === 'Update') {
        notificationType = "ALERT UPDATED:";
    }

    // Use the notification-specific formatting function here
    const counties = formatCountiesNotification(warning.properties.areaDesc);

    const notification = document.createElement('div');
    notification.className = 'notification-popup'; 
    notification.style.bottom = '125px'; // Ensure this is in pixels

    // Add notification type label in top left
    const notificationTypeLabel = document.createElement('div');
    notificationTypeLabel.className = 'notification-type-label';
    notificationTypeLabel.textContent = notificationType;
    notification.appendChild(notificationTypeLabel);

    const title = document.createElement('div');
    title.className = 'notification-title';
    title.textContent = eventName;

    const countiesSection = document.createElement('div');
    countiesSection.className = 'notification-message';
    countiesSection.textContent = counties;

    // Create the expiration element
    const expirationElement = document.createElement('div');
    expirationElement.className = 'notification-expiration';

    // Format the expiration time
    const expirationDate = new Date(warning.properties.expires);
    const timeOptions = { 
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    const formattedExpirationTime = expirationDate.toLocaleString('en-US', timeOptions);
    expirationElement.textContent = `EXPIRES: ${formattedExpirationTime}`;

    let notificationDuration = 7000; // Default 7 seconds (adjusted to be faster)

    // Special handling for tornado emergency and PDS warnings
    if (eventName === "Tornado Emergency" || eventName === "PDS Tornado Warning") {
        notificationDuration = 10000; // 10 seconds for these critical alerts
    }

    // Add the notification pulse to the logo
    const logo = document.getElementById('pulseLogo');
    if (logo) {
        // Remove any existing animation class
        logo.classList.remove('notification-pulse');
        
        // Trigger reflow to restart animation
        void logo.offsetWidth;
        
        // Add the notification pulse class
        logo.classList.add('notification-pulse');
        
        // Remove the notification pulse class after animation completes
        setTimeout(() => {
            logo.classList.remove('notification-pulse');
        }, 2000);
    }

    // Play appropriate sound based on event type
    if (eventName.includes("Tornado Emergency")) {
        playSoundById('TOREISS');
    } else if (eventName.includes("PDS Tornado Warning")) {
        playSoundById('TorPDSSound');
    } else if (eventName.includes("Tornado Warning")) {
        playSoundById('TorIssSound');
    } else if (eventName === "Severe Thunderstorm Warning") {
        playSoundById('SVRCSound');
    } else if (eventName === "Severe Thunderstorm Warning (Considerable)") {
        playSoundById('SVRCNEWSound');
    } else if (eventName === "Severe Thunderstorm Warning (Destructive)") {
        playSoundById('PDSSVRSound');
    } else if (eventName.includes("Tornado Watch")) {
        playSoundById('TOAWatch');
    } else if (eventName.includes("Severe Thunderstorm Watch")) {
        playSoundById('SVAWatch');
    } else {
        playSoundById('SVRCSound');
    }

    // Create emergency alert container
    const emergencyContainer = document.createElement('div');
    emergencyContainer.className = 'emergency-container';
    emergencyContainer.style.display = 'flex';
    emergencyContainer.style.alignItems = 'center';
    emergencyContainer.style.justifyContent = 'flex-end';

    // Create emergency alert text
    const emergencyAlert = document.createElement('div');
    emergencyAlert.className = 'emergency-alert';
    emergencyAlert.style.fontSize = '36px';
    emergencyAlert.style.color = '#fff';

    // Set emergency alert message based on event name
    if (eventName === "Tornado Emergency" || eventName === "PDS Tornado Warning") {
        emergencyAlert.innerHTML = "THIS IS AN EXTREMELY DANGEROUS SITUATION. TAKE COVER NOW!";
    } else if (eventName === "Observed Tornado Warning") {
        emergencyAlert.innerHTML = "A TORNADO IS ON THE GROUND! TAKE COVER NOW!";
    } else if (eventName === "Severe Thunderstorm Warning (Destructive)") {
        emergencyAlert.innerHTML = "THESE ARE VERY DANGEROUS STORMS!";
    }

    // Append elements to container
    emergencyContainer.appendChild(emergencyAlert);
    notification.appendChild(emergencyContainer);

    // Append all elements to the notification
    notification.appendChild(title);
    notification.appendChild(countiesSection);
    notification.appendChild(expirationElement);
    document.body.appendChild(notification);

    // Set initial position for animation
    notification.style.transform = 'translateY(100%)';

    // Apply color based on alert type
    let alertColor = getAlertColor(eventName);
    notification.style.backgroundColor = alertColor;
    notification.style.opacity = 1;

    notification.style.transform = 'translateY(100%)';
    notification.style.transition = 'transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)';

    // Force reflow to apply initial style
    void notification.offsetHeight;

    // Now trigger the slide-up
    notification.style.transform = 'translateY(50%)';

    // Set timeout to hide and remove notification
    setTimeout(() => {
        notification.style.transform = 'translateY(100%)'; // Slide down to hide
        setTimeout(() => {
            notification.remove();
        }, 500); // Keep it for a little longer to let the transition finish
    }, notificationDuration);

    updateAlertBar();
}


document.getElementById('testCustomWarningButton').addEventListener('click', () => {
    const customWarningText = document.getElementById('customWarningInput').value;
    if (customWarningText) {
        testNotification(customWarningText);
    } else {
        alert("Please enter a warning to test.");
    }
});

function makeElementDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector('.header');

    if (header) {
        header.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Call the function to make the warning box draggable


function clearAllWarnings() {
    // Clear active warnings
    activeWarnings = [];
    
    // Clear previous warnings tracking
    previousWarnings = new Map();
    previousWarningIds = new Set();
    previousWarningVersions = new Map();
    notifiedWarnings = new Map();
    
    if (window.activeWarningsSet) {
        window.activeWarningsSet.clear();
    }
    
    // Update UI to reflect no warnings
    updateWarningList([]);
    showNoWarningDashboard();
    
    // Update warning counters
    document.querySelector('#tornadoCount').textContent = "0";
    document.querySelector('#thunderstormCount').textContent = "0";
    document.querySelector('#floodCount').textContent = "0";
    document.querySelector('#specialWeatherStatementCount').textContent = "0";
    
    // Reset the alert bar to default state
    const alertBar = document.getElementById('alertBar');
    const alertText = document.getElementById('highestAlertText');
    const activeAlertsBox = document.querySelector('.active-alerts-box');
    
    if (alertBar && alertText) {
        alertText.textContent = 'INDIANA WEATHER ONLINE';
        alertBar.style.backgroundColor = '#476FB9';
        
        // Clear any glow effects
        alertBar.style.setProperty('--glow-color', 'transparent');
        alertBar.style.animation = 'none';
        
        // Hide the highest active alert box if visible
        if (activeAlertsBox) {
            activeAlertsBox.style.display = 'none';
        }
    }
    
    // Also clear any emergency alerts if they exist
    const emergencyAlert = document.querySelector('.emergency-alert');
    if (emergencyAlert) {
        emergencyAlert.style.display = 'none';
    }
    
    // Call updateAlertBar to ensure it's properly updated
    updateAlertBar();
    
    console.log("All warnings cleared for testing purposes");
}


// Add event listener for the clear warnings button
document.addEventListener('DOMContentLoaded', function() {
    const clearButton = document.getElementById('clearWarningsButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearAllWarnings);
    }
});


function isWarningActive(warning) {
    const expirationDate = new Date(warning.properties.expires);
    return expirationDate > new Date();
}

function getEventNameFromText(warningText) {
    if (warningText.includes("Tornado Warning")) {
        if (warningText.includes("This is a PARTICULARLY DANGEROUS SITUATION. TAKE COVER NOW!")) {
            return "PDS Tornado Warning";
        } else if (warningText.includes("TORNADO EMERGENCY")) {
            return "Tornado Emergency";
        } else {
            return "Observed Tornado Warning";
        }
    } else if (warningText.includes("Severe Thunderstorm Warning")) {
        if (warningText.includes("THUNDERSTORM DAMAGE THREAT...CONSIDERABLE")) {
            return "Severe Thunderstorm Warning (Considerable)";
        } else if (warningText.includes("THUNDERSTORM DAMAGE THREAT...DESTRUCTIVE")) {
            return "Severe Thunderstorm Warning (Destructive)";
        } else {
            return "Severe Thunderstorm Warning";
        }
    } else if (warningText.includes("Flash Flood Warning")) {
        return "Flash Flood Warning";
    } else {
        return "Unknown Event";
    }
}

function extractCounties(warningText) {
    const countyRegex = /(?:\* Locations impacted include\.\.\.\s*)([\s\S]*?)(?=\n\n)/;
    const match = warningText.match(countyRegex);
    return match ? match[1].trim() : "N/A";
}

// For the dashboard display (limit to 4 counties)
function formatCountiesTopBar(areaDesc) {
    if (!areaDesc) return "Unknown Area";
    
    // Split the counties string and clean each part
    const parts = areaDesc.split(';').map(part => part.trim());
    
    // If we have more than 4 counties, only show the first 4 with an ellipsis
    if (parts.length > 3) {
        return parts.slice(0, 3).join(', ') + '...';
    }
    
    return parts.join(', ');
}

async function fetchWarnings() {
    try {
        const response = await fetch('https://api.weather.gov/alerts/active?area=MI');
        const data = await response.json();
        const warnings = data.features.filter(feature =>
            selectedAlerts.has(feature.properties.event)
        );

        let tornadoCount = 0;
        let thunderstormCount = 0;
        let floodCount = 0;
        let winterWeatherCount = 0;

        warnings.forEach(warning => {
            const eventName = warning.properties.event;
            if (eventName === "Tornado Warning") {
                const detectionType = warning.properties.parameters?.tornadoDetection?.[0];
                const damageThreat = warning.properties.parameters?.tornadoDamageThreat?.[0];
                if (detectionType === "OBSERVED") {
                    if (damageThreat === "CONSIDERABLE") {
                        tornadoCount++;
                    } else if (damageThreat === "CATASTROPHIC") {
                        tornadoCount++;
                    } else {
                        tornadoCount++;
                    }
                } else {
                    tornadoCount++;
                }
            } else if (eventName === "Severe Thunderstorm Warning") {
                const damageThreat = warning.properties.parameters?.thunderstormDamageThreat?.[0];
                if (damageThreat === "CONSIDERABLE") {
                    thunderstormCount++;
                } else if (damageThreat === "DESTRUCTIVE") {
                    thunderstormCount++;
                } else {
                    thunderstormCount++;
                }
            } else if (eventName === "Flash Flood Warning") {
                floodCount++;
            } else if (eventName === "Winter Weather Advisory") {
                winterWeatherCount++;
            } else if (eventName === "Winter Storm Warning") {
                winterWeatherCount++;
            } else if (eventName === "Winter Storm Watch") {
                winterWeatherCount++;
            }
        });

        tornadoCountElement.textContent = `${labels.tornado}: ${tornadoCount}`;
        thunderstormCountElement.textContent = `${labels.thunderstorm}: ${thunderstormCount}`;
        floodCountElement.textContent = `${labels.flood}: ${floodCount}`;
        winterWeatherCountElement.textContent = `${labels.winter}: ${winterWeatherCount}`;

        warnings.sort((a, b) => new Date(b.properties.sent) - new Date(a.properties.sent));
        activeWarnings = warnings;
        
        // If no warnings, display current weather conditions instead
        if (warnings.length === 0) {
            const stationIds = Object.keys(MI_STATIONS);
            if (stationIds.length > 0 && currentConditions[stationIds[currentStationIndex]]) {
                displayCurrentConditions(stationIds[currentStationIndex]);
            }
        } else {
            // Render warnings as usual...
            updateWarningList();
        }

        const currentWarningIds = new Set(warnings.map(w => w.id));

        warnings.forEach(warning => {
            const warningId = warning.id;
            const eventName = getEventName(warning);

            if (!warning.properties || !warning.properties.event) {
                console.warn('Warning is missing properties:', warning);
                return;
            }
            if (!previousWarningIds.has(warningId)) {
                previousWarningIds.add(warningId);
                showNotification(warning);
            } else {
                const previousEvent = previousWarnings.get(warningId);
                if (previousEvent && previousEvent !== eventName) {
                    showNotification(warning);
                }
            }

            previousWarnings.set(warningId, eventName);
        });

        for (const id of Array.from(previousWarningIds)) {
            if (!currentWarningIds.has(id)) {
                const prev = previousWarnings.get(id);
                const name = typeof prev === 'string'
                    ? prev
                    : getEventName(prev);
        
                console.log(`⚠️ Warning expired: ${name} (ID: ${id})`);
                notifyWarningExpired(name, id);
        
                previousWarnings.delete(id);
                previousWarningIds.delete(id);
            }
        }
        
        

    } catch (error) {
        console.error('❌ Error fetching warnings:', error);
    }
}

// For notifications (show all counties)
function formatCountiesNotification(areaDesc) {
    if (!areaDesc) return "Unknown Area";
    
    // Split the counties string and clean each part
    const parts = areaDesc.split(';').map(part => part.trim());
    
    // Show all counties in notifications
    return parts.join(', ');
}


// Fix for the updateWarningList function
function updateWarningList(warnings) {
    const warningListElement = document.querySelector('.warning-list');
    const existingWarningElements = warningListElement.querySelectorAll('.warning-box');
    const existingWarningsMap = new Map();
    const latestWarnings = [...warnings]; // Make a copy of the warnings array
    
    for (let element of existingWarningElements) {
        const warningId = element.getAttribute('data-warning-id');
        existingWarningsMap.set(warningId, element);
    }

    latestWarnings.forEach(warning => {
        const warningId = warning.id;
        const eventName = getEventName(warning); 
        const counties = formatCountiesTopBar(warning.properties.areaDesc);
        const displayText = `${eventName} - ${counties}`; 
        
        if (existingWarningsMap.has(warningId)) {
            const warningElement = existingWarningsMap.get(warningId);
            warningElement.textContent = displayText;
            warningElement.className = `warning-box ${eventTypes[eventName]}`; 
        } else {
            const warningBox = document.createElement('div');
            warningBox.className = `warning-box ${eventTypes[eventName]}`; 
            warningBox.setAttribute('data-warning-id', warningId);
            warningBox.textContent = displayText;
            
            warningBox.addEventListener('click', function(e) {
                // Add ripple effect

                
                // Show warning details
                displayWarningDetails(warning);
            });
            
            warningListElement.appendChild(warningBox);
        }
    });

    for (let [warningId, element] of existingWarningsMap) {
        if (!latestWarnings.find(warning => warning.id === warningId)) {
            warningListElement.removeChild(element);
        }
    }
}



function playSound(soundFile) {
    const audio = new Audio(`Sounds/${soundFile}`); 
    audio.play().catch(error => console.error('Error playing sound:', error));
}

function getCallToAction(eventName) {
    switch (eventName) {
        case "Tornado Warning":
        case "Observed Tornado Warning":
            return "Seek shelter now!";
        case "PDS Tornado Warning":
        case "Tornado Emergency":
            return "Seek shelter now! You are in a life-threatening situation!";
        case "Severe Thunderstorm Warning":
        case "Severe Thunderstorm Warning (Considerable)":
        case "Severe Thunderstorm Warning (Destructive)":
            return "Seek shelter indoors away from windows!";
        case "Flash Flood Warning":
            return "Seek higher ground now!";
        case "Tornado Watch":
        case "Severe Thunderstorm Watch":
        case "Winter Weather Advisory":
        case "Winter Storm Watch":
        case "Blizzard Warning":
        case "Winter Storm Warning":
        case "Ice Storm Warning":
            return "Stay tuned for further info!";
        default:
            return "Take Appropriate Action!";
    }
}



document.getElementById('saveStateButton').addEventListener('click', () => {
    const rawInput = document.getElementById('stateInput').value.toUpperCase();
    window.selectedStates = rawInput.split(',').map(s => s.trim()).filter(Boolean);
    
    // Convert the state abbreviations to FIPS codes and log
    const stateFipsCodes = window.selectedStates.map(state => {
        const fipsCode = Object.keys(STATE_FIPS_TO_ABBR).find(key => STATE_FIPS_TO_ABBR[key] === state);
        return fipsCode || "Unknown";
    });

    console.log(`State filter set to: ${window.selectedStates.join(', ')}`);
    console.log(`State FIPS codes set to: ${stateFipsCodes.join(', ')}`);

    // Call updateDashboard to refresh the dashboard with the new state selection
    updateDashboard();

    if (window.tacticalModeAbort) {
        window.tacticalModeAbort();
    }
    let abort = false;
    window.tacticalModeAbort = () => { abort = true; };

    (async function tacticalModeLoop() {
        const interval = 5000; // 5 seconds
        while (!abort) {
            const start = Date.now();
            
            await tacticalMode(); // Run the fetch and processing

            const elapsed = Date.now() - start;
            const remainingTime = Math.max(0, interval - elapsed);
            
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
    })();
});

let dashboardUpdatePending = false;

document.getElementById('tacticalModeButton').addEventListener('click', () => {
    console.log('Tactical mode button clicked - fetching ALL warnings regardless of SAME codes');
    
    if (window.tacticalModeAbort) {
        window.tacticalModeAbort();
    }
    let abort = false;
    window.tacticalModeAbort = () => { abort = true; };

    (async function tacticalModeLoop() {
        const interval = 5000; // Fixed interval of 5 seconds
        while (!abort) {
            const start = Date.now(); // Track the start time of the cycle
            
            await tacticalMode(true); // Pass true to ignore SAME filter
            updateWarningList(activeWarnings);

            const elapsed = Date.now() - start; // Calculate how long the function took
            const remainingTime = Math.max(0, interval - elapsed); // Ensure we don't set a negative timeout

            // Schedule the next update for the remaining time
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
    })();
});


async function tacticalMode(ignoreSameFilter = false) {
    console.log('🔄 Starting tactical mode fetch cycle...');

    try {
        const previousActiveWarnings = [...activeWarnings];
        const tempActiveWarnings = [];

        if (!window.activeWarningsSet) {
            window.activeWarningsSet = new Set();
        } else {
            window.activeWarningsSet.clear();
        }

        const previousVtecMap = new Map();
        previousActiveWarnings.forEach(warning => {
            const vtec = warning.properties?.VTEC;
            if (vtec) previousVtecMap.set(vtec, warning);
        });

        const response = await fetch('http://localhost:3100/api/xmpp-alerts');
        if (!response.ok) {
            console.error(`❌ API response not OK: ${response.status}`);
            return;
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('⚠️ No valid alerts data.');
            return;
        }
        updateWarningList(activeWarnings);

        const alertsArray = data;
        const currentWarningIds = new Set();
        let tornadoCount = 0, severeThunderstormCount = 0, flashFloodCount = 0, specialWeatherStatementCount = 0;

        const selectedAlerts = Array.from(
            document.querySelectorAll('#checkboxContainer input:checked')
        ).map(cb => cb.value);

        const warnings = alertsArray.filter(alert => {
            if (!alert.properties) return false;
            if (alert.properties.messageType === 'Cancel') return false;
            const expires = alert.properties.expires;
            if (expires && new Date(expires) <= new Date()) return false;
            if (!window.selectedStates) {
                window.selectedStates = []; // Default to an empty array if not initialized
            }
            const eventType = getEventName(alert);
            if (!selectedAlerts.includes(eventType)) return false;
            
            // Skip SAME code filtering if ignoreSameFilter is true
            if (!ignoreSameFilter) {
                const areaDesc = alert.properties.areaDesc || '';
                const alertSAMECodes = alert.properties?.geocode?.SAME || [];
                const statesFromSAME = alertSAMECodes.map(getStateFromSAME);
                const matchesInputState = statesFromSAME.some(state => window.selectedStates.includes(state));
                if (!matchesInputState) return false;
            }

            if (/Tornado/.test(eventType)) tornadoCount++;
            else if (/Thunderstorm/.test(eventType)) severeThunderstormCount++;
            else if (/Flood/.test(eventType)) flashFloodCount++;
            else if (/Special Weather Statement/.test(eventType)) specialWeatherStatementCount++;

            return true;
        });

        warnings.forEach(alert => {
            const alertId = alert.id || '';
            const normalizedId = (alertId + '').replace(/^(urn:oid:)+/, 'urn:oid:');
            alert.normalizedId = normalizedId;
            currentWarningIds.add(normalizedId);
            window.activeWarningsSet.add(normalizedId);
            previousWarnings.set(normalizedId, alert);

            const eventName = getEventName(alert);
            const messageType = alert.properties?.messageType;
            alert.classifiedAs = eventName;

            let notificationType = messageType === 'Update' ? 'Update' : 'New';
            showNotification(alert, eventName, notificationType);
            tempActiveWarnings.push(alert);
        });

        // Update the active warnings list
        activeWarnings = tempActiveWarnings;

        // Call updateWarningList to refresh the UI with the new and updated alerts

        if (!dashboardUpdatePending) {
            dashboardUpdatePending = true;
            updateDashboard(alertsArray);

            tornadoCountElement.textContent = tornadoCount;
            thunderstormCountElement.textContent = severeThunderstormCount;
            floodCountElement.textContent = flashFloodCount;
            specialWeatherStatementElement.textContent = specialWeatherStatementCount;

            dashboardUpdatePending = false;
        }

        for (const id of Array.from(previousWarningIds)) {
            if (!currentWarningIds.has(id)) {
                const prev = previousWarnings.get(id);
                const name = typeof prev === 'string' ? prev : getEventName(prev);
                notifyWarningExpired(name, id);
                previousWarnings.delete(id);
                previousWarningIds.delete(id);
            }
        }
        
        activeWarnings = activeWarnings.filter(alert => {
            const exp = alert.properties?.expires;
            return !exp || new Date(exp) > new Date();
        });
        
    } catch (error) {
        console.error('❌ Error during tactical mode fetch:', error);
    }
    updateAlertBar();
}

// Event listener for the save button







let currentCityIndex = 0;  // Or set it to a starting index of your choice
const CITY_STATIONS = [
  { city: 'Indianapolis', station: 'KIND' },     // Indianapolis International Airport :contentReference[oaicite:0]{index=0}
  { city: 'Fort Wayne',  station: 'KFWA' },     // Fort Wayne International Airport :contentReference[oaicite:1]{index=1}
  { city: 'South Bend',  station: 'KSBN' },     // South Bend International Airport :contentReference[oaicite:2]{index=2}
  { city: 'Evansville',  station: 'KEVV' },     // Evansville Regional Airport :contentReference[oaicite:3]{index=3}
  { city: 'Lafayette',   station: 'KLAF' },     // Purdue University Airport :contentReference[oaicite:4]{index=4}
  { city: 'Bloomington', station: 'KBMG' },     // Monroe County Airport :contentReference[oaicite:5]{index=5}
  { city: 'Terre Haute', station: 'KHUF' },     // Terre Haute Regional Airport :contentReference[oaicite:6]{index=6}
  { city: 'Muncie',      station: 'KMIE' },     // Delaware County Airport (Johnson Field) :contentReference[oaicite:7]{index=7}
  { city: 'Grissom',     station: 'KGUS' },     // Grissom Air Reserve Base :contentReference[oaicite:8]{index=8}
  { city: 'Gary',        station: 'KGYY' }      // Gary/Chicago International Airport :contentReference[oaicite:9]{index=9}
];


// List of cities and their METAR station tags
const EXTRA_CITIES = [
    { city: 'Crawfordsville', station: 'KCQW' }, // Crawfordsville Airport
    { city: 'Kokomo', station: 'KOKK' },         // Kokomo Municipal Airport
    { city: 'Anderson', station: 'KAND' },       // Anderson Municipal Airport
    { city: 'Columbus', station: 'KBAK' },       // Columbus Municipal Airport
    { city: 'Logansport', station: 'KOKK' }      // Logansport Memorial Airport
];


const WEATHER_ICONS = {
    'clear': 'https://i.imgur.com/jKEHIsy.png',
    'cloudy': 'https://i.imgur.com/AcihKAW.png',
    'partly-cloudy': 'https://i.imgur.com/37bCqbo.png',
    'rain': 'https://i.imgur.com/yS8RtPE.png',
    'snow': 'https://i.imgur.com/yEu5fVZ.png',
    'thunderstorm': 'https://i.imgur.com/DG1Wz63.png',
    'fog': 'https://i.imgur.com/uwHDNIA.png'
};

let weatherIndex = 0;
const weatherCities = CITY_STATIONS.concat(EXTRA_CITIES);

// Function to convert wind direction (degrees) to cardinal direction
function getCardinalDirection(degrees) {
    if (degrees === 'N/A') return 'N/A';

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.floor((degrees + 22.5) / 45) % 8; // Adjusting for proper cardinal direction calculation
    return directions[index];
}

// Map to store weather conditions for each city
// Map to store weather conditions for each city
const weatherConditionsMap = new Map();

// Map to store weather conditions for each city
const lastFetchedData = new Map(); // Initialize the map

// Function to fetch and store the weather conditions for a city
async function fetchWeatherForCity(city, station, targetMap = lastFetchedData) {
    try {
        const resp = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`);
        if (!resp.ok) {
            if (resp.status === 404) {
                console.error(`Weather data not found for ${city} (${station}). Skipping...`);
            } else {
                throw new Error(`Network error ${resp.status}`);
            }
            return;
        }
        const json = await resp.json();
        const obs = json.properties;

        // Convert temperature from Celsius to Fahrenheit
        const tempC = obs.temperature.value;
        const tempF = tempC != null ? (tempC * 9/5 + 32).toFixed(1) : 'N/A';

        const text = obs.textDescription.toLowerCase();

        // Check if windSpeed is available and log it
        let windSpeed = 'N/A';  // Default wind speed value
        if (obs.windSpeed && obs.windSpeed.value !== undefined) {
            windSpeed = (obs.windSpeed.value * 0.621371).toFixed(0); // Convert km/h to MPH
            console.log(`Wind speed for ${city}: ${windSpeed} MPH`);  // Log the wind speed
        } else {
            console.warn(`No wind speed data for ${city}`);  // Log if no wind speed data is available
        }

        const windDirection = obs.windDirection ? obs.windDirection.value : 'N/A';
        const cardinalDirection = getCardinalDirection(windDirection);

        let iconUrl = WEATHER_ICONS.clear;
        if (text.includes('thunder')) iconUrl = WEATHER_ICONS.thunderstorm;
        else if (text.includes('rain')) iconUrl = WEATHER_ICONS.rain;
        else if (text.includes('snow')) iconUrl = WEATHER_ICONS.snow;
        else if (text.includes('fog') || text.includes('mist')) iconUrl = WEATHER_ICONS.fog;
        else if (text.includes('cloud')) iconUrl = WEATHER_ICONS.cloudy;

        // Store in the provided map
        targetMap.set(city, {
            tempF,
            text,
            iconUrl,
            windSpeed,
            cardinalDirection
        });

        console.log(`Weather data fetched for ${city} at:`, new Date());
    } catch (err) {
        console.error('Weather fetch error:', err);
    }
}




async function fetchAllWeatherData() {
    for (const { city, station } of CITY_STATIONS) {
        try {
            await fetchWeatherForCity(city, station); // Write directly into lastFetchedData
        } catch (err) {
            console.error('Weather fetch error for', city, err);
        }
    }

    console.log('Weather data fetched for all cities.');
}


// Function to update the displayed weather conditions
function updateWeatherDisplay() {
    const { city, station } = CITY_STATIONS[currentCityIndex];
    const data = lastFetchedData.get(city);

    if (data) {
        const countiesElement = document.querySelector('#counties');
        const eventTypeElement = document.querySelector('#eventType');

        const { text, tempF, windSpeed, cardinalDirection, iconUrl } = data;

        // Update weather conditions on the dashboard
        countiesElement.innerHTML = `
            <img src="${iconUrl}" alt="${text}" style="width:24px;height:24px;vertical-align:middle;">
            ${text.charAt(0).toUpperCase() + text.slice(1)}, ${tempF}\u00B0F
            | Wind: ${cardinalDirection} @ ${windSpeed} mph
        `;
        eventTypeElement.textContent = city; // Update city name in event type element
    }
}

// Function to rotate through cities without fetching new data
// Initialize currentCityIndex at the top of your script

// Ensure it's used correctly in rotateCity()
async function rotateCity() {
    if (previousWarnings.size > 0) {
        console.log('Active warnings present. Updating warning dashboard.');
        updateDashboard(); // <- Update the active warnings instead of rotating city
        return; // Skip rotating cities but still update warning info
    }

    const eventTypeBar = document.querySelector('.event-type-bar');
    const countiesElement = document.querySelector('#counties');

    if (!eventTypeBar || !countiesElement) {
        console.error('Required elements (event-type-bar or counties) not found. Cannot perform city rotation.');
        return;
    }

    // Update city index
    currentCityIndex = (currentCityIndex + 1) % CITY_STATIONS.length;

    const city = CITY_STATIONS[currentCityIndex].city;
    const station = CITY_STATIONS[currentCityIndex].station;

    eventTypeBar.textContent = city;
    eventTypeBar.style.display = 'block';

    const weatherData = lastFetchedData.get(city);

    // Only rotate if weather data is available
    if (!weatherData) {
        await fetchWeatherForCity(city, station); // Wait until data is fetched before rotating
    }

    const updatedWeatherData = lastFetchedData.get(city);
    if (updatedWeatherData) {
        countiesElement.innerHTML = `
            <img src="${updatedWeatherData.iconUrl}" alt="${updatedWeatherData.text}" style="width:24px;height:24px;vertical-align:middle;">
            ${updatedWeatherData.text.charAt(0).toUpperCase() + updatedWeatherData.text.slice(1)}, ${updatedWeatherData.tempF}\u00B0F
            | Wind: ${updatedWeatherData.cardinalDirection} @ ${updatedWeatherData.windSpeed} mph
        `;
    } else {
        console.log('Weather data still not available for city:', city);
    }

    console.log(`City changed to: ${city}`);
}



// Function to display the "No Active Warnings" dashboard with fade
function showNoWarningDashboard() {
    // Add fade-out effect to warning dashboard
    const warningBar = document.querySelector('.warning-counts');
    if (warningBar) {
        warningBar.classList.remove('show'); // Remove fade-in
        warningBar.classList.add('fade-out'); // Add fade-out
    }

    const noWarningsBar = document.querySelector('.no-warning-bar');
    if (noWarningsBar) {
        noWarningsBar.classList.remove('fade-out'); // Remove fade-out
        noWarningsBar.classList.add('fade-in'); // Add fade-in
        noWarningsBar.classList.add('show'); // Ensure it becomes visible
    }

    // Set the background color of the event-type bar to #476FB9 when no alerts are active
    document.querySelector('.event-type-bar').style.backgroundColor = '#476FB9';
}

// Function to display the warning dashboard with fade
function showWarningDashboard() {
    // Add fade-out effect to no-warning-bar and fade-in to warning dashboard
    const noWarningsBar = document.querySelector('.no-warning-bar');
    if (noWarningsBar) {
        noWarningsBar.classList.remove('show'); // Remove fade-in
        noWarningsBar.classList.add('fade-out'); // Add fade-out
    }

    const warningBar = document.querySelector('.warning-counts');
    if (warningBar) {
        warningBar.classList.remove('fade-out'); // Remove fade-out
        warningBar.classList.add('fade-in'); // Add fade-in
        warningBar.classList.add('show'); // Ensure it becomes visible
    }
}

// Function to update the dashboard with warning information
function updateDashboard() {
    const expirationElement = document.querySelector('#expiration');
    const eventTypeElement = document.querySelector('#eventType');
    const countiesElement = document.querySelector('#counties');
    const activeAlertsBox = document.querySelector('.active-alerts-box');
    const activeAlertText = document.getElementById('ActiveAlertText');

    if (!Array.isArray(activeWarnings) || activeWarnings.length === 0) {
        expirationElement.textContent = 'N/A';
        eventTypeElement.textContent = '';
        countiesElement.textContent = 'N/A';
        document.querySelector('.event-type-bar').style.backgroundColor = '#333';

        // Hide the active alerts box
        activeAlertsBox.style.display = 'none';
        // Update the ActiveAlertText
        activeAlertText.textContent = 'CURRENT CONDITIONS';

        // If there are no active warnings, show the "No Active Warnings" dashboard with fade
        showNoWarningDashboard();
        return;
    }

    // Ensure currentWarningIndex is valid
    if (typeof currentWarningIndex !== 'number' || currentWarningIndex >= activeWarnings.length) {
        currentWarningIndex = 0;
    }

    let warning = activeWarnings[currentWarningIndex];

    // Validate and find next valid warning if needed
    if (!warning || !warning.properties) {
        console.warn('⚠️ Skipping invalid warning entry:', warning);

        let validFound = false;
        let attempts = 0;
        while (attempts < activeWarnings.length) {
            currentWarningIndex = (currentWarningIndex + 1) % activeWarnings.length;
            const nextWarning = activeWarnings[currentWarningIndex];
            if (nextWarning && nextWarning.properties) {
                warning = nextWarning;
                validFound = true;
                break;
            }
            attempts++;
        }

        if (!validFound) {
            console.warn('⚠️ No valid warnings found. Falling back to current conditions.');
            activeWarnings = [];
            showNoWarningDashboard();
            return;
        }
    }

    const { event, areaDesc, expires } = warning.properties;

    const eventName = getEventName(warning);
    const alertColor = getAlertColor(eventName);

    // Change the color of the .event-type-bar
    const eventTypeBar = document.querySelector('.event-type-bar');
    if (eventTypeBar) {
        eventTypeBar.style.backgroundColor = alertColor;
    }

    const expirationDate = new Date(expires);

    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const fullOptions = {
        timeZoneName: 'short',
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };

    const formattedExpirationTime = expirationDate.toLocaleString('en-US', timeOptions);
    const fullFormattedExpirationTime = expirationDate.toLocaleString('en-US', fullOptions);
    const counties = formatCountiesTopBar(areaDesc);

    // Update UI elements
    expirationElement.textContent = `Expires: ${fullFormattedExpirationTime}`;
    eventTypeElement.textContent = eventName;
    countiesElement.textContent = `Counties: ${counties} | Until ${formattedExpirationTime}`;
    activeAlertsBox.style.display = 'block';
    activeAlertText.textContent = 'ACTIVE ALERTS';

    showWarningDashboard();

    // Advance to the next warning
    currentWarningIndex = (currentWarningIndex + 1) % activeWarnings.length;
}


let rotateActive = false;

async function startRotatingCities() {
    rotateActive = true;
    await rotateCityWithDelay(); // Start rotating cities with controlled delay
}

function stopRotatingCities() {
    rotateActive = false;  // Stop rotation by setting rotateActive to false
}

async function rotateCityWithDelay() {
    if (rotateActive) {
        await rotateCity();  // Ensure we wait until the rotation is complete
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before rotating again
        if (rotateActive) rotateCityWithDelay();  // Continue rotating after delay
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Fetch all weather data once when the page loads
    updateDashboard();
    fetchAllWeatherData();
    startRotatingCities(); // <- instead of setInterval
    // Fetch weather data every 30 minutes (30 * 60 * 1000 ms)

});

let fetchConditionsActive = false; // Track the state of the button
let fetchInterval, rotateInterval; // Store the intervals

document.getElementById('animatedToggleButton').addEventListener('click', () => {
    fetchConditionsActive = !fetchConditionsActive; // Toggle the state
    const buttonText = fetchConditionsActive ? "STOP FETCHING" : "FETCH CURRENT CONDITIONS";
    document.getElementById('animatedToggleButton').textContent = buttonText;

    // Toggle the active class for animation
    document.getElementById('animatedToggleButton').classList.toggle('active', fetchConditionsActive);

    if (fetchConditionsActive) {
        fetchInterval = setInterval(fetchAllWeatherData, 30 * 60 * 1000);
        startRotatingCities(); // <- instead of setInterval
        fetchAllWeatherData();
        updateDashboard();
    } else {
        clearInterval(fetchInterval);
        updateDashboard();
        stopRotatingCities(); // <- instead of clearInterval(rotateInterval)
    }
    
    
});


