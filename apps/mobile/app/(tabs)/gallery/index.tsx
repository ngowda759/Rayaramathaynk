import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { COLORS, SPACING } from '../../../constants/theme';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { getGalleryMedia, GalleryMedia } from '../../../services/gallery.service';
import { LoadingState } from '../../../components/shared/LoadingState';
import { ErrorState } from '../../../components/shared/ErrorState';

const numColumns = 3;
const screenWidth = Dimensions.get('window').width;
const imageSize = (screenWidth - SPACING.md * 2 - SPACING.xs * (numColumns - 1)) / numColumns;

export default function GalleryScreen() {
  const { data: media, loading, error, refetch } = useDataFetch(getGalleryMedia);
  const [selectedMedia, setSelectedMedia] = useState<GalleryMedia | null>(null);

  if (loading && !media) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load gallery. Please try again." onRetry={refetch} />;

  const renderItem = ({ item }: { item: GalleryMedia }) => (
    <TouchableOpacity onPress={() => setSelectedMedia(item)} style={styles.thumbnailContainer}>
      <Image source={{ uri: item.url }} style={styles.thumbnail} resizeMode="cover" />
      {item.type === 'video' && (
        <View style={styles.videoOverlay}>
          <MaterialCommunityIcons name="play-circle" size={32} color={COLORS.surface} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No media available in gallery.</Text>
        }
      />

      <Modal
        visible={!!selectedMedia}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedMedia(null)}>
            <MaterialCommunityIcons name="close" size={32} color={COLORS.surface} />
          </TouchableOpacity>
          {selectedMedia && selectedMedia.type === 'image' && (
            <Image source={{ uri: selectedMedia.url }} style={styles.fullScreenMedia} resizeMode="contain" />
          )}
          {selectedMedia && selectedMedia.type === 'video' && (
            <Video
              source={{ uri: selectedMedia.url }}
              style={styles.fullScreenMedia}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContainer: {
    padding: SPACING.md,
  },
  columnWrapper: {
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  thumbnailContainer: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    color: COLORS.text.secondary,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: SPACING.sm,
  },
  fullScreenMedia: {
    width: '100%',
    height: '80%',
  }
});
