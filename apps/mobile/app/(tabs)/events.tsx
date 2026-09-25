/* eslint-disable @typescript-eslint/no-explicit-any */
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { fetchEvents } from '../../lib/api';
import { format } from 'date-fns';

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchEvents();
        setEvents(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#800000" style={styles.loader} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => {
             const startDate = new Date(item.start_date);
             return (
              <View style={styles.card}>
                <View style={styles.dateBox}>
                  <Text style={styles.month}>{format(startDate, 'MMM')}</Text>
                  <Text style={styles.day}>{format(startDate, 'dd')}</Text>
                </View>
                <View style={styles.content}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.desc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  {item.start_time && (
                    <Text style={styles.time}>{item.start_time}</Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No upcoming events</Text>}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { marginTop: 40 },
  list: { padding: 15 },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 }
  },
  dateBox: {
    backgroundColor: '#800000',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  month: { color: 'white', fontSize: 14, textTransform: 'uppercase', fontWeight: 'bold' },
  day: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  content: {
    padding: 15,
    flex: 1,
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  desc: { fontSize: 14, color: '#666', marginBottom: 8 },
  time: { fontSize: 12, color: '#800000', fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 20, color: '#666' }
});
