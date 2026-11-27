import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { personName } from '@/api/admin/common';
import { getEmployees } from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Badge, Header, ItemCard } from '@/ui/kit';

const PAGE_SIZE = 20;

/** Pick an employee to view / edit their salary components (GET / PUT /payroll/employees/{id}/salary-components). */
export default function SalaryComponentsPickerScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'payroll-sc-employees', search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getEmployees({ page: pageParam, limit: PAGE_SIZE, search }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      if (last.items.length < PAGE_SIZE) return undefined;
      if (last.total != null && loaded >= last.total) return undefined;
      return last.page + 1;
    },
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={{ flex: 1 }}>
      <Header title="Salary components" />
      <FlatList
        data={rows}
        keyExtractor={(e, i) => String(e.id ?? i)}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => q.refetch()} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <CompanyScopeNotice />
            <Muted>Monthly-wage employees can have their own salary components instead of a single Basic from CTC.</Muted>
            <Field label="Search" value={text} onChangeText={setText} placeholder="Name, email or employee ID" autoCapitalize="none" />
          </View>
        }
        renderItem={({ item: e }) => (
          <ItemCard
            title={personName(e) || 'Employee'}
            badge={<Badge label={e.wage_type} tone="muted" />}
            lines={[[e.employee_code, e.designation].filter(Boolean).join(' · '), e.department]}
            onPress={() =>
              router.push(
                `/admin/payroll/salary-components/${encodeURIComponent(String(e.id))}?name=${encodeURIComponent(personName(e))}`,
              )
            }
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
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator /> : null}
      />
    </View>
  );
}
