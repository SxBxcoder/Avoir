import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkGeminiAccess() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  console.log('\n🔍 DIAGNOSTIC TEST FOR GEMINI KEY');
  console.log('-----------------------------------');

  if (!apiKey) {
    console.error('❌ FATAL: No API Key found in .env.local');
    return;
  }

  console.log(`🔑 Key found: ${apiKey.substring(0, 8)}...`);
  console.log('📡 Contacting Google Servers...');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("Hello");
    const response = await result.response;

    console.log('✅ SUCCESS! Your API Key works perfectly.');
    console.log(`🤖 Gemini says: "${response.text()}"`);
  } catch (error) {
    console.error('❌ FAILURE: Your Key is blocked from this model.');
    console.error(`⚠️ Error Message: ${error.message}`);

    if (error.message.includes('404')) {
      console.log('\n🔎 ROOT CAUSE: Your Google Cloud Project is restricted.');
      console.log('🛠️ FIX: Go to https://aistudio.google.com/app/apikey and create a key in a NEW Project.');
    }
  }
}

checkGeminiAccess();
