import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface BookingFlowState {
  state: string;
  city: string;
  startDate: string;
  endDate: string;
  vehicleId?: string;
  bookingId?: string;
}

interface BookingFlowContextValue {
  flow: BookingFlowState | null;
  setSearchParams: (params: Omit<BookingFlowState, 'vehicleId' | 'bookingId'>) => void;
  setVehicleId: (vehicleId: string) => void;
  setBookingId: (bookingId: string) => void;
  clearBooking: () => void;
}

const BookingFlowContext = createContext<BookingFlowContextValue | undefined>(undefined);

const STORAGE_KEY = 'rento_booking_flow';

export function BookingFlowProvider({ children }: { children: React.ReactNode }) {
  const [flow, setFlow] = useState<BookingFlowState | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as BookingFlowState) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (flow) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [flow]);

  const value = useMemo<BookingFlowContextValue>(() => ({
    flow,
    setSearchParams: (params) => {
      setFlow({ ...params });
    },
    setVehicleId: (vehicleId) => {
      setFlow((current) => {
        if (!current) return null;
        return { ...current, vehicleId };
      });
    },
    setBookingId: (bookingId) => {
      setFlow((current) => {
        if (!current) return null;
        return { ...current, bookingId };
      });
    },
    clearBooking: () => {
      setFlow(null);
    },
  }), [flow]);

  return (
    <BookingFlowContext.Provider value={value}>
      {children}
    </BookingFlowContext.Provider>
  );
}

export function useBookingFlow() {
  const context = useContext(BookingFlowContext);
  if (!context) {
    throw new Error('useBookingFlow must be used within BookingFlowProvider');
  }
  return context;
}
