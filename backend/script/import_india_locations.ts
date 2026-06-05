import 'dotenv/config';
import { getSupabaseAdminClient } from '../server/lib/supabaseAdmin';

const chunk = <T>(items: T[], size: number): T[][] => {
  const results: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(items.slice(i, i + size));
  }
  return results;
};

const normalizeText = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const normalizeState = (value: string) =>
  normalizeText(value.replace(/\s+circle$/i, ''));

const normalizeCity = (value: string) => normalizeText(value);

const normalizePincode = (value: string | number | undefined) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const INDIA_POST_CSV_URLS = [
  'https://www.indiapost.gov.in/VAS/DOP_PDFFiles/All_India_pincode_directory.csv',
  'https://www.indiapost.gov.in/VAS/DOP_PDFFiles/All_India_Pincode_Directory.csv',
  'https://www.indiapost.gov.in/vas/DOP_PDFFiles/All_India_pincode_directory.csv',
  'https://www.indiapost.gov.in/vas/DOP_PDFFiles/All_India_Pincode_Directory.csv',
];

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
};

const detectHeaderIndexes = (headers: string[]) => {
  const normalized = headers.map(normalizeHeader);

  const findIndex = (candidates: string[]) =>
    normalized.findIndex((header) => candidates.includes(header));

  const stateIndex = findIndex(['statename', 'state', 'circlename']);
  const cityIndex = findIndex(['district', 'districtname', 'city', 'divisionname', 'regionname']);
  const pincodeIndex = findIndex(['pincode', 'pin']);

  if (stateIndex === -1 || cityIndex === -1 || pincodeIndex === -1) {
    throw new Error(`CSV headers missing required fields. Found headers: ${headers.join(', ')}`);
  }

  return { stateIndex, cityIndex, pincodeIndex };
};

const fetchIndiaPostCsvResponse = async (): Promise<Response> => {
  for (const url of INDIA_POST_CSV_URLS) {
    const response = await fetch(url, {
      headers: {
        accept: 'text/csv, text/plain;q=0.9, */*;q=0.1',
      },
    });

    if (!response.ok || !response.body) {
      continue;
    }

    const previewResponse = response.clone();
    if (!previewResponse.body) {
      continue;
    }
    const reader = previewResponse.body.getReader();
    const { value, done } = await reader.read();
    if (done || !value) {
      continue;
    }

    const preview = new TextDecoder('utf-8').decode(value).trimStart();
    if (preview.startsWith('<!DOCTYPE html') || preview.startsWith('<html')) {
      continue;
    }

    reader.releaseLock();
    return response;
  }

  throw new Error('Unable to download India Post CSV from public URLs. The official CSV endpoints returned HTML or were unavailable.');
};

const parseCsvStream = async (
  response: Response,
  onRow: (row: string[]) => void,
  onHeader: (headers: string[]) => void
): Promise<void> => {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let isFirstLine = true;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let lineBreakIndex = buffer.indexOf('\n');

    while (lineBreakIndex !== -1) {
      const line = buffer.slice(0, lineBreakIndex).replace(/\r$/, '');
      buffer = buffer.slice(lineBreakIndex + 1);

      if (line.trim().length > 0) {
        const parsed = parseCsvLine(line);
        if (isFirstLine) {
          onHeader(parsed.map((value) => value.trim()));
          isFirstLine = false;
        } else {
          onRow(parsed);
        }
      }

      lineBreakIndex = buffer.indexOf('\n');
    }
  }

  const remaining = buffer.trim();
  if (remaining.length > 0) {
    const parsed = parseCsvLine(remaining);
    if (isFirstLine) {
      onHeader(parsed.map((value) => value.trim()));
    } else {
      onRow(parsed);
    }
  }
};

