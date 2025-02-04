// screens/LoginScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  InteractionManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase/config';
import { AuthContext } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setUser } = React.useContext(AuthContext);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  
  const keyboardDidShowListener = useRef(null);
  const keyboardDidHideListener = useRef(null);

  useEffect(() => {
    if (keyboardDidShowListener.current) {
      keyboardDidShowListener.current.remove();
    }
    if (keyboardDidHideListener.current) {
      keyboardDidHideListener.current.remove();
    }

    keyboardDidShowListener.current = Keyboard.addListener('keyboardDidShow', () => {});
    keyboardDidHideListener.current = Keyboard.addListener('keyboardDidHide', () => {});

    return () => {
      if (keyboardDidShowListener.current) {
        keyboardDidShowListener.current.remove();
      }
      if (keyboardDidHideListener.current) {
        keyboardDidHideListener.current.remove();
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, [])
  );

  useEffect(() => {
    const checkSavedEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('savedEmail');
        const rememberedStatus = await AsyncStorage.getItem('rememberMe');
        if (savedEmail && rememberedStatus === 'true') {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error('Error loading saved email:', error);
      }
    };
    
    checkSavedEmail();
  }, []);

  const handleLogin = React.useCallback(async () => {
    if (loading) return;
    
    Keyboard.dismiss();
    
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await auth.signInWithEmailAndPassword(email.trim(), password);
      
      await Promise.all([
        AsyncStorage.setItem('rememberMe', rememberMe.toString()),
        rememberMe ? 
          AsyncStorage.setItem('savedEmail', email.trim()) : 
          AsyncStorage.multiRemove(['savedEmail', 'rememberMe'])
      ]);

      setUser(userCredential.user);
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Please check your credentials and try again.';
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      }
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [email, password, rememberMe, loading, setUser]);

  const handleEmailChange = React.useCallback((text) => {
    setEmail(text);
  }, []);

  const handlePasswordChange = React.useCallback((text) => {
    setPassword(text);
  }, []);

  const toggleRememberMe = React.useCallback(() => {
    setRememberMe(prev => !prev);
  }, []);

  const toggleShowPassword = React.useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.innerContainer}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.tagline}>Time Tracking Made Easy</Text>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color="#666" style={styles.icon} />
              <TextInput
                ref={emailInputRef}
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                editable={!loading}
                maxLength={50}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color="#666" style={styles.icon} />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
                maxLength={50}
              />
              <TouchableOpacity
                onPress={toggleShowPassword}
                style={styles.eyeIcon}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.rememberContainer}
              onPress={toggleRememberMe}
              disabled={loading}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}
            >
              <Text style={styles.forgotButtonText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Signup')}
                disabled={loading}
              >
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 150,
    height: 150,
  },
  tagline: {
    fontSize: 20,
    color: '#4c669f',
    marginTop: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#4c669f',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4c669f',
  },
  rememberMeText: {
    color: '#666',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#4c669f',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  forgotButtonText: {
    color: '#4c669f',
    fontSize: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: '#666',
    fontSize: 16,
  },
  signupLink: {
    color: '#4c669f',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
