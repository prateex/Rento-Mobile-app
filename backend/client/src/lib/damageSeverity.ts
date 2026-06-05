export type UiDamageSeverity = 'minor' | 'moderate' | 'major';
export type DbDamageSeverity = 'Minor' | 'Moderate' | 'Major';

export function uiToDbSeverity(
  severity: UiDamageSeverity
): DbDamageSeverity {
  switch (severity) {
    case 'minor':
      return 'Minor';
    case 'moderate':
      return 'Moderate';
    case 'major':
      return 'Major';
    default:
      throw new Error(`Invalid UI severity: ${severity}`);
  }
}

export function dbToUiSeverity(
  severity: DbDamageSeverity
): UiDamageSeverity {
  return severity.toLowerCase() as UiDamageSeverity;
}
