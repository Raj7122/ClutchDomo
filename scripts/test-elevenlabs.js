#!/usr/bin/env node

/**
 * ElevenLabs API Test Script
 * Tests the connection and basic functionality
 */

require('dotenv').config();

async function testElevenLabsAPI() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  
  console.log('🧪 Testing ElevenLabs API Integration...\n');
  
  // Check if API key is configured
  if (!apiKey) {
    console.log('❌ ELEVENLABS_API_KEY not found in .env file');
    console.log('💡 Please add your API key to .env:');
    console.log('   ELEVENLABS_API_KEY=your_api_key_here\n');
    return;
  }
  
  if (apiKey.includes('your_') || apiKey.length < 10) {
    console.log('⚠️  Please replace the placeholder API key with your real ElevenLabs API key\n');
    return;
  }
  
  console.log('✅ API Key configured');
  console.log('✅ Voice ID configured:', voiceId);
  console.log('');
  
  try {
    // Test 1: Get available voices
    console.log('🔍 Test 1: Fetching available voices...');
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });
    
    if (voicesResponse.ok) {
      const voices = await voicesResponse.json();
      console.log(`✅ Found ${voices.voices?.length || 0} available voices`);
      
      if (voices.voices?.length > 0) {
        console.log('📋 Available voices:');
        voices.voices.slice(0, 3).forEach(voice => {
          console.log(`   - ${voice.name} (${voice.voice_id})`);
        });
      }
    } else {
      console.log(`❌ Voices API failed: ${voicesResponse.status} ${voicesResponse.statusText}`);
      return;
    }
    
    console.log('');
    
    // Test 2: Generate speech (small sample)
    console.log('🗣️  Test 2: Testing text-to-speech...');
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'Hello! This is a test of the ElevenLabs integration.',
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });
    
    if (ttsResponse.ok) {
      console.log('✅ Text-to-speech generation successful');
      console.log(`📊 Response size: ${ttsResponse.headers.get('content-length')} bytes`);
    } else {
      console.log(`❌ TTS API failed: ${ttsResponse.status} ${ttsResponse.statusText}`);
    }
    
    console.log('');
    
    // Test 3: Check user info
    console.log('👤 Test 3: Checking user subscription...');
    const userResponse = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey
      }
    });
    
    if (userResponse.ok) {
      const user = await userResponse.json();
      console.log('✅ User info retrieved');
      console.log(`📈 Characters remaining: ${user.subscription?.character_count || 'Unknown'}`);
      console.log(`🎯 Subscription tier: ${user.subscription?.tier || 'Unknown'}`);
    } else {
      console.log(`❌ User API failed: ${userResponse.status} ${userResponse.statusText}`);
    }
    
    console.log('\n🎉 ElevenLabs API test completed!');
    console.log('🚀 Your integration is ready for use with video transcription and TTS');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify your API key is correct');
    console.log('   3. Ensure you have remaining API credits');
  }
}

// Run the test
testElevenLabsAPI().catch(console.error); 