/**
 * Bundled Word Data (Fallback)
 * 
 * Contains the first 15 words per category bundled with the app binary.
 * Used as a fallback when no internet and no cache exists.
 */

export const BUNDLED_WORDS: Record<string, string[]> = {
  superheroes: ["Superman","Batman","Spider-Man","Wonder Woman","Iron Man","Captain America","Thor","Hulk","Wolverine","The Flash","Aquaman","Black Panther","Deadpool","Green Lantern","Black Widow"],
  animals: ["Dog","Cat","Elephant","Lion","Tiger","Bear","Giraffe","Monkey","Dolphin","Shark","Eagle","Penguin","Horse","Cow","Pig"],
  food: ["Pizza","Burger","Sushi","Taco","Ice Cream","Chocolate","Pasta","Steak","Fried Chicken","Hot Dog","French Fries","Pancakes","Waffles","Donut","Cookie"],
  brands: ["Nike","Google","Amazon","McDonald's","Coca-Cola","Disney","Netflix","Tesla","Samsung","Adidas","Starbucks","Microsoft","Sony","Nintendo","LEGO"],
  people: ["Albert Einstein","Michael Jordan","Taylor Swift","Beyoncé","Elon Musk","Michael Jackson","Elvis Presley","Oprah Winfrey","Leonardo DiCaprio","Tom Hanks","Will Smith","Dwayne Johnson","Ariana Grande","Drake","LeBron James"],
  places: ["Paris","New York","Tokyo","London","Rome","Las Vegas","Hollywood","Hawaii","Egypt","Grand Canyon","Niagara Falls","Amazon Rainforest","Antarctica","Sahara Desert","Mount Everest"],
  movies: ["Titanic","Star Wars","The Lion King","Jurassic Park","Harry Potter","Frozen","Avengers","Jaws","E.T.","The Wizard of Oz","Finding Nemo","Toy Story","Shrek","The Matrix","Forrest Gump"],
  video_games: ["Minecraft","Fortnite","Mario","Tetris","Pac-Man","Pokémon","Roblox","Grand Theft Auto","Call of Duty","The Legend of Zelda","Sonic","Among Us","Animal Crossing","FIFA","Madden"],
  board_games: ["Monopoly","Chess","Checkers","Scrabble","Risk","Clue","Sorry","Life","Battleship","Connect Four","Uno","Jenga","Candy Land","Chutes and Ladders","Trouble"],
  bands: ["The Beatles","Queen","Nirvana","AC/DC","Led Zeppelin","Pink Floyd","The Rolling Stones","Metallica","Guns N' Roses","The Beach Boys","Aerosmith","Bon Jovi","U2","Coldplay","Maroon 5"],
  jobs: ["Doctor","Teacher","Firefighter","Police Officer","Astronaut","Chef","Pilot","Nurse","Dentist","Lawyer","Scientist","Engineer","Artist","Actor","Singer"],
};

/**
 * Bundled category metadata (fallback for first launch offline).
 */
export const BUNDLED_CATEGORIES = [
  { id: 'superheroes', name: 'Superheroes', emoji: '🦸', isPaid: false, sortOrder: 1 },
  { id: 'animals', name: 'Animals', emoji: '🐾', isPaid: false, sortOrder: 2 },
  { id: 'food', name: 'Food', emoji: '🍕', isPaid: false, sortOrder: 3 },
  { id: 'brands', name: 'Brands', emoji: '🏷️', isPaid: false, sortOrder: 4 },
  { id: 'people', name: 'People', emoji: '👤', isPaid: false, sortOrder: 5 },
  { id: 'places', name: 'Places', emoji: '🌍', isPaid: false, sortOrder: 6 },
  { id: 'movies', name: 'Movies', emoji: '🎬', isPaid: false, sortOrder: 7 },
  { id: 'video_games', name: 'Video Games', emoji: '🎮', isPaid: false, sortOrder: 8 },
  { id: 'board_games', name: 'Board Games', emoji: '🎲', isPaid: false, sortOrder: 9 },
  { id: 'bands', name: 'Bands', emoji: '🎸', isPaid: false, sortOrder: 10 },
  { id: 'jobs', name: 'Jobs', emoji: '💼', isPaid: false, sortOrder: 11 },
];
