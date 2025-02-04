// App.js

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Alert, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './context/AuthContext';
import AuthStack from './navigation/AuthStack';
import MainTabNavigator from './navigation/MainTabNavigator';
import { testEnvVariables } from './utils/envTest';
import { auth } from './firebase/config';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState();

  function onAuthStateChanged(user) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    async function prepare() {
      try {
        const envTest = testEnvVariables();
        if (!envTest.hasFirebaseKey || !envTest.hasOpenAIKey) {
          Alert.alert(
            'Configuration Warning',
            'Some environment variables are missing. Please check your setup.'
          );
        }
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    prepare();
    const subscriber = auth.onAuthStateChanged(onAuthStateChanged);
    return subscriber;
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4c669f" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <AuthProvider>
          {user ? <MainTabNavigator /> : <AuthStack />}
        </AuthProvider>
      </NavigationContainer>
    </View>
  );
}
