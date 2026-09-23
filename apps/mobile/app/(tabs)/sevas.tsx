import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { fetchSevas } from '../../lib/api';

export default function SevasScreen() {
  const [sevas, setSevas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSevas();
        setSevas(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = sevas.filter(s =>
    s.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search sevas..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#800000" style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              {item.description && <Text style={styles.desc}>{item.description}</Text>}
              <Text style={styles.amount}>₹{item.amount}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No sevas found</Text>}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { marginTop: 40 },
  searchContainer: { padding: 15, backgroundColor: 'white' },
  searchInput: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    fontSize: 16
  },
  list: { padding: 15 },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 }
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#800000' },
  desc: { fontSize: 14, color: '#666', marginTop: 5 },
  amount: { fontSize: 16, fontWeight: 'bold', color: '#D4AF37', marginTop: 8 },
  empty: { textAlign: 'center', marginTop: 20, color: '#666' }
});
