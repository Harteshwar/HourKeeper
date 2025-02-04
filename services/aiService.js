// services/aiService.js

import { OPENAI_API_KEY } from '@env';

export const analyzeTimeData = async (timeData) => {
  try {
    const prompt = `Analyze this time log data and provide insights about:
      1. Work patterns
      2. Productivity trends
      3. Brief suggestions for better time management
      Time logs: ${JSON.stringify(timeData)}
      Keep the response concise and friendly.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant analyzing work patterns and providing insights."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI');
    }
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI Analysis Error:', error);
    throw new Error('Failed to analyze time data');
  }
};

export const getBreakSuggestion = async (duration) => {
  try {
    const prompt = `I've been working for ${duration} minutes. Suggest a quick break activity.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful wellness assistant providing break suggestions. Keep responses short and friendly."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI');
    }
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Break Suggestion Error:', error);
    throw new Error('Failed to get break suggestion');
  }
};