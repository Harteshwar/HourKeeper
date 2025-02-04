import { OPENAI_API_KEY } from '@env';

export const analyzeWorkPattern = async (logs, currentSession) => {
  try {
    // Prepare data for analysis
    const workData = logs.map(log => ({
      date: log.checkIn.toLocaleDateString(),
      duration: log.checkOut ? 
        ((log.checkOut - log.checkIn) / (1000 * 60 * 60)).toFixed(2) : 
        ((new Date() - log.checkIn) / (1000 * 60 * 60)).toFixed(2),
      breaks: log.breaks?.map(b => ({
        duration: b.endTime ? 
          ((b.endTime - b.startTime) / (1000 * 60)).toFixed(0) : 
          'ongoing',
        type: b.isPaid ? 'paid' : 'unpaid'
      }))
    }));

    // Current session data
    const currentWorkDuration = currentSession ? 
      ((new Date() - currentSession.checkIn) / (1000 * 60 * 60)).toFixed(2) : 
      0;

    // Prepare prompt for OpenAI
    const prompt = {
      role: "system",
      content: `You are a smart work-break advisor. Analyze this work pattern and current session to suggest when the user should take their next break. Consider:
        - Typical work patterns
        - Time since last break
        - Current session duration
        - Health and productivity factors
        Keep suggestions brief, friendly, and specific.`
    };

    const userPrompt = {
      role: "user",
      content: `Work history: ${JSON.stringify(workData)}
        Current session duration: ${currentWorkDuration} hours
        Based on this data, when should I take my next break and why? 
        Keep the response under 2 sentences and be specific about timing.`
    };

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [prompt, userPrompt],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('Break analysis error:', error);
    return null;
  }
}; 