async function importIndiaLocations() {
  const admin = getSupabaseAdminClient();
  const stateMap = new Map<string, Map<string, Set<string>>>();

  console.log('⏬ Downloading India Post pincode dataset (public CSV)...');
  const response = await fetchIndiaPostCsvResponse();
  let indexes: { stateIndex: number; cityIndex: number; pincodeIndex: number } | null = null;

  await parseCsvStream(
    response,
    (row) => {
      if (!indexes) return;
      const rawState = row[indexes.stateIndex] ?? '';
      const rawCity = row[indexes.cityIndex] ?? '';
      const rawPincode = row[indexes.pincodeIndex] ?? '';

      const state = normalizeState(rawState);
      const city = normalizeCity(rawCity || 'Unknown');
      const pincode = normalizePincode(rawPincode);

      if (!state || !city || !pincode) return;

      if (!stateMap.has(state)) {
        stateMap.set(state, new Map());
      }
      const cityMap = stateMap.get(state)!;
      if (!cityMap.has(city)) {
        cityMap.set(city, new Set());
      }
      cityMap.get(city)!.add(pincode);
    },
    (headers) => {
      indexes = detectHeaderIndexes(headers);
    }
  );

  if (!indexes || stateMap.size === 0) {
    throw new Error('India Post CSV parsing produced no state records.');
  }

  const stateRows = [...stateMap.keys()].map((state) => ({ name: state }));
  const stateChunks = chunk(stateRows, 500);
  for (const batch of stateChunks) {
    const { error } = await admin.from('states').upsert(batch, { onConflict: 'name' });
    if (error) throw error;
  }

  const { data: allStates, error: statesError } = await admin
    .from('states')
    .select('id, name');
  if (statesError) throw statesError;

  const stateIdByName = new Map<string, string>();
  (allStates || []).forEach((row) => stateIdByName.set(row.name, row.id));

  const cityRows: Array<{ state_id: string; name: string }> = [];
  stateMap.forEach((cities, stateName) => {
    const stateId = stateIdByName.get(stateName);
    if (!stateId) return;
    cities.forEach((_pincodes, cityName) => {
      cityRows.push({ state_id: stateId, name: cityName });
    });
  });

  const cityChunks = chunk(cityRows, 1000);
  for (const batch of cityChunks) {
    const { error } = await admin.from('cities').upsert(batch, { onConflict: 'state_id,name' });
    if (error) throw error;
  }

  const stateIds = [...stateIdByName.values()];
  const cityIdByKey = new Map<string, string>();
  const stateIdChunks = chunk(stateIds, 100);
  for (const batch of stateIdChunks) {
    const { data: cityData, error } = await admin
      .from('cities')
      .select('id, state_id, name')
      .in('state_id', batch);
    if (error) throw error;
    (cityData || []).forEach((row) => cityIdByKey.set(`${row.state_id}::${row.name}`, row.id));
  }

  const pincodeRows: Array<{ city_id: string; pincode: string }> = [];
  stateMap.forEach((cities, stateName) => {
    const stateId = stateIdByName.get(stateName);
    if (!stateId) return;
    cities.forEach((pincodeSet, cityName) => {
      const cityId = cityIdByKey.get(`${stateId}::${cityName}`);
      if (!cityId) return;
      pincodeSet.forEach((pincode) => {
        if (!pincode) return;
        pincodeRows.push({ city_id: cityId, pincode });
      });
    });
  });

  const pincodeChunks = chunk(pincodeRows, 2000);
  for (const batch of pincodeChunks) {
    const { error } = await admin.from('pincodes').upsert(batch, { onConflict: 'city_id,pincode' });
    if (error) throw error;
  }

  const { count: stateCount } = await admin.from('states').select('*', { count: 'exact', head: true });
  const { count: cityCount } = await admin.from('cities').select('*', { count: 'exact', head: true });
  const { count: pincodeCount } = await admin.from('pincodes').select('*', { count: 'exact', head: true });

  console.log('✅ India locations import complete');
  console.log(`States prepared: ${stateRows.length} | DB total: ${stateCount ?? 0}`);
  console.log(`Cities prepared: ${cityRows.length} | DB total: ${cityCount ?? 0}`);
  console.log(`Pincodes prepared: ${pincodeRows.length} | DB total: ${pincodeCount ?? 0}`);
}

importIndiaLocations().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
