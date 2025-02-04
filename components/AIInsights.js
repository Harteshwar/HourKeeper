import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OPENAI_API_KEY } from '@env';
import { AuthContext } from '../context/AuthContext';


const analyzeTimeData = async (logs) => {
  try {
    const timeData = logs.map(log => ({
      date: log.checkIn.toLocaleDateString(),
      checkIn: log.checkIn.toLocaleTimeString(),
      checkOut: log.checkOut?.toLocaleTimeString(),
      duration: log.checkOut ? 
        ((log.checkOut - log.checkIn) / (1000 * 60 * 60)).toFixed(2) + ' hours' : 'In progress'
    }));

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
            content: "You are a helpful time management assistant. Analyze work patterns and provide brief, practical insights."
          },
          {
            role: "user",
            content: `Analyze this time log data and provide 3 key insights about work patterns and a brief suggestion for improvement. Keep it concise and friendly: ${JSON.stringify(timeData)}`
          }
        ],
        max_tokens: 150
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI Analysis Error:', error);
    throw new Error('Failed to analyze time data');
  }
};

const AIInsights = ({ logs }) => {
  const { user } = useContext(AuthContext);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeTimeData(logs);
      setInsights(analysis);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      setError('Failed to analyze time data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!insights && !loading && (
        <TouchableOpacity 
          style={styles.analyzeButton}
          onPress={handleAnalyze}
        >
          <Ionicons name="analytics-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Analyze Work Patterns</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <ActivityIndicator size={36} color="#4c669f" style={styles.loader} />
      )}

      {insights && (
        <View style={styles.insightsContent}>
          <Text style={styles.insightsText}>{insights}</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleAnalyze}
          >
            <Ionicons name="refresh-outline" size={20} color="#4c669f" />
            <Text style={styles.refreshText}>Refresh Analysis</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 5,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4c669f',
    padding: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loader: {
    marginTop: 15,
  },
  insightsContent: {
    marginTop: 10,
  },
  insightsText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  refreshText: {
    color: '#4c669f',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
});

export default AIInsights; 