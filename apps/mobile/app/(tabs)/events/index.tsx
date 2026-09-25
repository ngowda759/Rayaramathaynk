import { View, Text, StyleSheet, FlatList, RefreshControl, Image } from 'react-native';
import { format } from 'date-fns';
import { COLORS, SPACING } from '../../../constants/theme';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { getUpcomingEvents, TempleEvent } from '../../../services/events.service';
import { Card } from '../../../components/shared/Card';
import { LoadingState } from '../../../components/shared/LoadingState';
import { ErrorState } from '../../../components/shared/ErrorState';

export default function EventsScreen() {
  const { data: events, loading, error, refetch } = useDataFetch(getUpcomingEvents);

  if (loading && !events) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load events. Please try again." onRetry={refetch} />;

  const renderItem = ({ item }: { item: TempleEvent }) => (
    <Card style={styles.eventCard}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>
          {format(new Date(item.start_date), 'MMMM d, yyyy')}
          {item.end_date ? ` - ${format(new Date(item.end_date), 'MMMM d, yyyy')}` : ''}
        </Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
        ) : null}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No upcoming events found.</Text>
        }
      />
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
    paddingBottom: SPACING.xxl,
  },
  eventCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  image: {
    width: '100%',
    height: 180,
  },
  content: {
    padding: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    color: COLORS.text.secondary,
    fontSize: 16,
  }
});
