import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../../constants/theme';
import { Card } from '../../../components/shared/Card';

export default function TempleScreen() {
  const openMap = () => {
    Linking.openURL('https://maps.google.com/?q=Sri+Raghavendra+Swamy+Mutt+Yelahanka+New+Town');
  };

  const callPhone = () => {
    Linking.openURL('tel:+918028460677'); // Example placeholder, modify if real exists
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="temple-hindu" size={64} color={COLORS.secondary} />
        <Text style={styles.title}>About the Temple</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <Text style={styles.description}>
            Sri Raghavendra Swamy Mutt, Yelahanka New Town is a spiritual center dedicated to Sri Raghavendra Swamy. It serves the local community with daily poojas, special sevas, and spiritual guidance based on Madhwa philosophy.
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Contact & Location</Text>
        <Card>
          <View style={styles.contactRow}>
            <MaterialCommunityIcons name="map-marker" size={24} color={COLORS.primary} />
            <View style={styles.contactDetails}>
              <Text style={styles.contactText}>Sri Raghavendra Swamy Mutt</Text>
              <Text style={styles.contactSubText}>Yelahanka New Town, Bengaluru, Karnataka</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.button} onPress={openMap}>
              <MaterialCommunityIcons name="directions" size={20} color={COLORS.surface} />
              <Text style={styles.buttonText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={callPhone}>
              <MaterialCommunityIcons name="phone" size={20} color={COLORS.primary} />
              <Text style={[styles.buttonText, { color: COLORS.primary }]}>Call Us</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Guru Parampara</Text>
        <Card>
          <Text style={styles.description}>
            The mutt strictly follows the lineage of Sri Madhwacharya and the illustrious Guru Parampara leading to Sri Raghavendra Swamiji, maintaining authentic traditional practices.
          </Text>
        </Card>

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
