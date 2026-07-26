// These are tools for a posible universal set of tags for the packer.
// Helpful as a middle point for each rando different category system to be set by packer settings.
// Documentation on docs/tags.md.
// Based on MMR and DK64R (dk64randomizer.com).
export class Tags{

    // Maybe match a specific category by 2 matches of tags...?
    // Like HorseRace: put that one in any song that has: "Minigame-Happy", "Minigame-Goofy", "Minigame-Howdy", "Happy-Howdy", "Goofy-Howdy"
    // For the moment, only test on BGM until we are sure the theory is sound

    // Doing categorization this way will make all .ootrs to appear in OoT, and all .mmrs to appear in MM.
    // That of course is not the plan, but it should make way to 

    static toMM(tags){
        for (const [cat, value] of Object.entries(MM)) {
            
        }
    }

    static toOoT(tags){

    }

    static toOoT3D(tags){

    }


    static OoT = {
        "HyruleField":      [ "Field", "Happy" ],
        "LostWoods":        [ "Field", "Calm", "Nature" ],
        "GerudoValley":     [ "Field", "Happy", "Gloomy", "Dry" ],
        "Market":           [ "Town", "Happy", "Goofy" ],
        "KakarikoChild":    [ "Town", "Calm" ],
        "KakarikoAdult":    [ "Town", "Calm" ],
        "LonLonRanch":      [ "Town", "Calm", "Howdy" ],
        "KokiriForest":     [ "Town", "Happy", "Nature" ],
        "GoronCity":        [ "Town", "Happy", "Hot" ],
        "ZorasDomain":      [ "Town", "Calm", "Watery" ],
        "CastleCourtyard":  [ "Town", "Happy", "Goofy" ],
        "HorseRace":        [ "Minigame", "Happy", "Goofy", "Howdy" ],
        "Mini-game":        [ "Minigame", "Happy", "Goofy" ],
        "ShootingGallery":  [ "Interior", "Minigame", "Happy", "Goofy" ],
        "FairyFountain":    [ "Interior", "Calm", "Magical" ],
        "TempleOfTime":     [ "Interior", "Gloomy", "Calm", "Magical" ],
        "ChamberOfTheSages":[ "Interior", "Calm", "Magical" ],
        "House":            [ "Interior", "Happy", "Calm" ],
        "Shop":             [ "Interior", "Happy", "Goofy" ],
        "PotionShop":       [ "Interior", "Gloomy", "Spooky" ],
        "WindmillHut":      [ "Interior", "Minigame", "Happy", "Goofy" ],
        "InsideDekuTree":   [ "Dungeon", "Calm", "Nature", "Magical" ],
        "DodongosCavern":   [ "Dungeon", "Gloomy", "Calm", "Hot" ],
        "JabuJabu":         [ "Dungeon", "Gloomy", "Watery" ],
        "ForestTemple":     [ "Dungeon", "Gloomy", "Calm", "Nature", "Spooky" ],
        "FireTemple":       [ "Dungeon", "Happy", "Gloomy", "Hot" ],
        "IceCavern":        [ "Dungeon", "Calm", "Snowy" ],
        "WaterTemple":      [ "Dungeon", "Calm", "Watery", "Magical" ],
        "SpiritTemple":     [ "Dungeon", "Gloomy", "Calm", "Dry" ],
        "ShadowTemple":     [ "Dungeon", "Gloomy", "Spooky" ],
        "CastleUnderground":[ "Dungeon", "Gloomy", "Spooky" ],
        "CastleEscape":     [ "Fight", "Character", "Gloomy", "Spooky" ],
        "Battle":           [ "Fight", "Happy", "Gloomy" ],
        "MinibossBattle":   [ "Fight", "Happy", "Gloomy" ],
        "BossBattle":       [ "Fight", "Gloomy" ],
        "FireBoss":         [ "Fight", "Happy", "Hot" ],
        "GanondorfBattle":  [ "Fight", "Gloomy" ],
        "GanonBattle":      [ "Fight", "Calm", "Spooky" ],
        "TitleTheme":       [ "Character", "Calm" ],
        "ZeldaTheme":       [ "Character", "Happy", "Calm", "Magical" ],
        "SheikTheme":       [ "Character", "Happy", "Calm", "Magical" ],
        "DekuTree":         [ "Character", "Gloomy", "Nature" ],
        "KaeporaGaebora":   [ "Character", "Happy", "Goofy" ],
        "FairyFlying":      [ "Character", "Happy", "Nature", "Magical" ],
        "GanondorfTheme":   [ "Character", "Gloomy", "Spooky" ],
        "KotakeAndKoume":   [ "Character", "Gloomy", "Dry", "Spooky" ],
        "IngoTheme":        [ "Character", "Gloomy", "Calm", "Howdy" ]
    }

