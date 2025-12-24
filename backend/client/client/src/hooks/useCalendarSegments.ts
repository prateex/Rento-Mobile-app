import { useMemo } from 'react';
import {
  startOfDay,
  endOfDay,
  parseISO,
  isBefore,
  isAfter,
  isSameDay,
  getHours,
  getMinutes,
  areIntervalsOverlapping,
} from 'date-fns';
import type { Bike, Booking } from '@/lib/store';

export interface CalendarSegment {
  id: string;
  bookingId: string;
  bikeId: string;
  dayIndex: number;
  leftPct: number;
  widthPct: number;
  isStartPartial: boolean;
  isEndPartial: boolean;
  isFirstDay: boolean;
  isLastDay: boolean;
  booking: Booking;
  stackIndex: number;
  startMinutes: number;
  endMinutes: number;
}

interface UseCalendarSegmentsProps {
  bikes: Bike[];
  bookings: Booking[];
  days: Date[];
}

const MINUTES_IN_DAY = 24 * 60;

function getMinutesFromMidnight(date: Date): number {
  return getHours(date) * 60 + getMinutes(date);
}

function getTimeAsFraction(date: Date): number {
  return getMinutesFromMidnight(date) / MINUTES_IN_DAY;
}

function isFullDayStart(date: Date): boolean {
  return getHours(date) === 0 && getMinutes(date) === 0;
}

function isFullDayEnd(date: Date): boolean {
  const hours = getHours(date);
  const minutes = getMinutes(date);
  return hours === 23 && minutes >= 59;
}

function doSegmentsOverlap(a: { startMinutes: number; endMinutes: number }, b: { startMinutes: number; endMinutes: number }): boolean {
  return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
}

export function useCalendarSegments({
  bikes,
  bookings,
  days,
}: UseCalendarSegmentsProps): {
  segments: CalendarSegment[];
  bikeSegmentMap: Map<string, Map<number, CalendarSegment[]>>;
} {
  return useMemo(() => {
    const segments: CalendarSegment[] = [];
    const bikeSegmentMap = new Map<string, Map<number, CalendarSegment[]>>();

    bikes.forEach((bike) => {
      bikeSegmentMap.set(bike.id, new Map());
    });

    const activeBookings = bookings.filter(
      (b) => b.status !== 'Deleted' && b.status !== 'Cancelled'
    );

    activeBookings.forEach((booking) => {
      const bookingStart = parseISO(booking.startDate);
      const bookingEnd = parseISO(booking.endDate);

      booking.bikeIds.forEach((bikeId) => {
        if (!bikes.some((b) => b.id === bikeId)) return;

        days.forEach((day, dayIndex) => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);

          const bookingStartsBeforeOrOnDay = !isAfter(bookingStart, dayEnd);
          const bookingEndsAfterDayStart = isAfter(bookingEnd, dayStart);

          if (!bookingStartsBeforeOrOnDay || !bookingEndsAfterDayStart) return;

          const isFirstDay = isSameDay(bookingStart, day);
          const isLastDay = isSameDay(bookingEnd, day);

          if (isLastDay && getMinutesFromMidnight(bookingEnd) === 0) {
            return;
          }

          let leftPct = 0;
          let widthPct = 100;
          let startMinutes = 0;
          let endMinutes = MINUTES_IN_DAY;

          if (isFirstDay) {
            const startFraction = getTimeAsFraction(bookingStart);
            leftPct = startFraction * 100;
            startMinutes = getMinutesFromMidnight(bookingStart);

            if (isLastDay) {
              const endFraction = getTimeAsFraction(bookingEnd);
              widthPct = (endFraction - startFraction) * 100;
              endMinutes = getMinutesFromMidnight(bookingEnd);
            } else {
              widthPct = (1 - startFraction) * 100;
              endMinutes = MINUTES_IN_DAY;
            }
          } else if (isLastDay) {
            const endFraction = getTimeAsFraction(bookingEnd);
            leftPct = 0;
            widthPct = endFraction * 100;
            startMinutes = 0;
            endMinutes = getMinutesFromMidnight(bookingEnd);
          }

          widthPct = Math.max(widthPct, 5);

          const isStartPartial = isFirstDay && !isFullDayStart(bookingStart);
          const isEndPartial = isLastDay && !isFullDayEnd(bookingEnd);

          const segment: CalendarSegment = {
            id: `${booking.id}-${bikeId}-${dayIndex}`,
            bookingId: booking.id,
            bikeId,
            dayIndex,
            leftPct,
            widthPct,
            isStartPartial,
            isEndPartial,
            isFirstDay,
            isLastDay,
            booking,
            stackIndex: 0,
            startMinutes,
            endMinutes,
          };

          segments.push(segment);

          const bikeMap = bikeSegmentMap.get(bikeId);
          if (bikeMap) {
            if (!bikeMap.has(dayIndex)) {
              bikeMap.set(dayIndex, []);
            }
            const daySegments = bikeMap.get(dayIndex)!;
            
            let assignedStack = 0;
            const usedStacks = new Set<number>();
            
            for (const existingSegment of daySegments) {
              if (doSegmentsOverlap(segment, existingSegment)) {
                usedStacks.add(existingSegment.stackIndex);
              }
            }
            
            while (usedStacks.has(assignedStack)) {
              assignedStack++;
            }
            
            segment.stackIndex = assignedStack;
            daySegments.push(segment);
          }
        });
      });
    });

    return { segments, bikeSegmentMap };
  }, [bikes, bookings, days]);
}

export function getSegmentsForBikeDay(
  bikeSegmentMap: Map<string, Map<number, CalendarSegment[]>>,
  bikeId: string,
  dayIndex: number
): CalendarSegment[] {
  return bikeSegmentMap.get(bikeId)?.get(dayIndex) || [];
}
