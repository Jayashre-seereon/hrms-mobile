import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Alert, View } from 'react-native';
import { getMyDocuments, resolveApiUrl } from '@/api/documents';
import { errorMessage } from '@/lib/api';
import { Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Header, ItemCard, QueryList } from '@/ui/kit';
export default function DocumentsScreen() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['documents', 'mine'], queryFn: getMyDocuments });
  // view_url is signed (~15 min), so the list is refetched right before every preview (same as the web).
  const open = async (doc) => {
    try {
      const fresh = await qc.fetchQuery({ queryKey: ['documents', 'mine'], queryFn: getMyDocuments, staleTime: 0 });
      const current = fresh.find((d) => d.document_type === doc.document_type) ?? doc;
      const url = resolveApiUrl(current.view_url);
      if (!url) return Alert.alert('Documents', 'This document is not available to preview.');
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert('Documents', errorMessage(e, 'Could not load the document.'));
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="My documents" />
      <QueryList
        query={query}
        keyOf={(d, i) => String(d.document_type ?? d.file_name ?? i)}
        empty="No documents uploaded yet."
        header={<Muted>Documents on your employee record. Tap one to open it.</Muted>}
        renderItem={(d) => (
          <ItemCard
            title={d.label || d.document_type || 'Document'}
            lines={[d.file_name, d.uploaded_at ? `Uploaded ${fmtDate(d.uploaded_at)}` : null]}
            onPress={() => open(d)}
          />
        )}
      />
    </View>
  );
}
