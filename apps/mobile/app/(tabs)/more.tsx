import { View, Text, StyleSheet, TouchableOpacity, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function MoreScreen() {
  const openWeb = () => Linking.openURL('https://www.srsmathaynk.com');
  const openPrivacy = () => Linking.openURL('https://www.srsmathaynk.com/privacy-policy');

  const shareApp = async () => {
    try {
      await Share.share({
        message: 'Download the Sri Raghavendra Swamy Temple app: https://www.srsmathaynk.com',
      });
    } catch (error: any) {
      console.error(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={openWeb}>
          <Ionicons name="globe-outline" size={24} color="#800000" />
          <Text style={styles.menuText}>Visit Website</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={shareApp}>
          <Ionicons name="share-social-outline" size={24} color="#800000" />
          <Text style={styles.menuText}>Share App</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={openPrivacy}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#800000" />
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>App Version {Constants.expoConfig?.version || '1.0.0'}</Text>
        <Text style={styles.copyright}>© Sri Raghavendra Swamy Matha</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  version: {
    color: '#888',
    marginBottom: 5,
  },
  copyright: {
    color: '#aaa',
    fontSize: 12,
  }
});
