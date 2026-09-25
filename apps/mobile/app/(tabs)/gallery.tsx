/* eslint-disable @typescript-eslint/no-explicit-any */
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useState, useEffect } from 'react';
import { fetchGalleryAlbums } from '../../lib/api';

export default function GalleryScreen() {
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchGalleryAlbums();
        setAlbums(data || []);
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
          data={albums}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <View style={styles.album}>
              <Text style={styles.title}>{item.title}</Text>
              <FlatList
                horizontal
                data={item.gallery_media}
                keyExtractor={(media) => media.id}
                showsHorizontalScrollIndicator={false}
                renderItem={({item: media}) => (
                  <Image
                    source={{ uri: media.url }}
                    style={styles.image}
                    contentFit="cover"
                    transition={500} alt={media.title || "Gallery Image"}
                  />
                )}
                ListEmptyComponent={<Text style={styles.empty}>No images yet</Text>}
              />
            </View>
          )}
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
  album: { marginBottom: 25 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#800000', marginBottom: 10 },
  image: { width: 150, height: 150, borderRadius: 8, marginRight: 10, backgroundColor: '#e0e0e0' },
  empty: { color: '#666', fontStyle: 'italic' }
});
