import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { WebsiteSettings, Seva, Pooja, Event, Album } from '../../lib/types';
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

  const openMap = () => {
    if (!settings?.location_lat || !settings?.location_lng) return;

    const lat = Number(settings.location_lat);
    const lng = Number(settings.location_lng);

    // Strict coordinate bounds validation
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn('Invalid coordinates provided for map fallback');
      return;
    }

    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(settings.temple_name || 'Sri Raghavendra Swamy Temple');

    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Safe fallback to web browser Google Maps
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
        }
      });
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