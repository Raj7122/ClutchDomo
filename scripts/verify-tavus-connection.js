// Script to verify connection to Tavus API personas endpoint
require('dotenv').config();
const fetch = require('node-fetch');

// Constants from environment
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const API_URL = 'https://tavusapi.com/v2/personas';

async function testTavusConnection() {
  console.log('=== Testing Tavus API Connection ===');
  console.log(`Attempting to connect to: ${API_URL}`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY
      }
    });

    const responseStatus = response.status;
    console.log(`Response status: ${responseStatus}`);

    if (responseStatus === 200) {
      const data = await response.json();
      console.log('✅ Connection successful!');
      
      // Log the actual structure to understand the API response format
      console.log('API Response structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
      
      // Handle different possible response formats
      let personaCount = 0;
      let personaSamples = [];
      
      if (Array.isArray(data)) {
        personaCount = data.length;
        personaSamples = data.slice(0, 2);
      } else if (data.personas && Array.isArray(data.personas)) {
        personaCount = data.personas.length;
        personaSamples = data.personas.slice(0, 2);
      } else if (data.data && Array.isArray(data.data)) {
        personaCount = data.data.length;
        personaSamples = data.data.slice(0, 2);
      }
      
      console.log(`Retrieved ${personaCount} personas`);
      
      if (personaSamples.length > 0) {
        console.log('First few personas:');
        console.log(JSON.stringify(personaSamples, null, 2));
      } else {
        console.log('No personas found in the response or empty array returned');
      }
      
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.error(`❌ API request failed with status ${responseStatus}`);
      console.error(`Error response: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('❌ Connection failed with error:');
    console.error(error.message);
    return { success: false, error: error.message };
  }
}

// Execute the test
testTavusConnection()
  .then(result => {
    if (!result.success) {
      console.log('\nTroubleshooting tips:');
      console.log('1. Verify your TAVUS_API_KEY is correct');
      console.log('2. Check your network connection');
      console.log('3. Confirm the Tavus API is operational: https://status.tavus.io/');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test execution:', err);
    process.exit(1);
  });
