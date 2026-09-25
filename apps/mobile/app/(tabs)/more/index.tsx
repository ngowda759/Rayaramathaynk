import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../../constants/theme';
import { Card } from '../../../components/shared/Card';

const MENU_ITEMS = [
  { id: 'website', icon: 'web', title: 'Visit Website', url: 'https://www.rayaramathaynk.in' },
  { id: 'contact', icon: 'email-outline', title: 'Contact Us', url: 'mailto:contact@rayaramathaynk.in' },
  { id: 'maps', icon: 'map-marker', title: 'Find Us on Maps', url: 'https://maps.google.com/?q=Sri+Raghavendra+Swamy+Mutt+Yelahanka+New+Town' },
];

export default function MoreScreen() {
  const handlePress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="om" size={48} color={COLORS.secondary} />
        <Text style={styles.title}>More</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, index < MENU_ITEMS.length - 1 && styles.borderBottom]}
              onPress={() => handlePress(item.url)}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={COLORS.primary} />
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
          ))}
        </Card>

        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
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
    color: COLORS.surface,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  content: {
    padding: SPACING.md,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuTitle: {
    fontSize: 16,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    marginTop: SPACING.xl,
    fontSize: 14,
  }
});
