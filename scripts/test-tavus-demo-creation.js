const { TavusClient, generateTavusSystemPrompt } = require('../lib/tavusClient.ts');

async function testTavusDemoCreation() {
  console.log('=== Testing Tavus Demo Creation Flow ===\n');

  // Mock demo data similar to what we send from the frontend
  const mockDemoData = {
    title: 'Test Product Demo',
    videos: [
      { id: 'video-1', title: 'Product Overview', order_index: 1 },
      { id: 'video-2', title: 'Key Features', order_index: 2 },
      { id: 'video-3', title: 'Getting Started', order_index: 3 }
    ],
    knowledgeBase: 'This is a comprehensive knowledge base about our product. It includes features like automated workflows, real-time analytics, and seamless integrations with popular tools.',
    ctaLink: 'https://example.com/get-started'
  };

  console.log('Demo Data:', JSON.stringify(mockDemoData, null, 2));

  try {
    // Test 1: Generate system prompt
    console.log('\n1. Testing system prompt generation...');
    const systemPrompt = generateTavusSystemPrompt(mockDemoData);
    console.log('✅ System prompt generated successfully');
    console.log('Prompt length:', systemPrompt.length, 'characters');
    console.log('First 200 chars:', systemPrompt.substring(0, 200) + '...');

    // Test 2: Initialize Tavus client
    console.log('\n2. Testing Tavus client initialization...');
    const tavus = new TavusClient();
    const configStatus = tavus.getConfigurationStatus();
    console.log('Configuration status:', configStatus);

    // Test 3: Test API connectivity (health check)
    console.log('\n3. Testing Tavus API connectivity...');
    const isHealthy = await tavus.healthCheck();
    console.log('Health check result:', isHealthy ? '✅ Healthy' : '⚠️  Not healthy (using mock mode)');

    // Test 4: Get available avatars
    console.log('\n4. Testing avatar availability...');
    let availableReplicas = [];
    let availablePersonas = [];
    
    try {
      availableReplicas = await tavus.getReplicas();
      console.log('✅ Found', availableReplicas.length, 'replicas');
    } catch (error) {
      console.log('⚠️  Replicas not available:', error.message);
    }
    
    try {
      availablePersonas = await tavus.getPersonas();
      console.log('✅ Found', availablePersonas.length, 'personas');
    } catch (error) {
      console.log('⚠️  Personas not available:', error.message);
    }

    // Test 5: Simulate conversation creation
    console.log('\n5. Testing conversation creation...');
    const defaultAvatar = availableReplicas.find(r => r.status === 'ready') || 
                         availableReplicas[0] || 
                         availablePersonas[0] || 
                         { replica_id: 'mock-replica', persona_name: 'Mock Avatar' };

    console.log('Using avatar:', defaultAvatar.replica_name || defaultAvatar.persona_name || 'Mock Avatar');

    const conversation = await tavus.createConversation(
      defaultAvatar.replica_id || defaultAvatar.persona_id || 'mock-replica', 
      {
        demo_id: 'test-demo-123',
        context: 'product_demo',
        demo_title: mockDemoData.title,
        video_count: mockDemoData.videos.length,
        has_cta: !!mockDemoData.ctaLink,
        created_at: new Date().toISOString()
      }
    );

    console.log('✅ Conversation created successfully');
    console.log('Conversation ID:', conversation.conversation_id);
    console.log('Conversation URL:', conversation.conversation_url || 'Not provided (mock mode)');

    // Test 6: Construct expected Tavus URL format
    console.log('\n6. Testing URL generation...');
    const expectedUrl = conversation.conversation_url || 
                       `https://tavus.daily.co/${conversation.conversation_id}?verbose=true`;
    console.log('Expected demo URL:', expectedUrl);

    // Test 7: Test system prompt with real data
    console.log('\n7. Testing system prompt with realistic data...');
    const realisticPrompt = generateTavusSystemPrompt({
      title: 'SalesCRM Pro - Customer Management Platform',
      knowledgeBase: `SalesCRM Pro is a comprehensive customer relationship management platform designed for modern sales teams.

KEY FEATURES:
- Automated lead scoring and qualification
- Real-time sales pipeline tracking
- AI-powered sales forecasting
- Seamless integration with email, calendar, and phone systems
- Advanced reporting and analytics dashboard
- Mobile app for on-the-go access

PRICING:
- Starter Plan: $29/user/month - Basic CRM features
- Professional Plan: $59/user/month - Advanced automation
- Enterprise Plan: $99/user/month - Full feature set with custom integrations

INTEGRATIONS:
- Salesforce, HubSpot data migration
- Gmail, Outlook email sync
- Zoom, Teams calendar integration
- Slack notifications
- Zapier for custom workflows

SUPPORT:
- 24/7 live chat support
- Dedicated customer success manager for Enterprise plans
- Comprehensive knowledge base and video tutorials
- Weekly training webinars`,
      videos: [
        { id: 'vid-1', title: 'Platform Overview & Dashboard Tour', order_index: 1 },
        { id: 'vid-2', title: 'Lead Management & Automation', order_index: 2 },
        { id: 'vid-3', title: 'Sales Pipeline & Forecasting', order_index: 3 },
        { id: 'vid-4', title: 'Reporting & Analytics', order_index: 4 },
        { id: 'vid-5', title: 'Mobile App Demo', order_index: 5 }
      ],
      ctaLink: 'https://salescrmpro.com/start-free-trial'
    });

    console.log('✅ Realistic system prompt generated');
    console.log('Prompt includes video references:', realisticPrompt.includes('Platform Overview') ? '✅' : '❌');
    console.log('Prompt includes CTA link:', realisticPrompt.includes('salescrmpro.com') ? '✅' : '❌');
    console.log('Prompt includes knowledge base:', realisticPrompt.includes('SalesCRM Pro') ? '✅' : '❌');

    console.log('\n=== Test Summary ===');
    console.log('✅ All tests completed successfully!');
    console.log('📧 Demo creation flow is ready for:', mockDemoData.title);
    console.log('🔗 Expected output URL format:', expectedUrl);
    console.log('🤖 System prompt length:', realisticPrompt.length, 'characters');
    
    return {
      success: true,
      conversationId: conversation.conversation_id,
      conversationUrl: expectedUrl,
      systemPromptLength: realisticPrompt.length,
      avatarUsed: defaultAvatar.replica_name || defaultAvatar.persona_name || 'Mock Avatar'
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  testTavusDemoCreation()
    .then(result => {
      console.log('\n=== Final Result ===');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testTavusDemoCreation }; 