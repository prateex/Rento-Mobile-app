/**
 * Database call logger for debugging column mismatches and schema errors
 */

export interface DbLogEntry {
  timestamp: string;
  file: string;
  function: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  columns: string[];
  payload?: any;
  error?: string;
  success: boolean;
}

const logs: DbLogEntry[] = [];

export function logDbCall(entry: Omit<DbLogEntry, 'timestamp'>) {
  const log: DbLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  logs.push(log);
  
  const status = entry.error ? '❌' : '✅';
  const payloadStr = entry.payload ? JSON.stringify(entry.payload) : '';
  const errorStr = entry.error ? `\n  ERROR: ${entry.error}` : '';
  
  console.log(
    `${status} [DB] ${entry.file}:${entry.function}() → ${entry.operation} ${entry.table} (${entry.columns.join(', ')})${payloadStr ? `\n  Payload: ${payloadStr}` : ''}${errorStr}`
  );
}

export function getDbLogs() {
  return logs;
}

export function clearDbLogs() {
  logs.length = 0;
}

export function printDbLogReport() {
  console.log('\n========== DATABASE CALL REPORT ==========');
  console.log(`Total calls: ${logs.length}`);
  
  const byTable = logs.reduce((acc, log) => {
    if (!acc[log.table]) acc[log.table] = [];
    acc[log.table].push(log);
    return acc;
  }, {} as Record<string, DbLogEntry[]>);
  
  for (const [table, calls] of Object.entries(byTable)) {
    const errors = calls.filter(c => c.error);
    console.log(`\n${table}: ${calls.length} calls (${errors.length} errors)`);
    if (errors.length > 0) {
      errors.forEach(err => {
        console.log(`  ❌ ${err.operation} ${err.columns.join(', ')}: ${err.error}`);
      });
    }
  }
  console.log('\n==========================================\n');
}
