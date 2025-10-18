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

export default function SignupScreen() {
  const { signUp, /* session will guard this screen */ } = useAuth();
  const { session } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string | null; email?: string | null; password?: string | null; confirmPassword?: string | null }>({});
  const [touched, setTouched] = useState<{ fullName: boolean; email: boolean; password: boolean; confirmPassword: boolean }>({ fullName: false, email: false, password: false, confirmPassword: false });
  const insets = useSafeAreaInsets();

  // If already authenticated, redirect away from signup
  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
  const runValidation = () => {
    const next: typeof errors = {};
    next.fullName = fullName.trim().length >= 2 ? null : 'Enter your full name';
    next.email = isValidEmail(email) ? null : 'Enter a valid email';
    next.password = password.length >= 6 ? null : 'Password must be at least 6 characters';
    next.confirmPassword = password === confirmPassword && confirmPassword.length > 0 ? null : 'Passwords must match';
    setErrors(next);
    return !next.fullName && !next.email && !next.password && !next.confirmPassword;
  };

  const handleSignup = async () => {
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    if (!runValidation()) return;

    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);

    if (error) {
      Alert.alert('Signup Error', error.message);
    } else {
      Alert.alert(
        'Success',
        'Employee account created successfully! Please check your email to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/login'),
          },
        ]
      );
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
            Create Account
          </ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            Join WorkSync to manage your shifts
          </ThemedText>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Full Name
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  if (touched.fullName) setErrors((e) => ({ ...e, fullName: v.trim().length >= 2 ? null : 'Enter your full name' }));
                }}
                autoCapitalize="words"
                onBlur={() => {
                  setTouched((t) => ({ ...t, fullName: true }));
                  setErrors((e) => ({ ...e, fullName: fullName.trim().length >= 2 ? null : 'Enter your full name' }));
                }}
              />
              {!!errors.fullName && <ThemedText style={styles.errorText}>{errors.fullName}</ThemedText>}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Email
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (touched.email) setErrors((e) => ({ ...e, email: isValidEmail(v) ? null : 'Enter a valid email' }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                onBlur={() => {
                  setTouched((t) => ({ ...t, email: true }));
                  setErrors((e) => ({ ...e, email: isValidEmail(email) ? null : 'Enter a valid email' }));
                }}
              />
              {!!errors.email && <ThemedText style={styles.errorText}>{errors.email}</ThemedText>}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Password
              </ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                placeholder="Create a password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (touched.password) setErrors((e) => ({ ...e, password: v.length >= 6 ? null : 'Password must be at least 6 characters' }));
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                onBlur={() => {
                  setTouched((t) => ({ ...t, password: true }));
                  setErrors((e) => ({ ...e, password: password.length >= 6 ? null : 'Password must be at least 6 characters' }));
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
              {!!errors.password && <ThemedText style={styles.errorText}>{errors.password}</ThemedText>}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Confirm Password
              </ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                placeholder="Confirm your password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (touched.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: password === v && v.length > 0 ? null : 'Passwords must match' }));
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                onBlur={() => {
                  setTouched((t) => ({ ...t, confirmPassword: true }));
                  setErrors((e) => ({ ...e, confirmPassword: password === confirmPassword && confirmPassword.length > 0 ? null : 'Passwords must match' }));
                }}
              />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowConfirmPassword((s) => !s)}
                  style={styles.passwordToggle}
                  hitSlop={8}
                >
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#687076" />
                </TouchableOpacity>
              </View>
              {!!errors.confirmPassword && <ThemedText style={styles.errorText}>{errors.confirmPassword}</ThemedText>}
            </View>

            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <ThemedText type="defaultSemiBold" style={styles.signupButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.loginContainer}>
            <ThemedText type="default">Already have an account? </ThemedText>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <ThemedText type="link">Sign In</ThemedText>
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
  signupButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  loginContainer: {
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
