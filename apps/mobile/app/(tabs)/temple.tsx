import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TempleScreen() {
  const openMap = () => {
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const latLng = '13.0991,77.5878';
    const label = 'Sri Raghavendra Swamy Matha Yelahanka New Town';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>About the Temple</Text>
        <Text style={styles.text}>
          Sri Raghavendra Swamy Temple in Yelahanka New Town is a prominent spiritual center dedicated to Sri Guru Raghavendra Swamy. The temple serves as a hub for spiritual, cultural, and community activities, preserving the rich traditions of the Madhwa lineage.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Timings</Text>
        <View style={styles.timingRow}>
          <Ionicons name="sunny" size={20} color="#D4AF37" />
          <Text style={styles.timingText}>Morning: 6:00 AM - 12:30 PM</Text>
        </View>
        <View style={styles.timingRow}>
          <Ionicons name="moon" size={20} color="#D4AF37" />
          <Text style={styles.timingText}>Evening: 5:00 PM - 8:30 PM</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Location & Contact</Text>
        <Text style={styles.text}>Sri Raghavendra Swamy Matha</Text>
        <Text style={styles.text}>Yelahanka New Town, Bangalore</Text>

        <TouchableOpacity style={styles.mapButton} onPress={openMap}>
          <Ionicons name="map" size={20} color="white" />
          <Text style={styles.mapButtonText}>Get Directions</Text>
        </TouchableOpacity>
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
