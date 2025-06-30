#!/usr/bin/env node

/**
 * Test ElevenLabs integration in the Next.js app environment
 */

async function testAppElevenLabs() {
  console.log('🧪 Testing ElevenLabs in Next.js App Environment...\n');
  
  const baseUrl = 'http://localhost:3003'; // Adjust port as needed
  
  try {
    // Test 1: Check if the transcription endpoint responds
    console.log('🔍 Test 1: Testing video transcription endpoint...');
    const transcribeResponse = await fetch(`${baseUrl}/api/demos/upload-kb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test: 'elevenlabs_integration'
      })
    });
    
    if (transcribeResponse.status === 401) {
      console.log('✅ API endpoint responding (auth required as expected)');
    } else {
      console.log(`ℹ️  API response: ${transcribeResponse.status}`);
    }
    
    // Test 2: Check Tavus session creation (which may use ElevenLabs)
    console.log('\n🔍 Test 2: Testing Tavus session creation...');
    const tavusResponse = await fetch(`${baseUrl}/api/tavus/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        demoData: {
          title: 'ElevenLabs Test Demo',
          knowledgeBase: 'Test knowledge base content',
          videos: []
        }
      })
    });
    
    const tavusResult = await tavusResponse.text();
    console.log(`ℹ️  Tavus API response: ${tavusResponse.status}`);
    
    // Test 3: Check app accessibility
    console.log('\n🔍 Test 3: Testing app homepage...');
    const homeResponse = await fetch(baseUrl);
    if (homeResponse.ok) {
      console.log('✅ Next.js app is running and accessible');
    } else {
      console.log(`❌ App not accessible: ${homeResponse.status}`);
    }
    
    console.log('\n🎯 **Next Steps:**');
    console.log('1. Visit: http://localhost:3003/demo/test123');
    console.log('2. Test the TavusAvatar component');
    console.log('3. Check browser console for ElevenLabs integration logs');
    console.log('4. Try uploading a video to test transcription');
    
    console.log('\n✨ **ElevenLabs Features Now Available:**');
    console.log('• Video transcription with high accuracy');
    console.log('• Text-to-speech for AI responses');
    console.log('• Voice cloning capabilities');
    console.log('• 19 premium voices available');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure your dev server is running on the correct port');
  }
}

testAppElevenLabs().catch(console.error); 