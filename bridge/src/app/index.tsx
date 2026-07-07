import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  BackHandler,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gps_receiver_device';

export default function App() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Loading...');
  const [isDeepLink, setIsDeepLink] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setIsDeepLink(true);
        await handleDeepLinkLaunch(initialUrl);
        return;
      }

      const subscription = Linking.addEventListener('url', async (event) => {
        if (event.url) {
          setIsDeepLink(true);
          await handleDeepLinkLaunch(event.url);
        }
      });

      setIsDeepLink(false);
      await loadConfiguration();
      
      return () => subscription.remove();
    };

    init();
  }, []);

  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const loadConfiguration = async () => {
    setLoading(true);
    setStatusMessage('Scanning paired devices...');
    
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      setStatusMessage('Bluetooth permission denied.');
      setLoading(false);
      return;
    }

    try {
      const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!isEnabled) {
        setStatusMessage('Please enable Bluetooth on your device.');
        setLoading(false);
        return;
      }

      const savedAddress = await AsyncStorage.getItem(STORAGE_KEY);
      setSelectedAddress(savedAddress);

      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      setDevices(pairedDevices);
      setStatusMessage('');
    } catch (error) {
      console.log('Error loading devices:', error);
      setStatusMessage('Failed to scan devices.');
    } finally {
      setLoading(false);
    }
  };

  const selectDevice = async (device: BluetoothDevice) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, device.address);
      setSelectedAddress(device.address);
      Alert.alert(
        'Success',
        `Device "${device.name}" set as default receiver!`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save configuration.');
    }
  };

  const handleDeepLinkLaunch = async (url: string) => {
    setLoading(true);
    setStatusMessage('Transmitting route via Bluetooth...');

    try {
      const savedAddress = await AsyncStorage.getItem(STORAGE_KEY);
      if (!savedAddress) {
        Alert.alert(
          'Configuration Required',
          'Please open the app directly first and select a receiver device.'
        );
        setLoading(false);
        return;
      }

      const bluetoothLigado = await RNBluetoothClassic.isBluetoothEnabled();
      if (!bluetoothLigado) {
        Alert.alert('Error', 'Please turn on Bluetooth!');
        BackHandler.exitApp();
        return;
      }

      console.log(`Connecting to receiver (${savedAddress})...`);
      const conectado = await RNBluetoothClassic.connectToDevice(savedAddress);
      
      if (conectado) {
        console.log('Connected! Sending route...');
        await RNBluetoothClassic.writeToDevice(savedAddress, url + '\n');
        console.log('Route sent successfully!');
      } else {
        Alert.alert('Error', 'Failed to connect to receiver device.');
      }
    } catch (error) {
      console.log('Bluetooth transmission error:', error);
      Alert.alert('Transmission Error', 'Failed to send data to the receiver.');
    } finally {
      setTimeout(() => {
        BackHandler.exitApp();
      }, 1500);
    }
  };

  if (isDeepLink) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F0FF" />
        <Text style={[styles.statusText, { marginTop: 20 }]}>{statusMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>GPSBridge</Text>
        <Text style={styles.subtitle}>Select the receiver device for navigation</Text>
      </View>

      {statusMessage ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#00F0FF" />
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.address}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = item.address === selectedAddress;
            return (
              <TouchableOpacity
                style={[styles.deviceItem, isSelected && styles.deviceItemSelected]}
                onPress={() => selectDevice(item)}
                activeOpacity={0.7}
              >
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, isSelected && styles.deviceNameSelected]}>
                    {item.name || 'Unnamed Device'}
                  </Text>
                  <Text style={styles.deviceAddress}>{item.address}</Text>
                </View>
                {isSelected ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No paired Bluetooth devices found.</Text>
          }
        />
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={loadConfiguration} activeOpacity={0.8}>
        <Text style={styles.refreshButtonText}>Refresh List</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00F0FF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 240, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 13,
    color: '#7E8B9B',
    marginTop: 6,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBox: {
    backgroundColor: '#131B2E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E2D4A',
  },
  statusText: {
    color: '#7E8B9B',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  loaderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: 20,
  },
  deviceItem: {
    backgroundColor: '#131B2E',
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2D4A',
  },
  deviceItemSelected: {
    borderColor: '#00F0FF',
    backgroundColor: '#16253D',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  deviceNameSelected: {
    color: '#00F0FF',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#576575',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  activeBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  activeBadgeText: {
    color: '#00F0FF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  emptyText: {
    color: '#576575',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#00F0FF',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshButtonText: {
    color: '#0A0E1A',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});