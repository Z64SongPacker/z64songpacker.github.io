
// For simplicity sake, we will only map the exact specifity groups to mm categories
// That way we can use a single LUFS table (for the time beign)

import { MMCategories } from "./mmcategories.js";

export class OoTCategories{

  static getIdealLufs(categories){
    var lufs = [];
    for(var cat of categories){
      var id = cat; //.toUpperCase();
      if(this.field[id]) lufs.push(MMCategories.idealLufs["Field"]);
      else if(this.towns[id]) lufs.push(MMCategories.idealLufs["Towns"]);
      else if(this.dungeon[id]) lufs.push(MMCategories.idealLufs["Dungeon"]);
      else if(this.indoor[id]) lufs.push(MMCategories.idealLufs["Indoors"]);
      else if(this.minigames[id]) lufs.push(MMCategories.idealLufs["Minigames"]);
      else if(this.actionEvents[id]) lufs.push(MMCategories.idealLufs["Action events"]);
      else if(this.calmEvents[id]) lufs.push(MMCategories.idealLufs["Calm events"]);
      else if(this.bossFights[id]) lufs.push(MMCategories.idealLufs["Boss fights"]);
      else if(this.special[id]) lufs.push(MMCategories.idealLufs["Special"]);

      else if(this.itemGet[id]) lufs.push(MMCategories.idealLufs["Item get"]);
      else if(this.gameOver[id]) lufs.push(MMCategories.idealLufs["Game over"]);
      else if(this.areaClear[id]) lufs.push(MMCategories.idealLufs["Area clear"]);
      else console.log("NOT FOUND " + id); // TODO: HAVE A FAILSAFE LUFS
    }
    return lufs;
  }

  static field = [
    // 0 - Field
    "HyruleField",
    "LostWoods",
    "GerudoValley"
  ]

  static towns = [
    // 1 - Towns
    "Market",
    "KakarikoChild",
    "KakarikoAdult",
    "LonLonRanch",
    "KokiriForest",
    "GoronCity",
    "ZorasDomain",
    "InsideDekuTree"
  ]

  static dungeon = [
    // 2 - Dungeon
    "DodongosCavern",
    "JabuJabu",
    "ForestTemple",
    "FireTemple",
    "IceCavern",
    "WaterTemple",
    "SpiritTemple",
    "ShadowTemple",
    "CastleUnderground"
  ]

  static indoor = [
    // 3 - Indoor
    "House",
    "Shop",
    "PotionShop",
    "WindmillHut"
  ]

  static minigames = [
    // 4 - Minigames
    "CastleCourtyard",
    "HorseRace",
    "Mini-game",
    "ShootingGallery",
    "FairyFlying"
  ]

  static actionEvents = [
    // 5 - Action events
    "CastleEscape",
    "Battle",
    "GanondorfTheme"
  ]

  static calmEvents = [
    // 6 - Calm events
    "FairyFountain",
    "TempleOfTime",
    "ChamberOfTheSages",
    "ZeldaTheme",
    "SheikTheme",
    "DekuTree",
    "KaeporaGaebora",
    "KotakeAndKoume",
    "IngoTheme"
  ]

  static bossFights = [
    // 7 - Boss fights
    "MinibossBattle",
    "BossBattle",
    "FireBoss",
    "GanondorfBattle",
    "GanonBattle"
  ]

  static special = [
    // 16 - Special
    "TitleTheme"
  ]

  // ====================================== SPECIFIC FANFARE ==========================================
  
  static itemGet = [
    // 8 - Item get
    "ItemGet",
    "HeartContainerGet",
    "SpiritStoneGet",
    "HeartPieceGet",
    "MedallionGet",
    "LearnSong",
    "EponaRaceGoal",
    "ZeldaTurnsAround",
    "TreasureChest"
  ]

  static gameOver = [
    // 9 - Game over
    "GanondorfAppears",
    "GameOver"
  ]

  static areaClear = [
    // 10 - Area clear
    "BossDefeated",
    "EscapeFromRanch",
    "MasterSword",
    "DoorOfTime",

    // MM doesn't have these available, so I'll stuff them here, since they are pretty long for normal fanfares
    "PreludeOfLight",
    "BoleroOfFire",
    "MinuetOfForest",
    "SerenadeOfWater",
    "RequiemOfSpirit",
    "NocturneOfShadow",
    "SariasSong",
    "EponasSong",
    "ZeldasLullaby",
    "SunsSong",
    "SongOfTime",
    "SongOfStorms"
  ]

  /*static ocarinaSongs = [
    "PreludeOfLight",
    "BoleroOfFire",
    "MinuetOfForest",
    "SerenadeOfWater",
    "RequiemOfSpirit",
    "NocturneOfShadow",
    "SariasSong",
    "EponasSong",
    "ZeldasLullaby",
    "SunsSong",
    "SongOfTime",
    "SongOfStorms"
  ]*/
}