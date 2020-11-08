export type CountryCode = string;
export type DateString = string;

export interface EcdcRecord {
  country: string,
  country_code : CountryCode,
  continent: string,
  population: number,
  indicator: 'confirmed cases' | 'deaths',
  daily_count: number,
  date: DateString,
  source: string
}

export type WeekNumber = number;
export type DeathCount = number;
