import { View, ActivityIndicator, StyleSheet, ViewProps } from 'react-native';
import { COLORS } from '../../constants/theme';

export function LoadingState(props: ViewProps) {
  return (
    <View style={styles.container} {...props}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
