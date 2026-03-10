
export class MMCategories {
  static isBgm(id){
    return Object.keys({...this.generalBgm, ...this.specificBgm}).includes(id);
  }
  static isFanfare(id){
    return Object.keys({...this.generalFanfare, ...this.specificFanfare}).includes(id);
  }
  static toString(id){
    return this.all[id];
  }

  static get all(){
    return {...this.generalBgm, ...this.generalFanfare, ...this.specificBgm, ...this.specificFanfare};
  }

  static generalBgm = {
    "0": "Field",
    "1": "Towns",
    "2": "Dungeon",
    "3": "Indoors",
    "4": "Minigames",
    "5": "Action events",
    "6": "Calm events",
    "7": "Boss fights",
    "16": "Special"
  };
  
  static generalFanfare = {
    "8": "Item get",
    "9": "Game over",
    "10": "Area clear"
  };
  
  static specificBgm = {
    // 0 - Field
    "102": "Termina Field",
    "113": "Snowhead Mountains",
    "110": "Greay Bay Coast",
    "111": "Ikana Canyon",
    "10C": "Southern Swamp",
  
    // 1 - Towns
    "115": "Clocktown Day 1",
    "116": "Clocktown Day 2",
    "117": "Clocktown Day 3",
    "130": "Goron City",
    "12F": "Romani Ranch",
    "136": "Zora Hall",
    "112": "Deku Palace",
    "13B": "Caves",
  
    // 2 - Dungeon
    "165": "Snowhead Temple",
    "166": "Great Bay Temple",
    "114": "Pirate Fortress",
    "16F": "Ikana Castle",
    "106": "Stone Tower",
    "107": "Inverted Stone Tower",
    "11C": "Woodfall Temple",
  
    // 3 - Indoor
    "105": "Clock Tower",
    "12E": "Guru-Guru",
    "13C": "Milk Bar",
    "11F": "House",
    "144": "Shop",
    "146": "Shooting Gallery",
    "12C": "Marine Research Laboratory",
    "13A": "Astral Observatory",
    "127": "Music Box",
  
    // 4 - Minigames
    "126": "Goron Race",
    "125": "Minigame",
    "172": "Cremia's Carriage",
    "10E": "Boat Cruise",
    "140": "Horse Race",
  
    // 5 - Action events
    "131": "Mayor's Meeting",
    "10D": "Aliens",
    "150": "Swordman's School",
    "10F": "Sharp's Curse",
    "103": "Chase",
    "11A": "Combat",
    "17B": "Majora's Theme",
  
    // 6 - Calm events
    "104": "Skull Kid",
    "128": "Fairy Fountain",
    "118": "File Select",
    "173": "Keaton's Quiz",
    "145": "Kaepora Gaebora",
    "143": "Magic Hag's Potion Shop",
    "142": "Gorman Track",
    "13E": "Woods of Mystery",
    "129": "Zelda's Theme",
    "17D": "Tatl & Tael's Reunion",
    "10B": "Song of Healing",
    "12D": "Giant's Theme",
  
    // 7 - Boss fights
    "138": "Miniboss",
    "11B": "Boss",
    "16B": "Majora's Mask Battle",
    "16A": "Majora's Incarnation Battle",
    "169": "Majora's Wrath Battle",
  
    // 16 - Special
    "170": "Giants Cutscene",
    "176": "Title Screen",
    "16C": "Japas's Bass Practice",
    "16D": "Tijo's Drum Practice",
    "16E": "Evan's Piano Practice",
    "157": "Final Hours",
    "171": "Kamaro Dance (Item)",
    "12A": "Kamaro Dance (Rosa Sisters)"
  };
  
  static specificFanfare = {
    // 8 - Item get
    "122": "Item Get",
    "124": "Heart Get",
    "137": "Mask Get",
    "139": "Small Item Get",
    "13D": "Meet",
    "13F": "Goron Win",
    "141": "Horse Win",
    "152": "Song Get",
    "155": "Soar",
    "177": "Dungeon Open",
    "119": "Clear (Short)",
  
    // 9 - Game over
    "108": "Chase Fail",
    "109": "Fail",
    "120": "Game Over",
  
    // 10 - Area clear
    "121": "Boss Down",
    "178": "Dungeon Clear (Short)",
    "179": "Dungeon Clear (Long)",
    "17E": "Moon Clear",
    "17C": "Giants Leave",
  
    // None
    "12B": "Opening Chest"
  };
}