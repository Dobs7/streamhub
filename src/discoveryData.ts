import peopleArchive from './people.json';
import oscarArchive from './oscars.json';
export interface FilmPick {name:string;year:number;catalogYear?:number;catalogId?:number;winner?:boolean}
export const oscars:Record<string,FilmPick[]>=oscarArchive;
export const studioPicks:Record<string,FilmPick[]>={
 'Pixar':[{name:'Toy Story',year:1995},{name:'Finding Nemo',year:2003},{name:'WALL-E',year:2008},{name:'Inside Out',year:2015},{name:'Coco',year:2017},{name:'Soul',year:2020}],
 'Warner Bros.':[{name:'The Dark Knight',year:2008},{name:'Inception',year:2010},{name:'Dune',year:2021},{name:'Barbie',year:2023},{name:'The Matrix',year:1999},{name:'Mad Max: Fury Road',year:2015}],
 'Universal':[{name:'Jurassic Park',year:1993},{name:'Back to the Future',year:1985},{name:'Jaws',year:1975},{name:'Oppenheimer',year:2023},{name:'Get Out',year:2017},{name:'Wicked',year:2024}],
 'A24':[{name:'Moonlight',year:2016},{name:'Everything Everywhere All at Once',year:2022},{name:'Lady Bird',year:2017},{name:'Past Lives',year:2023},{name:'The Lighthouse',year:2019},{name:'Civil War',year:2024}],
 "Paramount Pictures":[{"name": "The Godfather", "year": 1972}, {"name": "Top Gun", "year": 1986}, {"name": "Interstellar", "year": 2014}],
 "Sony Pictures / Columbia":[{"name": "Spider-Man", "year": 2002}, {"name": "Men in Black", "year": 1997}, {"name": "Once Upon a Time in Hollywood", "year": 2019}],
 "20th Century Studios":[{"name": "Alien", "year": 1979}, {"name": "Titanic", "year": 1997}, {"name": "Avatar", "year": 2009}],
 "Walt Disney Pictures":[{"name": "The Lion King", "year": 1994}, {"name": "Frozen", "year": 2013}, {"name": "Zootopia", "year": 2016}],
 "DreamWorks Animation":[{"name": "Shrek", "year": 2001}, {"name": "Madagascar", "year": 2005}, {"name": "Kung Fu Panda", "year": 2008}],
 "Marvel Studios":[{"name": "Iron Man", "year": 2008}, {"name": "The Avengers", "year": 2012}, {"name": "Avengers: Endgame", "year": 2019}],
 "DC":[{"name": "Man of Steel", "year": 2013}, {"name": "Joker", "year": 2019}, {"name": "The Batman", "year": 2022}],
 "Lucasfilm":[{"name": "Star Wars", "year": 1977}, {"name": "The Empire Strikes Back", "year": 1980}, {"name": "Raiders of the Lost Ark", "year": 1981}],
 "Studio Ghibli":[{"name": "My Neighbor Totoro", "year": 1988}, {"name": "Princess Mononoke", "year": 1997}, {"name": "Spirited Away", "year": 2001}],
 "Lionsgate":[{"name": "John Wick", "year": 2014}, {"name": "The Hunger Games", "year": 2012}, {"name": "La La Land", "year": 2016}],
 "MGM":[{"name": "RoboCop", "year": 1987}, {"name": "Legally Blonde", "year": 2001}, {"name": "Skyfall", "year": 2012}],
 "Searchlight Pictures":[{"name": "The Shape of Water", "year": 2017}, {"name": "Nomadland", "year": 2020}, {"name": "Poor Things", "year": 2023}],
 "Focus Features":[{"name": "Lost in Translation", "year": 2003}, {"name": "Eternal Sunshine of the Spotless Mind", "year": 2004}, {"name": "Brokeback Mountain", "year": 2005}],
 "NEON":[{"name": "Parasite", "year": 2019}, {"name": "Longlegs", "year": 2024}, {"name": "Anora", "year": 2024}],
 "Blumhouse":[{"name": "Insidious", "year": 2010}, {"name": "Whiplash", "year": 2014}, {"name": "Get Out", "year": 2017}],
 "Netflix":[{"name": "Roma", "year": 2018}, {"name": "The Irishman", "year": 2019}, {"name": "Klaus", "year": 2019}],
 "SEGA / Sonic":[{"name": "Sonic the Hedgehog", "year": 2020}, {"name": "Sonic the Hedgehog 2", "year": 2022}, {"name": "Sonic the Hedgehog 3", "year": 2024}],
 "Diamond Films":[{"name": "Hereditary", "year": 2018}, {"name": "Talk to Me", "year": 2022}, {"name": "The Whale", "year": 2022}]
};
export const discoveryPeople=peopleArchive.map(p=>p.name);
export const normalizeFilm=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
