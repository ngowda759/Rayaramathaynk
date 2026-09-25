import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { COLORS, SPACING } from '../../../constants/theme';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { getActiveSevas, Seva } from '../../../services/sevas.service';
import { Card } from '../../../components/shared/Card';
import { LoadingState } from '../../../components/shared/LoadingState';
import { ErrorState } from '../../../components/shared/ErrorState';

export default function SevasScreen() {
  const { data: sevas, loading, error, refetch } = useDataFetch(getActiveSevas);

  if (loading && !sevas) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load Sevas. Please try again." onRetry={refetch} />;

  const renderItem = ({ item }: { item: Seva }) => (
    <Card style={styles.sevaCard}>
      <View style={styles.header}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.amount}>₹{item.amount}</Text>
      </View>
      {item.description ? (
        <Text style={styles.description}>{item.description}</Text>
      ) : null}
      {item.timeings ? (
        <Text style={styles.timings}>Timing: {item.timeings}</Text>
      ) : null}
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sevas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No Sevas are currently available.</Text>
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
  sevaCard: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  description: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  timings: {
    fontSize: 12,
    color: COLORS.text.primary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    color: COLORS.text.secondary,
    fontSize: 16,
  }
});
