/**
 * Tavus API Integration Test Script
 * 
 * This script verifies the Tavus API conversation creation with the correct payload format
 * according to the official Tavus API documentation.
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Test configuration
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TEST_PERSONA_ID = 'p7fb0be3'; // Use the persona ID from your previous API calls
const TEST_REPLICA_ID = 're1074c227'; // Use the replica ID from your previous API calls
const TAVUS_API_BASE_URL = 'https://tavusapi.com/v2';

/**
 * Verify Tavus API conversation creation with correct payload format
 */
async function testTavusConversationCreation() {
  console.log('=== Tavus API Conversation Creation Test ===\n');
  console.log('Using API base URL:', TAVUS_API_BASE_URL);

  if (!TAVUS_API_KEY) {
    console.error('❌ TAVUS_API_KEY is not set in environment variables');
    process.exit(1);
  }

  // Step 1: Get available personas to verify connection and API key
  try {
    console.log('\n[Step 1] Verifying API connection with personas endpoint...');
    
    const personasResponse = await fetch(`${TAVUS_API_BASE_URL}/personas`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY
      }
    });
    
    const personasStatus = personasResponse.status;
    console.log(`Response status: ${personasStatus}`);
    
    // Read the response body only once and store it
    let personasResponseBody;
    let personas;
    
    if (personasStatus !== 200) {
      personasResponseBody = await personasResponse.text();
      console.error(`❌ Failed to get personas: ${personasResponseBody}`);
      process.exit(1);
    } else {
      // Parse JSON only if status is successful
      personasResponseBody = await personasResponse.text();
      try {
        personas = JSON.parse(personasResponseBody);
      } catch (parseError) {
        console.error(`❌ Failed to parse personas response as JSON: ${parseError.message}`);
        console.error(`Response body: ${personasResponseBody}`);
        process.exit(1);
      }
    }
    console.log('✅ Successfully retrieved personas');
    console.log(`Found ${personas.data?.length || 0} personas\n`);
    
    // If we have personas, use the first one's ID
    const availablePersonaId = personas.data && personas.data.length > 0 
      ? personas.data[0].persona_id 
      : null;
      
    if (availablePersonaId) {
      console.log(`Using persona ID: ${availablePersonaId}`);
    }
  } catch (error) {
    console.error('❌ Error connecting to Tavus API:', error.message);
    process.exit(1);
  }

  // Step 2: Create a conversation with the correct payload format
  try {
    console.log('\n[Step 2] Creating a conversation with correct payload format...');
    
    // Format the request according to Tavus API documentation
    const conversationPayload = {
      persona_id: TEST_PERSONA_ID,
      replica_id: TEST_REPLICA_ID,
      conversation_name: `API-Test-${Date.now()}`,
      callback_url: 'http://localhost:3000/api/tavus/webhook',
      properties: {
        max_call_duration: 3600,
        participant_left_timeout: 60,
        participant_absent_timeout: 300,
        enable_recording: false
        // Removed 'language' property as it's incompatible with the default TTS engines
      }
    };
    
    console.log('Request payload:', JSON.stringify(conversationPayload, null, 2));
    
    const conversationResponse = await fetch(`${TAVUS_API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY
      },
      body: JSON.stringify(conversationPayload)
    });
    
    const conversationStatus = conversationResponse.status;
    console.log(`Response status: ${conversationStatus}`);
    
    // Read the response body only once and store it
    let responseBodyText = await conversationResponse.text();
    let responseBody;
    
    if (conversationStatus >= 400) {
      console.error(`❌ Failed to create conversation: ${responseBodyText}`);
      console.log('\nDetails to check:');
      console.log('1. Verify your API key is correct and has proper permissions');
      console.log('2. Confirm the persona_id and replica_id are valid');
      console.log('3. Make sure the payload format matches the latest API specs');
      process.exit(1);
    } else {
      // Parse JSON only if status is successful
      try {
        responseBody = JSON.parse(responseBodyText);
        console.log('✅ Successfully created conversation!');
        console.log(`Conversation ID: ${responseBody.conversation_id || responseBody.id}`);
        console.log(`Conversation URL: ${responseBody.conversation_url || responseBody.url}`);
        console.log(`\nTry accessing the conversation at: ${responseBody.conversation_url || responseBody.url}`);
      } catch (parseError) {
        console.error(`❌ Failed to parse response as JSON: ${parseError.message}`);
        console.error(`Response body: ${responseBodyText}`);
        process.exit(1);
      }
    }
    
    return responseBody;
  } catch (error) {
    console.error('❌ Error creating conversation:', error.message);
    process.exit(1);
  }
}

// Run the test
testTavusConversationCreation()
  .then(() => {
    console.log('\n✅ Test completed successfully');
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
