// context/AuthContext.js

import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ActivityIndicator, View } from 'react-native';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

  const verifyRole = async (uid) => {
    try {
      // Check user's role in Firestore
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (userDoc.exists) {
        return userDoc.data().role;
      } else {
        // If user document doesn't exist, create it with default role
        await db.collection('users').doc(uid).set({
          role: 'employee',
          createdAt: new Date(),
          lastLogin: new Date()
        });
        return 'employee';
      }
    } catch (error) {
      console.error('Error verifying role:', error);
      return 'employee'; // Default to employee on error
    }
  };

  const updateUserRole = async (uid, newRole) => {
    try {
      await db.collection('users').doc(uid).update({
        role: newRole,
        updatedAt: new Date()
      });
      setRole(newRole);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to update user role');
      return false;
    }
  };

  // Function to update user data in Firestore
  const updateUserData = async (uid) => {
    try {
      if (!uid) return null;
      
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        // Update last login
        await userRef.update({
          lastLogin: new Date()
        });
        return { ...userDoc.data(), uid };
      }
      return null;
    } catch (error) {
      console.error('Error updating user data:', error);
      return null;
    }
  };

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const rememberedStatus = await AsyncStorage.getItem('rememberMe');
      if (savedEmail && rememberedStatus === 'true') {
        setRememberMe(true);
        // You can use this email to pre-fill the login form
        return savedEmail;
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
    return null;
  };

  // Add this function to refresh user data
  const refreshUser = async () => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      // First clear AsyncStorage
      await AsyncStorage.multiRemove(['rememberMe', 'savedEmail']);
      
      // Then sign out from Firebase
      await auth.signOut();
      
      // Finally clear local state
      setUser(null);
      setRole(null);
      setRememberMe(false);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out completely. Please try again.');
    }
  };

  const handleError = (error) => {
    console.error('Auth Error:', error);
    let message = 'An unexpected error occurred';
    
    if (error.code) {
      switch (error.code) {
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled.';
          break;
        default:
          message = error.message;
      }
    }
    
    Alert.alert('Error', message);
  };

  const handleLogin = async (user) => {
    try {
      const userData = await updateUserData(user.uid);
      setUser({ ...user, ...userData });
    } catch (error) {
      console.error('Error handling login:', error);
      // Still set the user even if getting additional data fails
      setUser(user);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size={36} color="#007aff" />
      </View>
    );
  }

  const value = {
    user,
    setUser: handleLogin,
    role,
    setRole,
    updateUserRole,
    loading,
    signOut,
    updateUserData,
    handleError,
    isAuthenticated: !!user,
    rememberMe,
    setRememberMe,
    loadSavedCredentials,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
