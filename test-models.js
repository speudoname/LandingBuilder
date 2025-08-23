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
    // Claude Opus 4 models (LATEST!)
    'claude-opus-4-1-20250805',       // Opus 4.1 - newest
    'claude-opus-4-1',                // Opus 4.1 alias
    'claude-opus-4-20250514',         // Opus 4
    'claude-opus-4-0',                // Opus 4 alias
    
    // Claude Sonnet 4 models
    'claude-sonnet-4-20250514',       // Sonnet 4
    'claude-sonnet-4-0',              // Sonnet 4 alias
    
    // Claude Sonnet 3.7
    'claude-3-7-sonnet-20250219',     // Sonnet 3.7
    'claude-3-7-sonnet-latest',       // Sonnet 3.7 alias
    
    // Claude 3.5 Haiku
    'claude-3-5-haiku-20241022',      // Haiku 3.5
    'claude-3-5-haiku-latest',        // Haiku 3.5 alias
    
    // Claude 3 Haiku
    'claude-3-haiku-20240307',        // Haiku 3 (older)
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