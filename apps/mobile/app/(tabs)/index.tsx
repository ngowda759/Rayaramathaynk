import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { fetchDailyPoojas } from '../../lib/api';

export default function HomeScreen() {
  const [poojas, setPoojas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDailyPoojas();
        setPoojas(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Sri Raghavendra Swamy Temple</Text>
        <Text style={styles.heroSubtitle}>Yelahanka New Town</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Poojas</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#800000" />
        ) : (
          poojas.map((pooja: any) => (
            <View key={pooja.id} style={styles.poojaRow}>
              <Text style={styles.poojaTime}>{pooja.time}</Text>
              <Text style={styles.poojaName}>{pooja.title}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Darshan Timings</Text>
        <Text style={styles.text}>Morning: 6:00 AM - 12:30 PM</Text>
        <Text style={styles.text}>Evening: 5:00 PM - 8:30 PM</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  hero: {
    backgroundColor: '#800000',
    padding: 40,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#D4AF37',
  },
  heroTitle: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSubtitle: {
    color: '#FFFDD0',
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    padding: 20,
    backgroundColor: 'white',
    margin: 15,
    marginBottom: 0,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#800000',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  text: {
    fontSize: 16,
    color: '#444',
    lineHeight: 28,
  },
  poojaRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  poojaTime: {
    width: 80,
    color: '#D4AF37',
    fontWeight: 'bold',
  },
  poojaName: {
    flex: 1,
    color: '#333',
    fontSize: 15,
  }
});
