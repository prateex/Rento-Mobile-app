import { supabase, isSupabaseEnabledNow } from "@/lib/supabase";

export type IndiaState = {
  id: string;
  name: string;
};

export type IndiaCity = {
  id: string;
  state_id: string;
  name: string;
};

export type IndiaPincode = {
  id: string;
  city_id: string;
  pincode: string;
};

let statesCache: IndiaState[] | null = null;
const citiesCache = new Map<string, IndiaCity[]>();
const pincodesCache = new Map<string, IndiaPincode[]>();

export const fetchIndiaStates = async (): Promise<IndiaState[]> => {
  if (statesCache) return statesCache;
  if (!isSupabaseEnabledNow()) return [];

  const { data, error } = await supabase
    .from("states")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[fetchIndiaStates] Error:", error);
    return [];
  }

  statesCache = data || [];
  return statesCache;
};

export const fetchIndiaCities = async (stateId: string): Promise<IndiaCity[]> => {
  if (!stateId) return [];
  const cached = citiesCache.get(stateId);
  if (cached) return cached;
  if (!isSupabaseEnabledNow()) return [];

  const { data, error } = await supabase
    .from("cities")
    .select("id, state_id, name")
    .eq("state_id", stateId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[fetchIndiaCities] Error:", error);
    return [];
  }

  const cities = data || [];
  citiesCache.set(stateId, cities);
  return cities;
};

export const fetchIndiaPincodes = async (cityId: string): Promise<IndiaPincode[]> => {
  if (!cityId) return [];
  const cached = pincodesCache.get(cityId);
  if (cached) return cached;
  if (!isSupabaseEnabledNow()) return [];

  const { data, error } = await supabase
    .from("pincodes")
    .select("id, city_id, pincode")
    .eq("city_id", cityId)
    .eq("is_active", true)
    .order("pincode", { ascending: true });

  if (error) {
    console.error("[fetchIndiaPincodes] Error:", error);
    return [];
  }

  const pincodes = data || [];
  pincodesCache.set(cityId, pincodes);
  return pincodes;
};

export const clearIndiaLocationCache = () => {
  statesCache = null;
  citiesCache.clear();
  pincodesCache.clear();
};
