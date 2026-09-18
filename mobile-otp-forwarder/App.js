import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  PermissionsAndroid,
  Platform,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';

export default function App() {
  const [serverUrl, setServerUrl] = useState('https://gvcworld-portal.vercel.app');
  const [isRelayActive, setIsRelayActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [logs, setLogs] = useState([]);
  const [testOtpInput, setTestOtpInput] = useState('');

  useEffect(() => {
    addLog('SYSTEM', 'GVC SMS OTP Forwarder initialized.');
    checkSmsPermission();
  }, []);

  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [
      { id: Date.now().toString() + Math.random(), time, type, message },
      ...prevLogs.slice(0, 49)
    ]);
  };

  const checkSmsPermission = async () => {
    if (Platform.OS !== 'android') {
      addLog('WARNING', 'SMS Auto-Detection requires Android operating system.');
      return;
    }

    try {
      const grantedRead = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      const grantedReceive = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      );

      if (grantedRead && grantedReceive) {
        setHasPermission(true);
        addLog('PERMISSION', 'Android SMS Read & Receive permissions granted.');
      }
    } catch (err) {
      addLog('ERROR', 'Permission check error: ' + err.message);
    }
  };

  const requestSmsPermission = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Notice', 'SMS auto-reading is supported on Android devices.');
      return;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      if (
        granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
      ) {
        setHasPermission(true);
        setIsRelayActive(true);
        addLog('PERMISSION', '✅ SMS Permissions Granted! Relay is now ACTIVE.');
        Alert.alert('Success', 'SMS Permissions granted. Auto-relay is active!');
      } else {
        setHasPermission(false);
        addLog('PERMISSION', '❌ SMS Permissions Denied by user.');
        Alert.alert('Permission Required', 'SMS permission is required to auto-detect GVC OTP codes.');
      }
    } catch (err) {
      addLog('ERROR', 'Failed to request permissions: ' + err.message);
    }
  };

  const toggleRelay = () => {
    if (!hasPermission) {
      requestSmsPermission();
      return;
    }
    const nextState = !isRelayActive;
    setIsRelayActive(nextState);
    addLog('STATUS', nextState ? '▶️ SMS Relay Activated.' : '⏸️ SMS Relay Paused.');
  };

  const forwardOtpToServer = async (otpCode, rawSmsText = '') => {
    if (!serverUrl || !serverUrl.trim()) {
      addLog('ERROR', 'Server URL is missing! Please configure Server API URL.');
      return;
    }

    const cleanBaseUrl = serverUrl.trim().replace(/\/+$/, '');
    const endpointUrl = `${cleanBaseUrl}/api/applications/submit-otp`;

    addLog('FORWARDING', `🚀 Transmitting OTP (${otpCode}) to server endpoint: ${endpointUrl}`);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GVCOtpForwarderAndroid/1.0'
        },
        body: JSON.stringify({
          otpCode: otpCode,
          source: 'ANDROID_SMS_AUTO_RELAY',
          rawMessageSnippet: rawSmsText.substring(0, 100),
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addLog('SUCCESS', `🎉 OTP (${otpCode}) injected into GVC Portal session successfully!`);
        Alert.alert('OTP Relayed', `OTP Code (${otpCode}) forwarded and injected cleanly into GVC agent!`);
      } else {
        addLog('SERVER_ERROR', `Server rejected OTP: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      addLog('NETWORK_ERROR', `Network failure forwarding OTP: ${err.message}`);
    }
  };

  const handleManualTestRelay = () => {
    if (!testOtpInput || testOtpInput.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter a valid 4-6 digit OTP code.');
      return;
    }
    const code = testOtpInput.trim();
    addLog('TEST', `Manual test trigger initiated for OTP: ${code}`);
    forwardOtpToServer(code, 'Manual Test Verification Message');
    setTestOtpInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />

      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GVC World Visa Assistant</Text>
        <Text style={styles.headerSubtitle}>Android SMS OTP Auto-Forwarder & Relay App</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Server Configuration Box */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌐 GVC Server Connection</Text>
          <Text style={styles.label}>Backend Agent API URL:</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.10:3000 or https://your-app.vercel.app"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* SMS Relay Status Card */}
        <View style={[styles.card, isRelayActive ? styles.cardActive : styles.cardInactive]}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.cardTitle}>📱 SMS Listener Status</Text>
              <Text style={styles.statusText}>
                {isRelayActive ? '🟢 ACTIVE & WATCHING SMS' : '🔴 PAUSED / INACTIVE'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnToggle, isRelayActive ? styles.btnPause : styles.btnStart]}
              onPress={toggleRelay}
            >
              <Text style={styles.btnToggleText}>
                {isRelayActive ? 'Pause' : 'Start'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.permissionInfo}>
            {hasPermission
              ? '✅ Android SMS Read/Receive Permission Authorized.'
              : '⚠️ SMS Permission required to detect GVC OTP messages automatically.'}
          </Text>

          {!hasPermission && (
            <TouchableOpacity style={styles.btnGrant} onPress={requestSmsPermission}>
              <Text style={styles.btnGrantText}>Grant Android SMS Permission</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Manual Test Relay Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚡ Test OTP Forwarding</Text>
          <Text style={styles.label}>Enter Test 6-Digit OTP Code:</Text>
          <View style={styles.testRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={testOtpInput}
              onChangeText={setTestOtpInput}
              placeholder="e.g. 583920"
              keyboardType="number-pad"
              maxLength={8}
            />
            <TouchableOpacity style={styles.btnTest} onPress={handleManualTestRelay}>
              <Text style={styles.btnTestText}>Forward</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Logs Console */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.cardTitle}>📜 Live Relay Log Console</Text>
            <TouchableOpacity onPress={() => setLogs([])}>
              <Text style={styles.clearText}>Clear Logs</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.consoleBox}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLogText}>No events recorded yet.</Text>
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
  cardActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  cardInactive: {
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#047857',
    marginTop: 2,
  },
  permissionInfo: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 10,
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
  btnToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnStart: {
    backgroundColor: '#059669',
  },
  btnPause: {
    backgroundColor: '#DC2626',
  },
  btnToggleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnGrant: {
    backgroundColor: '#4F46E5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  btnGrantText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnTest: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnTestText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  clearText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  consoleBox: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    minHeight: 180,
    maxHeight: 280,
  },
  emptyLogText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 60,
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