    static MM = {
        "10D": [ "Fight", "Gloomy", "Calm", "Spooky" ],	// Aliens' Theme
        "16F": [ "Dungeon", "Gloomy", "Calm", "Spooky" ],	// Ancient Castle of Ikana
        "13A": [ "Interior", "Calm", "Magical" ],	// Astral Observatory
        "16E": [ "Interior", "Calm", "Watery" ],	// Band Practice: Evan's Piano
        "16C": [ "Interior", "Gloomy", "Watery" ],	// Band Practice: Japas' Bass
        "16D": [ "Interior", "Happy", "Watery" ],	// Band Practice: Tijo's Drums
        "11A": [ "Fight", "Happy", "Gloomy" ],	// Battle
        "11B": [ "Fight", "Gloomy" ],	// Boss Battle
        "170": [ "Character", "Calm" ],	// Calling the Four Giants
        "105": [ "Interior", "Calm", "Spooky" ],	// Clock Tower
        "115": [ "Town", "Happy" ],	// Clock Town, First Day
        "116": [ "Town", "Happy", "Watery" ],	// Clock Town, Second Day
        "117": [ "Town", "Happy", "Gloomy", "Spooky" ],	// Clock Town, Third Day
        "172": [ "Town", "Character", "Calm", "Howdy" ],	// Cremia's Carriage
        "112": [ "Town", "Dungeon", "Happy", "Nature" ],	// Deku Palace
        "128": [ "Indoor", "Calm", "Magical" ],	// Fairy Fountain
        "157": [ "Character", "Gloomy", "Calm", "Spooky" ],	// Final Hours
        "12D": [ "Character", "Calm", "Magical" ],	// Giant's Theme
        "142": [ "Character", "Gloomy", "Calm", "Howdy" ],	// Gorman Brothers' Theme
        "126": [ "Minigame", "Happy", "Snowy", "Goofy" ],	// Goron Race
        "130": [ "Town", "Happy", "Hot", "Snowy" ],	// Goron Village
        "110": [ "Field", "Gloomy", "Watery" ],	// Great Bay Coast
        "166": [ "Dungeon", "Gloomy", "Watery" ],	// Great Bay Temple
        "12E": [ "Interior", "Minigame", "Happy", "Goofy" ],	// Guru-Guru's Theme
        "140": [ "Minigame", "Happy", "Goofy", "Howdy" ],	// Horse Race
        "111": [ "Field", "Gloomy", "Dry", "Spooky" ],	// Ikana Canyon
        "11F": [ "Interior", "Happy", "Calm" ],	// Inside a House
        "107": [ "Dungeon", "Calm", "Spooky", "Magical" ],	// Inverted Stone Tower Temple
        "144": [ "Interior", "Happy", "Goofy" ],	// Item Shop
        "145": [ "Character", "Happy", "Goofy" ],	// Kaepora Gaebora's Theme
        "171": [ "Character", "Calm", "Magical" ],	// Kamaro's Theme
        "173": [ "Character", "Calm", "Magical" ],	// Keaton's Quiz
        "143": [ "Character", "Gloomy", "Dry", "Spooky" ],	// Koume & Kotake's Theme
        "16A": [ "Fight", "Happy", "Goofy" ],	// Majora's Incarnation Battle
        "16B": [ "Fight", "Calm", "Spooky" ],	// Majora's Mask Battle
        "104": [ "Character", "Gloomy", "Spooky" ],	// Majora's Theme
        "169": [ "Fight", "Gloomy", "Spooky" ],	// Majora's Wrath Battle
        "12C": [ "Interior", "Gloomy", "Watery" ],	// Marine Research Lab
        "131": [ "Interior", "Fight", "Gloomy", "Spooky" ],	// Mayor Dotour's Office
        "13C": [ "Interior", "Happy", "Howdy" ],	// Milk Bar
        "138": [ "Fight", "Happy", "Gloomy" ],	// Mini Boss Battle
        "146": [ "Interior", "Minigame", "Happy", "Goofy" ],	// Minigame Shop
        "125": [ "Minigame", "Happy", "Goofy" ],	// Minigame
        "113": [ "Field", "Calm", "Snowy" ],	// Mountain Village
        "127": [ "Interior", "Happy", "Calm", "Goofy" ],	// Music Box House
        "10E": [ "Minigame", "Calm", "Nature" ],	// Old Koume's Boat Cruise
        "114": [ "Dungeon", "Gloomy", "Watery" ],	// Pirate's Fortress
        "103": [ "Fight", "Happy", "Gloomy" ],	// Pursuit Theme
        "12F": [ "Town", "Calm", "Howdy" ],	// Romani Ranch
        "12A": [ "Character", "Calm", "Magical" ],	// Rosa Sisters' Theme
        "13B": [ "Interior", "Town", "Gloomy", "Spooky" ],	// Secret Grotto
        "10F": [ "Fight", "Gloomy", "Spooky" ],	// Sharp's Curse
        "165": [ "Dungeon", "Gloomy", "Calm", "Snowy" ],	// Snowhead Temple
        "10B": [ "Town", "Character", "Calm", "Magical" ],	// Song of Healing
        "10C": [ "Field", "Gloomy", "Nature" ],	// Southern Swamp
        "106": [ "Dungeon", "Gloomy", "Dry", "Spooky" ],	// Stone Tower Temple
        "150": [ "Fight", "Calm" ],	// Swordman's School
        "17D": [ "Character", "Happy" ],	// Tatl & Tael Reunited
        "102": [ "Field", "Happy" ],	// Termina Field
        "17B": [ "Fight", "Gloomy", "Spooky" ],	// The Moon Enraged
        "176": [ "Character", "Calm", "Magical" ],	// Title Screen / File Select
        "11C": [ "Dungeon", "Happy", "Nature" ],	// Woodfall Temple
        "13E": [ "Field", "Character", "Calm", "Nature" ],	// Woods of Mystery
        "129": [ "Character", "Happy", "Calm", "Magical" ],	// Zelda's Theme
        "136": [ "Town", "Calm", "Watery" ],	// Zora's Hall
    }

