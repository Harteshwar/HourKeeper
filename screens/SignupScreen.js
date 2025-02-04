// screens/SignupScreen.js

import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
  Image,
  InteractionManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase/config';
import { AuthContext } from '../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const NAME_REGEX = /^[a-zA-Z\s]{2,50}$/;

const SignupScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirm: false
  });
  const { setUser } = React.useContext(AuthContext);

  const inputRefs = {
    email: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null)
  };

  useEffect(() => {
    const cleanup = () => {
      Keyboard.dismiss();
    };

    return cleanup;
  }, []);

  const handleInputChange = React.useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const togglePasswordVisibility = React.useCallback((field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  }, []);

  const validateInputs = React.useCallback(() => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return false;
    }

    if (!NAME_REGEX.test(formData.name.trim())) {
      Alert.alert("Error", "Please enter a valid name (letters and spaces only, 2-50 characters).");
      return false;
    }

    if (!EMAIL_REGEX.test(formData.email.trim())) {
      Alert.alert("Error", "Please enter a valid email address.");
      return false;
    }

    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      Alert.alert("Error", `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return false;
    }

    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(formData.password);
    const hasLowerCase = /[a-z]/.test(formData.password);
    const hasNumbers = /\d/.test(formData.password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
      Alert.alert(
        "Weak Password",
        "Password must contain:\n• Uppercase letter\n• Lowercase letter\n• Number\n• Special character"
      );
      return false;
    }

    return true;
  }, [formData]);

  const handleSignup = React.useCallback(async () => {
    if (loading) return;
    
    Keyboard.dismiss();

    if (!validateInputs()) return;
    
    try {
      setLoading(true);
      // Check if email already exists
      const emailCheck = await auth.fetchSignInMethodsForEmail(formData.email.trim().toLowerCase());
      if (emailCheck.length > 0) {
        Alert.alert("Error", "This email is already registered. Please login instead.");
        navigation.navigate('Login');
        return;
      }

      const userCredential = await auth.createUserWithEmailAndPassword(
        formData.email.trim().toLowerCase(),
        formData.password
      );

      // Update display name
      await userCredential.user.updateProfile({
        displayName: formData.name.trim()
      });

      // Create user document
      await db.collection('users').doc(userCredential.user.uid).set({
        displayName: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        createdAt: new Date(),
        lastLogin: new Date(),
        settings: {
          notifications: true,
          theme: 'light'
        }
      });

      setUser(userCredential.user);

    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert(
        'Signup Failed',
        error.message || 'Failed to create account'
      );
    } finally {
      setLoading(false);
    }
  }, [formData, loading, validateInputs, setUser, navigation]);

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
              <Ionicons name="person-outline" size={24} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                autoCapitalize="words"
                editable={!loading}
                maxLength={50}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color="#666" style={styles.icon} />
              <TextInput
                ref={inputRefs.email}
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => inputRefs.password.current?.focus()}
                editable={!loading}
                maxLength={50}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color="#666" style={styles.icon} />
              <TextInput
                ref={inputRefs.password}
                style={styles.input}
                placeholder="Password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry={!showPasswords.password}
                returnKeyType="next"
                onSubmitEditing={() => inputRefs.confirmPassword.current?.focus()}
                editable={!loading}
                maxLength={50}
              />
              <TouchableOpacity
                onPress={() => togglePasswordVisibility('password')}
                style={styles.eyeIcon}
                disabled={loading}
              >
                <Ionicons
                  name={showPasswords.password ? "eye-off-outline" : "eye-outline"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color="#666" style={styles.icon} />
              <TextInput
                ref={inputRefs.confirmPassword}
                style={styles.input}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                secureTextEntry={!showPasswords.confirm}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                editable={!loading}
                maxLength={50}
              />
              <TouchableOpacity
                onPress={() => togglePasswordVisibility('confirm')}
                style={styles.eyeIcon}
                disabled={loading}
              >
                <Ionicons
                  name={showPasswords.confirm ? "eye-off-outline" : "eye-outline"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signupButtonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.linkContainer}
              disabled={loading}
            >
              <Text style={styles.linkText}>Already have an account? </Text>
              <Text style={styles.link}>Login</Text>
            </TouchableOpacity>
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
  signupButton: {
    backgroundColor: '#4c669f',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signupButtonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#666',
    fontSize: 16,
  },
  link: {
    color: '#4c669f',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignupScreen;
