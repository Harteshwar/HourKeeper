import { FIREBASE_API_KEY, OPENAI_API_KEY } from '@env';

export const testEnvVariables = () => {
  console.log('Testing environment variables...');
  if (!FIREBASE_API_KEY) console.warn('Firebase API key not found');
  if (!OPENAI_API_KEY) console.warn('OpenAI API key not found');
  
  return {
    hasFirebaseKey: !!FIREBASE_API_KEY,
    hasOpenAIKey: !!OPENAI_API_KEY,
  };
}; 