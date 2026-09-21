import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';

export default function App() {
  const [serverUrl, setServerUrl] = useState('https://gvcworld-portal.vercel.app');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [logs, setLogs] = useState([
    {
      id: '1',
      time: new Date().toLocaleTimeString(),
      type: 'SYSTEM',
      message: 'GVC Manual OTP Assistant initialized.'
    }
  ]);

  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [
      { id: Date.now().toString() + Math.random(), time, type, message },
      ...prevLogs.slice(0, 49)
    ]);
  };

  const submitOtpToServer = async () => {
    if (!otpCodeInput || otpCodeInput.trim().length < 4) {
      Alert.alert('Invalid Input', 'Please enter a valid verification code (4-8 digits).');
      return;
    }

    if (!serverUrl || !serverUrl.trim()) {
      Alert.alert('Missing URL', 'Please enter your backend API URL.');
      return;
    }

    const cleanCode = otpCodeInput.trim();
    const cleanBaseUrl = serverUrl.trim().replace(/\/+$/, '');
    const endpointUrl = `${cleanBaseUrl}/api/applications/submit-otp`;

    addLog('SUBMITTING', `Sending OTP (${cleanCode}) to backend: ${endpointUrl}`);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GVCOtpAssistantAndroid/1.0'
        },
        body: JSON.stringify({
          otpCode: cleanCode,
          source: 'MANUAL_USER_ENTRY',
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addLog('SUCCESS', `✅ OTP (${cleanCode}) submitted successfully!`);
        Alert.alert('Success', `Verification code (${cleanCode}) submitted cleanly to backend agent.`);
        setOtpCodeInput('');
      } else {
        addLog('SERVER_ERROR', `Server response: ${data.error || 'Request processed with notice'}`);
        Alert.alert('Notice', data.error || 'OTP received by backend.');
        setOtpCodeInput('');
      }
    } catch (err) {
      addLog('NETWORK_ERROR', `Network error: ${err.message}`);
      Alert.alert('Network Error', `Could not reach backend server at ${endpointUrl}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />

      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GVC Verification Assistant</Text>
        <Text style={styles.headerSubtitle}>Manual OTP Entry & Status Monitor</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Server Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌐 Backend Connection</Text>
          <Text style={styles.label}>Server API Endpoint:</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://your-backend-domain.com"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Manual OTP Entry Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔑 Verification Code Entry</Text>
          <Text style={styles.label}>Enter Code Received on Mobile:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }]}
              value={otpCodeInput}
              onChangeText={setOtpCodeInput}
              placeholder="e.g. 583920"
              keyboardType="number-pad"
              maxLength={8}
            />
            <TouchableOpacity style={styles.btnSubmit} onPress={submitOtpToServer}>
              <Text style={styles.btnSubmitText}>Submit OTP</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activity Logs */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.cardTitle}>📜 Submission Log</Text>
            <TouchableOpacity onPress={() => setLogs([])}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.consoleBox}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLogText}>No submission events recorded.</Text>
            ) : (
              logs.map((item) => (
                <View key={item.id} style={styles.logItem}>
                  <Text style={styles.logTime}>[{item.time}]</Text>
                  <Text style={styles.logTag}>[{item.type}]</Text>
                  <Text style={styles.logMessage}>{item.message}</Text>
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#059669',
    padding: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#D1FAE5',
    fontSize: 12,
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnSubmit: {
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  clearText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: 'bold',
  },
  consoleBox: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    minHeight: 160,
    maxHeight: 260,
  },
  emptyLogText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 50,
  },
  logItem: {
    marginBottom: 6,
  },
  logTime: {
    color: '#6EE7B7',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logTag: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: 'bold',
  },
  logMessage: {
    color: '#F3F4F6',
    fontSize: 11,
  },
});
