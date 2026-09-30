import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Seva } from '../../lib/types';

export default function SevaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [seva, setSeva] = useState<Seva | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSeva() {
      if (!id) {
        setError('Invalid Seva ID');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('sevas')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          setError('Seva not found or temporarily unavailable.');
        } else {
          setSeva(data as Seva);
        }
      } catch (e) {
        setError('Error fetching seva details.');
      } finally {
        setLoading(false);
      }
    }

    fetchSeva();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#800000" />
      </View>
    );
  }

  if (error || !seva) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || 'Seva not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{seva.title}</Text>
      <Text style={styles.amount}>₹{seva.amount}</Text>

      {seva.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{seva.description}</Text>
        </View>
      ) : null}

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          Contact temple authorities for booking and scheduling this Seva.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#800000',
    marginBottom: 8,
  },
  amount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  disclaimerBox: {
    backgroundColor: '#fff8e1',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#8a6d3b',
    textAlign: 'center',
  }
});
