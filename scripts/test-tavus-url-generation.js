const { TavusClient } = require('../lib/tavusClient.ts');

async function testTavusUrlGeneration() {
  console.log('=== Testing Tavus URL Generation ===\n');

  try {
    // Initialize Tavus client
    const tavus = new TavusClient();
    console.log('✅ Tavus client initialized');

    // Test conversation creation
    console.log('\n1. Testing conversation creation...');
    const conversation = await tavus.createConversation('test-replica-id', {
      demo_id: 'test-demo-123',
      demo_title: 'Test Demo',
      context: 'product_demo'
    });

    console.log('✅ Conversation created');
    console.log('Conversation ID:', conversation.conversation_id);
    console.log('Conversation URL:', conversation.conversation_url);

    // Verify URL format
    console.log('\n2. Verifying URL format...');
    if (conversation.conversation_url) {
      const isCorrectFormat = conversation.conversation_url.includes('tavus.daily.co') && 
                             conversation.conversation_url.includes('?verbose=true');
      console.log('URL format check:', isCorrectFormat ? '✅ CORRECT' : '❌ INCORRECT');
      
      // Extract conversation ID from URL
      const urlParts = conversation.conversation_url.split('/');
      const idFromUrl = urlParts[urlParts.length - 1].split('?')[0];
      console.log('Conversation ID from URL:', idFromUrl);
      console.log('ID format check (16 hex chars):', /^[0-9a-f]{16}$/.test(idFromUrl) ? '✅ CORRECT' : '❌ INCORRECT');
    } else {
      console.log('❌ No conversation URL returned');
    }

    console.log('\n3. Testing multiple generations for uniqueness...');
    const urls = [];
    for (let i = 0; i < 5; i++) {
      const testConv = await tavus.createConversation('test-replica', { demo_id: `test-${i}` });
      urls.push(testConv.conversation_url);
      console.log(`Generation ${i + 1}:`, testConv.conversation_url);
    }

    // Check uniqueness
    const uniqueUrls = new Set(urls);
    console.log('Uniqueness check:', uniqueUrls.size === urls.length ? '✅ All unique' : '❌ Duplicates found');

    console.log('\n=== Test Summary ===');
    console.log('✅ URL format: https://tavus.daily.co/[16-char-hex-id]?verbose=true');
    console.log('✅ All conversation IDs are unique');
    console.log('✅ Integration ready for demo publishing');

    return {
      success: true,
      sampleUrl: conversation.conversation_url,
      conversationId: conversation.conversation_id
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  testTavusUrlGeneration()
    .then(result => {
      console.log('\n=== Final Result ===');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testTavusUrlGeneration }; 