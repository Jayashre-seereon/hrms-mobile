import { Alert, Platform } from 'react-native';
/**
 * react-native-web ships Alert.alert as a no-op, so every confirm/message (sign out, delete, submit…)
 * silently did nothing in the Expo web preview. On web only, map it to the browser dialogs:
 * - 0–1 buttons → window.alert, then that button's onPress
 * - 1 action + cancel → window.confirm: OK runs the action, Cancel runs the cancel button
 * - 2+ actions  → window.prompt with a numbered list (action menus)
 * Android/iOS keep the native Alert untouched.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = Array.isArray(buttons) ? buttons : [];
    if (list.length <= 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    const cancel = list.find((b) => b?.style === 'cancel');
    const actions = list.filter((b) => b !== cancel);
    if (actions.length > 1) {
      // Action menu (e.g. branch options): pick by number.
      const menu = actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
      const answer = window.prompt(`${text}\n\n${menu}\n\nEnter a number:`);
      const picked = actions[Number(answer) - 1];
      if (picked) picked.onPress?.();
      else cancel?.onPress?.();
      return;
    }
    if (window.confirm(text)) actions[0]?.onPress?.();
    else cancel?.onPress?.();
  };
}
