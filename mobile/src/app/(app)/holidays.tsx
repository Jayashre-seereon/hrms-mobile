import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { Holiday, loadEmployeeHolidays } from '@/api/holidays';
import { Muted } from '@/ui/components';
import { Badge, Header, ItemCard, QueryList, Segments, toISODate } from '@/ui/kit';

const TONE: Record<string, 'success' | 'warning' | 'primary'> = { Public: 'success', State: 'primary', Optional: 'warning' };

export default function HolidaysScreen() {
  const [show, setShow] = useState<'upcoming' | 'all'>('upcoming');
  // The backend scopes calendars to the employee's company / branch from the token (same as web).
  const query = useQuery({ queryKey: ['holidays', 'employee'], queryFn: () => loadEmployeeHolidays() });

  const today = toISODate(new Date());
  const year = String(new Date().getFullYear());
  const rows = (query.data ?? []).filter((h) => (show === 'upcoming' ? h.date >= today : h.date.startsWith(year)));
  const view = { ...query, data: rows } as typeof query;

  return (
    <>
      <Header title="Holidays" />
      <QueryList<Holiday>
        query={view}
        empty={show === 'upcoming' ? 'No upcoming holidays.' : `No holidays for ${year}.`}
        header={
          <View style={{ gap: 8, marginBottom: 4 }}>
            <Segments
              value={show}
              onChange={(v) => setShow(v as 'upcoming' | 'all')}
              options={[
                { label: 'Upcoming', value: 'upcoming' },
                { label: `All ${year}`, value: 'all' },
              ]}
            />
            <Muted style={{ fontSize: 12 }}>National, state / regional and optional (restricted) holidays.</Muted>
          </View>
        }
        renderItem={(h) => {
          const d = new Date(`${h.date}T00:00:00`);
          const label = Number.isNaN(d.getTime())
            ? h.date
            : d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
          return (
            <ItemCard
              title={h.name}
              badge={h.type ? <Badge label={h.type} tone={TONE[h.type] ?? 'primary'} /> : undefined}
              lines={[label, h.paid ? 'Paid holiday' : 'Unpaid', h.description || null]}
            />
          );
        }}
      />
    </>
  );
}
