// Name pools for NPC generation, loosely grouped by country for flavor.
// Not exhaustive census data — plausible, varied fictional names.

export const NAME_POOLS = {
  Canada: {
    boy: ['Liam', 'Noah', 'Ethan', 'Jacob', 'Owen', 'Mason', 'Caleb', 'Tyler'],
    girl: ['Olivia', 'Emma', 'Ava', 'Sophia', 'Chloe', 'Grace', 'Zoe', 'Maya'],
    neutral: ['Avery', 'Riley', 'Jordan', 'Rowan', 'Charlie', 'Quinn'],
    surnames: ['Tremblay', 'Campbell', 'MacDonald', 'Nguyen', 'Singh', 'Wilson', 'Roy', 'Chan'],
  },
  England: {
    boy: ['Harry', 'Jack', 'George', 'Oliver', 'Charlie', 'Freddie', 'Alfie', 'Leo'],
    girl: ['Amelia', 'Isla', 'Freya', 'Poppy', 'Ivy', 'Daisy', 'Millie', 'Ruby'],
    neutral: ['Robin', 'Ellis', 'Sam', 'Bailey', 'Frankie', 'Ash'],
    surnames: ['Smith', 'Taylor', 'Evans', 'Brown', 'Walker', 'Hughes', 'Patel', 'Clarke'],
  },
  Brazil: {
    boy: ['Gabriel', 'Miguel', 'Arthur', 'Heitor', 'Davi', 'Bernardo', 'Théo', 'Pedro'],
    girl: ['Alice', 'Sophia', 'Helena', 'Valentina', 'Laura', 'Isadora', 'Manuela', 'Luiza'],
    neutral: ['Lorran', 'Kauê', 'Yasmin', 'Estêvão'],
    surnames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Ferreira'],
  },
  Spain: {
    boy: ['Hugo', 'Mateo', 'Martín', 'Lucas', 'Leo', 'Daniel', 'Pablo', 'Alejandro'],
    girl: ['Lucía', 'Sofía', 'Martina', 'María', 'Julia', 'Valeria', 'Emma', 'Paula'],
    neutral: ['Ariel', 'Noa', 'Alex', 'Dani'],
    surnames: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Díaz'],
  },
  Germany: {
    boy: ['Ben', 'Paul', 'Finn', 'Leon', 'Noah', 'Elias', 'Jonas', 'Felix'],
    girl: ['Mia', 'Emma', 'Hannah', 'Lina', 'Marie', 'Lea', 'Klara', 'Frieda'],
    neutral: ['Kim', 'Sascha', 'Toni', 'Robin'],
    surnames: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann'],
  },
};

export function randomNpcName(rng, country, genderHint) {
  const pool = NAME_POOLS[country] || NAME_POOLS.England;
  const gender = genderHint || rng.pick(['boy', 'girl', 'neutral']);
  const firstPool = pool[gender] || pool.neutral;
  const first = rng.pick(firstPool);
  const last = rng.pick(pool.surnames);
  return { first: `${first} ${last}`, gender };
}

export function formatTeacherName({ first, gender }) {
  const [, ...surnameParts] = first.trim().split(/\s+/);
  const surname = surnameParts.join(' ') || first.trim();
  const title = gender === 'boy' ? 'Mr.' : gender === 'girl' ? 'Ms.' : 'Mx.';
  return `${title} ${surname}`;
}
