import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

export default function App() {
  const [status, setStatus] = useState('Initializing Bluetooth...');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const startBluetoothServer = async () => {
      try {
        setStatus('Checking Bluetooth status...');
        const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
        if (!isEnabled) {
          setStatus('❌ Enable Bluetooth on this device!');
          setIsActive(false);
          return;
        }

        while (true) {
          setStatus('📡 Waiting for transmitter...');
          setIsActive(false);
          
          const device = await RNBluetoothClassic.accept({
            serviceName: 'GeoPipeServer',
            delimiter: '\n',
            secureSocket: true,
          });
          
          if (device) {
            setStatus(`🔗 Connected to: ${device.name}`);
            setIsActive(true);
            
            while (await device.isConnected()) {
              const available = await device.available();
              if (available > 0) {
                const data = await device.read();
                if (data) {
                  let url = data.trim();
                  console.log("📍 GPS link received via P2P:", url);
                  
                  if (url.startsWith('gpsbridge://maps')) {
                    url = url.replace('gpsbridge://maps', 'https://maps.google.com/');
                  } else if (url.startsWith('gpsbridge://')) {
                    url = url.replace('gpsbridge://', 'https://');
                  }

                  setStatus("🚀 Opening Google Maps...");
                  
                  try {
                    await Linking.openURL(url);
                  } catch (err) {
                    console.log("❌ Error opening URL on receiver:", err);
                    setStatus("❌ Unsupported link format");
                  }
                }
              }
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            setStatus('📡 Connection closed. Reconnecting...');
            setIsActive(false);
          }
        }

      } catch (error) {
        console.log("❌ Bluetooth server error:", error);
        setStatus('❌ Server error. Restarting...');
        setIsActive(false);
      }
    };

    startBluetoothServer();

    return () => {
      RNBluetoothClassic.cancelAccept().catch(err => 
        console.log("Error canceling accept:", err)
      );
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={isActive ? '#00FF66' : '#00F0FF'} />
        <Text style={styles.title}>GPSReciever 🏍️</Text>
        <View style={[styles.statusBadge, isActive && styles.statusBadgeActive]}>
          <Text style={[styles.statusText, isActive && styles.statusTextActive]}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#131B2E',
    padding: 30,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 15,
    letterSpacing: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00F0FF',
    marginTop: 10,
    width: '100%',
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(0, 255, 102, 0.1)',
    borderColor: '#00FF66',
  },
  statusText: {
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: '#00FF66',
  },
});