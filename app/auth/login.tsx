import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Link, Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { signIn, /* session will guard this screen */ } = useAuth();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });
  const insets = useSafeAreaInsets();

  // If already authenticated, redirect away from login
  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
  const validate = () => {
    const eErr = isValidEmail(email) ? null : 'Enter a valid email';
    const pErr = password.trim().length === 0 ? 'Password is required' : null;
    setEmailError(eErr);
    setPasswordError(pErr);
    return !eErr && !pErr;
  };

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!validate()) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top }]}>
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Welcome Back
          </ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            Sign in to your WorkSync account
          </ThemedText>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Email
              </ThemedText>
              <TextInput
                style={[styles.input]}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (touched.email) setEmailError(isValidEmail(v) ? null : 'Enter a valid email');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                onBlur={() => {
                  setTouched((t) => ({ ...t, email: true }));
                  setEmailError(isValidEmail(email) ? null : 'Enter a valid email');
                }}
              />
              {!!emailError && (
                <ThemedText style={styles.errorText}>{emailError}</ThemedText>
              )}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Password
              </ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (touched.password) setPasswordError(v.trim().length === 0 ? 'Password is required' : null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                onBlur={() => {
                  setTouched((t) => ({ ...t, password: true }));
                  setPasswordError(password.trim().length === 0 ? 'Password is required' : null);
                }}
              />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.passwordToggle}
                  hitSlop={8}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#687076" />
                </TouchableOpacity>
              </View>
              {!!passwordError && (
                <ThemedText style={styles.errorText}>{passwordError}</ThemedText>
              )}
            </View>

            <TouchableOpacity
              style={[styles.loginButton, (loading) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <ThemedText type="defaultSemiBold" style={styles.loginButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </ThemedText>
            </TouchableOpacity>

            <Link href="/auth/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotPassword}>
                <ThemedText type="link">Forgot Password?</ThemedText>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.signupContainer}>
            <ThemedText type="default">Don&apos;t have an account? </ThemedText>
            <Link href="/auth/signup" asChild>
              <TouchableOpacity>
                <ThemedText type="link">Sign Up</ThemedText>
              </TouchableOpacity>
            </Link>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 24,
    borderRadius: 16,
    gap: 24,
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 8,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 4,
  },
});
