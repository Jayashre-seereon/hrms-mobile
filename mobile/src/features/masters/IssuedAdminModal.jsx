import { Modal, Pressable, Text, View } from 'react-native';
import { Button, Muted } from '@/ui/components';
import { useColors } from '@/ui/theme';
/** Shows a newly issued Branch Admin login once (web: Issued credentials dialog). The password is selectable. */
export function IssuedAdminModal({ issued, onClose }) {
  const c = useColors();
  return (
    <Modal visible={!!issued} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, gap: 10 }} onPress={() => {}}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Branch admin login</Text>
          {issued?.replaced ? <Muted>The previous branch admin was deactivated.</Muted> : null}
          <Muted>Name: {issued?.name || '—'}</Muted>
          <Muted>Email: {issued?.email || '—'}</Muted>
          {issued?.temporaryPassword ? (
            <View style={{ gap: 4 }}>
              <Muted>Temporary password (shown only once):</Muted>
              <Text selectable style={{ color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: 1 }}>
                {issued.temporaryPassword}
              </Text>
            </View>
          ) : null}
          <Muted>
            {issued?.emailSent
              ? 'The login details were also emailed to the admin.'
              : 'The email could not be sent — share these details with the admin yourself.'}
          </Muted>
          <Muted>The admin must set a new password at first sign-in.</Muted>
          <Button title="Done" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
