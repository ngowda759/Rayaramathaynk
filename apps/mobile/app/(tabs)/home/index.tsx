import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { COLORS, SPACING } from '../../../constants/theme';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { getTodayPanchanga } from '../../../services/panchanga.service';
import { getActiveAnnouncements } from '../../../services/announcements.service';
import { Card } from '../../../components/shared/Card';
import { LoadingState } from '../../../components/shared/LoadingState';

export default function HomeScreen() {
  const { data: panchanga, loading: pLoading, refetch: refetchP } = useDataFetch(getTodayPanchanga);
  const { data: announcements, loading: aLoading, refetch: refetchA } = useDataFetch(getActiveAnnouncements);

  const refreshing = pLoading || aLoading;

  const onRefresh = () => {
    refetchP();
    refetchA();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Sri Raghavendra Swamy Mutt</Text>
        <Text style={styles.subtitle}>Yelahanka New Town</Text>
      </View>

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          {announcements.map((ann) => (
            <Card key={ann.id} style={styles.announcementCard}>
              <Text style={styles.announcementTitle}>{ann.title}</Text>
              <Text style={styles.announcementContent}>{ann.content}</Text>
            </Card>
          ))}
        </View>
      )}

      {/* Panchanga */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Panchanga</Text>
        {pLoading ? (
          <LoadingState />
        ) : panchanga ? (
          <Card>
            <View style={styles.row}><Text style={styles.label}>Tithi:</Text><Text style={styles.value}>{panchanga.tithi}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Nakshatra:</Text><Text style={styles.value}>{panchanga.nakshatra}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Yoga:</Text><Text style={styles.value}>{panchanga.yoga}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Sunrise:</Text><Text style={styles.value}>{panchanga.sunrise}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Sunset:</Text><Text style={styles.value}>{panchanga.sunset}</Text></View>
          </Card>
        ) : (
          <Card><Text style={styles.emptyText}>Panchanga details will be updated shortly.</Text></Card>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Temple Timings</Text>
        <Card>
          <View style={styles.row}><Text style={styles.label}>Morning:</Text><Text style={styles.value}>7:00 AM - 12:30 PM</Text></View>
          <View style={styles.row}><Text style={styles.label}>Evening:</Text><Text style={styles.value}>5:30 PM - 8:30 PM</Text></View>
        </Card>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: SPACING.lg,
  },
  title: {
    color: COLORS.secondary,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.surface,
    fontSize: 16,
    marginTop: SPACING.xs,
  },
  section: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: 16,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  announcementCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  announcementContent: {
    fontSize: 14,
    color: COLORS.text.secondary,
  }
});
