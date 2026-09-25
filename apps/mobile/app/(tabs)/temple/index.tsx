import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../../constants/theme';
import { Card } from '../../../components/shared/Card';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { getSiteSettings, getSettingsDocument } from '../../../services/settings.service';
import { LoadingState } from '../../../components/shared/LoadingState';
import { ErrorState } from '../../../components/shared/ErrorState';

export default function TempleScreen() {
  const { data: siteSettings, loading: sLoading, error: sError, refetch: refetchS } = useDataFetch(getSiteSettings);
  const { data: aboutUs, loading: aLoading, refetch: refetchA } = useDataFetch(() => getSettingsDocument('aboutUs'));
  const { data: guruParampara, loading: gLoading, refetch: refetchG } = useDataFetch(() => getSettingsDocument('guruParampara'));

  const loading = sLoading || aLoading || gLoading;

  const onRefresh = () => {
    refetchS();
    refetchA();
    refetchG();
  };

  if (loading && !siteSettings) return <LoadingState />;
  if (sError) return <ErrorState message="Failed to load Temple info" onRetry={onRefresh} />;

  const address = siteSettings?.address || 'Yelahanka New Town, Bengaluru, Karnataka';
  const phone = siteSettings?.contact_phone || '+918028460677';
  const email = siteSettings?.contact_email;
  const mapsLink = siteSettings?.google_maps_link || "https://maps.google.com/?q=" + encodeURIComponent(address);

  const openMap = () => Linking.openURL(mapsLink);
  const callPhone = () => Linking.openURL("tel:" + phone.replace(/[^0-9+]/g, ''));
  const sendEmail = () => email && Linking.openURL("mailto:" + email);

  const renderDescription = (text: string | undefined, defaultText: string) => {
    if (!text) return defaultText;
    // Basic clean up of HTML tags if the backend sends rich text
    return text.replace(/<[^>]*>?/gm, '');
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <MaterialCommunityIcons name="temple-hindu" size={64} color={COLORS.secondary} />
        <Text style={styles.title}>About the Temple</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <Text style={styles.description}>
            {renderDescription(aboutUs?.content, 'Sri Raghavendra Swamy Mutt is a spiritual center dedicated to Sri Raghavendra Swamy.')}
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Contact & Location</Text>
        <Card>
          <View style={styles.contactRow}>
            <MaterialCommunityIcons name="map-marker" size={24} color={COLORS.primary} />
            <View style={styles.contactDetails}>
              <Text style={styles.contactText}>{siteSettings?.temple_name || "Sri Raghavendra Swamy Mutt"}</Text>
              <Text style={styles.contactSubText}>{address}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.button} onPress={openMap}>
              <MaterialCommunityIcons name="directions" size={20} color={COLORS.surface} />
              <Text style={styles.buttonText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={callPhone}>
              <MaterialCommunityIcons name="phone" size={20} color={COLORS.primary} />
              <Text style={[styles.buttonText, { color: COLORS.primary }]}>Call</Text>
            </TouchableOpacity>

            {email ? (
              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={sendEmail}>
                <MaterialCommunityIcons name="email" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

        {guruParampara ? (
          <View>
            <Text style={styles.sectionTitle}>Guru Parampara</Text>
            <Card>
              <Text style={styles.description}>
                {renderDescription(guruParampara.content || guruParampara.description, 'The mutt follows the lineage of Sri Madhwacharya and Sri Raghavendra Swamy.')}
              </Text>
            </Card>
          </View>
        ) : null}

        <View style={{ height: SPACING.xl }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  hero: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    color: COLORS.secondary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  content: {
    padding: SPACING.md,
  },
  infoCard: {
    marginBottom: SPACING.lg,
  },
  description: {
    fontSize: 16,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  contactDetails: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  contactText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  contactSubText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 14,
  }
});
