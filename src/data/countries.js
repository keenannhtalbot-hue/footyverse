// Country-specific football pathways, plausible local clubs, and school stages.
// Club names are original/fictional, not real-world trademarks.

export const COUNTRIES = {
  Canada: {
    name: 'Canada',
    pathwayName: 'Canadian Grassroots-to-Academy Pathway',
    entryAgeRange: [6, 8],
    clubs: [
      'Maple Ridge FC',
      'Northshore United',
      'Fraser Valley Academy',
      'Calgary Rise SC',
      'Ontario Lakeside FC',
    ],
    schoolStages: ['Kindergarten', 'Elementary School', 'Middle School', 'High School'],
    currency: 'CAD',
  },
  England: {
    name: 'England',
    pathwayName: 'English Grassroots-to-EPPP Pathway',
    entryAgeRange: [6, 7],
    clubs: [
      'Redbrook Town FC',
      'Millfield Athletic',
      'Sheercliff United',
      'Oakhurst Rovers',
      'Northgate City FC',
    ],
    schoolStages: ['Reception', 'Primary School', 'Secondary School', 'Sixth Form'],
    currency: 'GBP',
  },
  Brazil: {
    name: 'Brazil',
    pathwayName: 'Brazilian Futsal-to-Campo Pathway',
    entryAgeRange: [5, 7],
    clubs: [
      'Vila Nova Futebol Clube',
      'Praia Dourada FC',
      'Serra Verde Esporte',
      'Rio Alegre AC',
      'Costa Azul Futsal',
    ],
    schoolStages: ['Educação Infantil', 'Ensino Fundamental I', 'Ensino Fundamental II', 'Ensino Médio'],
    currency: 'BRL',
  },
  Spain: {
    name: 'Spain',
    pathwayName: 'Spanish Cantera Pathway',
    entryAgeRange: [6, 8],
    clubs: [
      'Club Deportivo Levante Sur',
      'Real Costa Brava',
      'Atlético Alameda',
      'Unión Sierra CF',
      'Villablanca FC',
    ],
    schoolStages: ['Educación Infantil', 'Educación Primaria', 'Educación Secundaria', 'Bachillerato'],
    currency: 'EUR',
  },
  Germany: {
    name: 'Germany',
    pathwayName: 'German Nachwuchsleistungszentrum Pathway',
    entryAgeRange: [6, 8],
    clubs: [
      'SV Nordpark 04',
      'TSV Blau-Weiß Lindenberg',
      'FC Rheintal 09',
      'Waldstadt Kickers',
      'Grüntal SC',
    ],
    schoolStages: ['Kindergarten', 'Grundschule', 'Sekundarstufe I', 'Sekundarstufe II'],
    currency: 'EUR',
  },
};

export const COUNTRY_LIST = Object.keys(COUNTRIES);

export function getAllClubs() {
  const all = [];
  for (const country of COUNTRY_LIST) {
    for (const club of COUNTRIES[country].clubs) {
      all.push({ club, country });
    }
  }
  return all;
}
