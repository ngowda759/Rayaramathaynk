import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebsiteSettings } from '../../lib/types';
import { useState, useEffect } from 'react';
import { fetchWebsiteSettings } from '../../lib/api';

export default function TempleScreen() {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchWebsiteSettings();
        setSettings(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const openMap = async () => {
    if (!settings?.coordinates) return;

    // Strict coordinate validation: expecting format like "13.0991,77.5878"
    const coordRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    if (!coordRegex.test(settings.coordinates)) return;

    const latLng = encodeURIComponent(settings.coordinates);
    const label = encodeURIComponent(settings.templeName || 'Temple');

    const iosUrl = `maps://0,0?q=${label}@${latLng}`;
    const androidUrl = `geo:0,0?q=${latLng}(${label})`;
    const webFallbackUrl = `https://www.google.com/maps/search/?api=1&query=${latLng}`;

    try {
      const url = Platform.OS === 'ios' ? iosUrl : androidUrl;
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(webFallbackUrl);
      }
    } catch (e) {
      console.error('Error opening map:', e);
    }
  };

  if (loading) {
     return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#800000" /></View>;
  }

  if (!settings) {
     return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Temple information is currently unavailable.</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>About the Temple</Text>
        <Text style={styles.text}>
          {settings.aboutText || 'Information unavailable.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Timings</Text>
        <View style={styles.timingRow}>
          <Ionicons name="sunny" size={20} color="#D4AF37" />
          <Text style={styles.timingText}>Morning: {settings.timings?.morning || 'Unavailable'}</Text>
        </View>
        <View style={styles.timingRow}>
          <Ionicons name="moon" size={20} color="#D4AF37" />
          <Text style={styles.timingText}>Evening: {settings.timings?.evening || 'Unavailable'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Location & Contact</Text>
        <Text style={styles.text}>{settings.templeName || 'Temple Name Unavailable'}</Text>
        <Text style={styles.text}>{settings.address || 'Address Unavailable'}</Text>
        {settings.contactPhone && <Text style={styles.text}>Phone: {settings.contactPhone}</Text>}
        {settings.contactEmail && <Text style={styles.text}>Email: {settings.contactEmail}</Text>}

        {settings.coordinates && (
          <TouchableOpacity style={styles.mapButton} onPress={openMap}>
            <Ionicons name="map" size={20} color="white" />
            <Text style={styles.mapButtonText}>Get Directions</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 }
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#800000',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10
  },
  text: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 5,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timingText: {
    fontSize: 16,
    color: '#444',
    marginLeft: 10,
  },
  mapButton: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  }
});