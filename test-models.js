require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testModel(modelName) {
  console.log(`\nTesting model: ${modelName}`);
  try {
    const message = await anthropic.messages.create({
      model: modelName,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, I am working!" in exactly 5 words.'
        }
      ]
    });
    console.log(`✅ ${modelName} WORKS!`);
    console.log(`Response: ${message.content[0].text}`);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName} failed: ${error.status || error.message}`);
    return false;
  }
}

async function testAllModels() {
  console.log('=== TESTING CLAUDE SDK MODELS WITH YOUR API KEY ===');
  console.log('Using SDK: @anthropic-ai/sdk');
  console.log('API Key:', process.env.ANTHROPIC_API_KEY ? 'Found' : 'Not found');
  
  const models = [
    // Claude 3.5 models
    'claude-3-5-sonnet-20241022',    // Latest Sonnet 3.5
    'claude-3-5-sonnet-20240620',    // Previous Sonnet 3.5
    'claude-3-5-haiku-20241022',     // Haiku 3.5
    
    // Claude 3 Opus
    'claude-3-opus-20240229',         // Opus
    
    // Claude 3 Sonnet
    'claude-3-sonnet-20240229',       // Original Sonnet
    
    // Claude 3 Haiku
    'claude-3-haiku-20240307',        // Haiku (we know this works)
    
    // Older models
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2'
  ];

  const results = {};
  
  for (const model of models) {
    results[model] = await testModel(model);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== SUMMARY ===');
  const working = Object.entries(results).filter(([_, works]) => works);
  const notWorking = Object.entries(results).filter(([_, works]) => !works);
  
  console.log('\n✅ WORKING MODELS:');
  working.forEach(([model]) => console.log(`  - ${model}`));
  
  console.log('\n❌ NOT AVAILABLE:');
  notWorking.forEach(([model]) => console.log(`  - ${model}`));
  
  console.log('\n📝 RECOMMENDATION:');
  if (working.some(([m]) => m.includes('sonnet') && !m.includes('haiku'))) {
    console.log('You have access to Sonnet models! Update your code to use them.');
  } else if (working.some(([m]) => m.includes('opus'))) {
    console.log('You have access to Opus! This is the most powerful model.');
  } else {
    console.log('You only have access to Haiku. Consider upgrading your API plan for better models.');
  }
}

testAllModels().catch(console.error);