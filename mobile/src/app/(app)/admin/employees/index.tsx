import { useInfiniteQuery } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { personName } from '@/api/admin/common';
import { getEmployees } from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Badge, Header, ItemCard, Segments } from '@/ui/kit';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';

const PAGE_SIZE = 20;

export default function EmployeesScreen() {
  const router = useRouter();
    const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  // Debounce the search box like the web list.
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const q = useInfiniteQuery({
    queryKey: ['admin', 'employees', search, status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getEmployees({ page: pageParam, limit: PAGE_SIZE, search, status: status === 'all' ? '' : status }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      if (last.items.length < PAGE_SIZE) return undefined;
      if (last.total != null && loaded >= last.total) return undefined;
      return last.page + 1;
    },
  });

  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Employees" />
      <FlatList
        data={rows}
        keyExtractor={(e: any, i) => String(e.id ?? i)}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); }} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <CompanyScopeNotice />
            <Field label="Search" value={text} onChangeText={setText} placeholder="Name, email or employee ID" autoCapitalize="none" />
            <Segments
              value={status}
              onChange={setStatus}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Active', value: 'Active' },
                { label: 'Inactive', value: 'Inactive' },
              ]}
            />
            {total != null ? <Muted>{total} employee{total === 1 ? '' : 's'}</Muted> : null}
          </View>
        }
        renderItem={({ item: e }) => (
          <ItemCard
            title={personName(e) || 'Employee'}
            badge={<Badge label={e.status ?? (e.is_active === false ? 'Inactive' : null)} />}
            lines={[
              [e.employee_code, e.designation].filter(Boolean).join(' · '),
              [e.department, e.branch_name ?? e.branch].filter(Boolean).join(' · '),
              e.work_email,
            ]}
            onPress={() => router.push(`/admin/employees/${encodeURIComponent(String(e.id))}` as Href)}
          />
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <Loading />
          ) : q.error ? (
            <ErrorText>{errorMessage(q.error, 'Could not load employees.')}</ErrorText>
          ) : (
            <Muted>No employees found.</Muted>
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: 8 }} /> : undefined}
      />
    </View>
  );
}
