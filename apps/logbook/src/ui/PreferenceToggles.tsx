import { StyleSheet, Text, View } from 'react-native';

import { langCode } from '../i18n/strings';
import { fonts } from '../theme/tokens';
import { HeaderButton } from './HeaderButton';
import { Icon } from './Icon';
import { usePreferences, useStrings, useTheme } from './preferences';

// Night/Day and SW/EN toggles from the design's trip home header.
export function PreferenceToggles() {
  const { mode, lang, toggleMode, toggleLang } = usePreferences();
  const c = useTheme();
  const t = useStrings();
  return (
    <View style={styles.row}>
      <HeaderButton onPress={toggleMode} label={t.mode} testID="toggle-mode">
        <Icon name={mode === 'day' ? 'sun' : 'moon'} color={c.text} />
      </HeaderButton>
      <HeaderButton onPress={toggleLang} label={t.langName} testID="toggle-lang">
        <Icon name="globe" size={15} strokeWidth={2} color={c.text} />
        <Text style={[styles.code, { color: c.text }]}>{langCode[lang]}</Text>
      </HeaderButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  code: { fontFamily: fonts.monoSemiBold, fontSize: 14 },
});
