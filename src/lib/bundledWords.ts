/**
 * Bundled Word Data (Fallback)
 * 
 * This file contains the FIRST 15 words per category bundled with the app binary.
 * These are the FREE words available to all users.
 * Used as a fallback when:
 * - First launch with no internet connection
 * - No previously synced cache exists
 * 
 * When the app opens with internet, syncCategories() will fetch fresh
 * data from the database and update the local cache, which takes priority
 * over this bundled data.
 * 
 * SECURITY: Only free-tier words (first 15) are bundled to prevent
 * PRO word exposure in the app binary.
 */

export const BUNDLED_WORDS: Record<string, string[]> = {
  birds: ["Albatross","Alpine Swift","American Robin","Anhinga","Antbird","Apostlebird","Auk","Auklet","Australian Magpie","Barn Swallow","Bearded Reedling","Bee Eater","Bell Miner","Bellbird","Bittern"],
  desserts: ["Afghan Biscuit","Alfajor","Amaretti","Angel Food","Anmitsu","Anzac Biscuit","Apfelstrudel","Appeltaart","Arroz con Leche","Ashure","Baba au Rhum","Baci di Dama","Baked Alaska","Baklava","Balushahi"],
  car_brands: ["Abarth","AC Cars","Acura","Aiways","Aixam","Alfa Romeo","Allard","Alpina","Alpine","Alvis","AMC","AMG","Amilcar","Aprilia","Aptera"],
  ocean_animals: ["Abalone","Acorn Worm","Amberjack","Ammonite","Amphipod","Anchovy","Anemonefish","Angel Shark","Angelfish","Anglerfish","Anthias","Arapaima","Arrow Worm","Bamboo Shark","Bannerfish"],
  musical_instruments: ["Accordion","Agogo","Agung","Ajaeng","Alphorn","Alto Horn","Alto Saxophone","Angklung","Archlute","Autoharp","Babendil","Bagpipes","Balafon","Banjo","Bansuri"],
  kitchen_appliances: ["Aeropress","Air Fryer","Appam Maker","Apple Corer","Apron","Avocado Tool","Bagel Slicer","Baking Sheet","Balloon Whisk","Bamboo Paddle","Bamboo Steamer","Banana Slicer","Bar Spoon","Basting Brush","Basting Mop"],
  superheroes: ["Abe Sapien","Adam Warlock","Ajak","Alan Scott","Alfred","America Chavez","Angel","Animal Man","Anole","Ant Man","Aqualad","Aquaman","Archangel","Armor","Arsenal"],
  board_games: ["1989","Acquire","Aeons End","Aggravation","Agricola","Altiplano","Anachrony","Ankh","Apiary","Arboretum","Architects of the West Kingdom","Ares Expedition","Ark Nova","Arkham Horror","Arkham Horror Card Game"],
  trees: ["Acacia","Alaska Cedar","Aleppo Pine","American Elm","Amur Maple","Apple Tree","Apricot Tree","Araucaria","Areca Palm","Arroyo Willow","Ash","Aspen","Atlantic Cedar","Atlas Cedar","Austrian Pine"],
  scientists: ["Abdus Salam","Abel","Akasaki","Allport","Altman","Amano","Ampere","Anderson","Anfinsen","Archimedes","Arrhenius","Asch","Avogadro","Babbage","Baltimore"],
  video_game_characters: ["Abby","Ada Wong","Aerith","Akuma","Albert Wesker","Alduin","Alex","Aloy","Altair","Alyx Vance","Amy Rose","Arbiter","Arceus","Arthur Morgan","Artorias"],
};

/**
 * Bundled category metadata (fallback for first launch offline).
 * Matches the categories table in the database.
 */
export const BUNDLED_CATEGORIES = [
  { id: 'birds', name: 'Birds', emoji: '🦅', isPaid: false, sortOrder: 1 },
  { id: 'desserts', name: 'Desserts', emoji: '🍰', isPaid: false, sortOrder: 2 },
  { id: 'car_brands', name: 'Car Brands', emoji: '🚗', isPaid: false, sortOrder: 3 },
  { id: 'ocean_animals', name: 'Ocean Animals', emoji: '🐙', isPaid: false, sortOrder: 4 },
  { id: 'musical_instruments', name: 'Musical Instruments', emoji: '🎸', isPaid: false, sortOrder: 5 },
  { id: 'kitchen_appliances', name: 'Kitchen Tools', emoji: '🍳', isPaid: true, sortOrder: 6 },
  { id: 'superheroes', name: 'Superheroes', emoji: '🦸', isPaid: true, sortOrder: 7 },
  { id: 'board_games', name: 'Board Games', emoji: '🎲', isPaid: true, sortOrder: 8 },
  { id: 'trees', name: 'Trees', emoji: '🌳', isPaid: true, sortOrder: 9 },
  { id: 'scientists', name: 'Famous Scientists', emoji: '🔬', isPaid: true, sortOrder: 10 },
  { id: 'video_game_characters', name: 'Video Game Characters', emoji: '🎮', isPaid: true, sortOrder: 11 },
];
