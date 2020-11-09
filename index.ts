import { DateTimeFormatter, IsoFields, LocalDate } from '@js-joda/core';
import { readFileSync } from 'fs';
import { plot, Plot } from 'nodeplotlib';

import { Config } from './config';
import { CountryCode, CountryName, DeathCount, EcdcRecord, WeekNumber } from './types';


let filename;
if (process.argv.length >= 3) {
  filename = process.argv[2];
} else {
  filename = Config.defaultFilename;
}

// Read file
console.log(`Reading ECDC JSON data from file ${filename}...`);
const ecdcData: EcdcRecord[] = JSON.parse(readFileSync(filename).toString());
console.log(`Read ${ecdcData.length} records\n`);

// Analyse and prepare data set
const countriesMap = new Map<CountryCode, CountryName>();
const datesSet = new Set<string>();
ecdcData.map(data => {
  if (!!data.country_code) {
    countriesMap.set(data.country_code, data.country);
    datesSet.add(data.date);
  }
});

if (datesSet.size === 0) {
  console.error('Data set does not contain dates. Check format or download latest set from ECDC source.');
  process.exit(1);
}

const dates = Array.from(datesSet).sort();
const startWeek: WeekNumber = Math.max(LocalDate.parse(dates[0]).isoWeekOfWeekyear(), Config.startWeek);
const endWeek: WeekNumber = LocalDate.parse(dates[dates.length - 1]).isoWeekOfWeekyear();
const weekCount = endWeek - startWeek;
console.log('Data contains');
console.log(`${countriesMap.size} countries: ${Array.from(countriesMap.keys())}\n`);
console.log(`${dates.length} dates: [${dates[0]} ... ${dates[dates.length - 1]}]\n`);
console.log(`${weekCount} weeks: [${startWeek} ... ${endWeek}]\n\n`);

const countriesToPlot = Config.countries;
console.log(`These ${countriesToPlot.length} are being analysed: ${countriesToPlot}\n\n`);

// Arrange plot data by country and weeks
const deathsByCountryAndWeeks = new Map<CountryCode, Map<WeekNumber, DeathCount>>();
ecdcData.map(data => {
  const week: WeekNumber = LocalDate.parse(data.date).isoWeekOfWeekyear();
  if (data.indicator !== 'deaths' ||
      !countriesToPlot.includes(data.country_code) ||
      week < startWeek) {
    return;
  }
  const country = data.country_code;
  if (!deathsByCountryAndWeeks.has(country)) {
    deathsByCountryAndWeeks.set(country, new Map<WeekNumber, DeathCount>());
  }
  // Normalize by population
  const deathsByHundredThousand = data.daily_count * 100000 / data.population;
  if (!deathsByCountryAndWeeks.get(country)?.has(week)) {
    deathsByCountryAndWeeks.get(country)?.set(week, deathsByHundredThousand);
  } else {
    const currentWeekSum = deathsByCountryAndWeeks.get(country)?.get(week);
    if (!!currentWeekSum) {
      deathsByCountryAndWeeks.get(country)?.set(week, currentWeekSum + deathsByHundredThousand);
    }
  }
});

// Plot data
const plotData: Plot[] = [];
deathsByCountryAndWeeks.forEach((deathsByWeekMap: Map<WeekNumber, DeathCount>, country: CountryCode) => {
  const weeksWithDate = new Array<string>();
  const deathsCountsPerWeek = new Array<DeathCount>();
  deathsByWeekMap.forEach((deaths: DeathCount, week: WeekNumber) => {
    const weekWithDate = `${week} (${LocalDate.now().with(IsoFields.WEEK_OF_WEEK_BASED_YEAR, week).format(DateTimeFormatter.ofPattern('dd-MM'))})`;
    weeksWithDate.push(weekWithDate);
    deathsCountsPerWeek.push(deaths)
  });
  const countryPlot: Plot = {
    x: weeksWithDate,
    y: deathsCountsPerWeek,
    name: countriesMap.get(country),
    type: 'line' as any
  }
  plotData.push(countryPlot);
});

plot(plotData, {
  title: 'Covid19 related deaths by calendar week in 2020 (source: <a href="https://www.ecdc.europa.eu/en/publications-data/data-national-14-day-notification-rate-covid-19">ECDC</a>)',
  xaxis: { title: 'calendar week' },
  yaxis: { title: 'deaths per 100.000' }
});

console.log('Generated plot will show up in browser');