    static OoTTo3D = {
        "HyruleField":      "!Hyrule Field",
        "LostWoods":        "!Lost Woods",
        "GerudoValley":     "!Gerudo Valley",
        "Market":           "!Market",
        "KakarikoChild":    "!Kakariko Child",
        "KakarikoAdult":    "!Kakariko Adult",
        "LonLonRanch":      "!Lon Lon Ranch",
        "KokiriForest":     "!Kokiri Forest",
        "GoronCity":        "!Goron City",
        "ZorasDomain":      "!Zora's Domain",
        "CastleCourtyard":  "!Castle Courtyard",
        "HorseRace":        "!Horse Race",
        "Mini-game":        "!Minigame Theme 1", // TODO: which is which?
        "ShootingGallery":  "!Minigame Theme 2",
        "FairyFountain":    "!Fairy Fountain",
        "TempleOfTime":     "!Temple of Time",
        "ChamberOfTheSages":"!Goddess Theme",
        "House":            "!House Theme",
        "Shop":             "!Shop Theme",
        "PotionShop":       "!Drugstore",
        "WindmillHut":      "!Windmill",
        "InsideDekuTree":   "!Deku Tree",
        "DodongosCavern":   "!Misc Dungeon",
        "JabuJabu":         "!Jabu Jabu",
        "ForestTemple":     "!Forest Temple",
        "FireTemple":       "!Fire Temple",
        "IceCavern":        "!Ice Cavern",
        "WaterTemple":      "!Water Temple",
        "SpiritTemple":     "!Spirit Temple",
        "ShadowTemple":     "!Shadow Temple",
        "CastleUnderground":"!Ganon's Castle",
        "CastleEscape":     "!Tower Escape",
        "Battle":           "!Enemy Theme",
        "MinibossBattle":   "!Mini Boss",
        "BossBattle":       "!Boss Theme 1", // TODO: AGAIN, WHICH IS WHICH?
        "FireBoss":         "!Boss Theme 2",
        "GanondorfBattle":  "!Ganondorf Battle",
        "GanonBattle":      "!Ganon Battle",
        "TitleTheme":       "!Title Screen",
        "ZeldaTheme":       "!Zelda's Theme",
        "SheikTheme":       "!Sheik's Theme",
        "DekuTree":         "!Deku Tree Storytime",
        "KaeporaGaebora":   "!Owl's Theme",
        "FairyFlying":      "!Navi Intro",
        "GanondorfTheme":   "!Ganondorf's Theme",
        "KotakeAndKoume":   "!Kotake & Koume",
        "IngoTheme":        "!Ingo's Theme"
    }

}