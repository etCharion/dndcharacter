const INITIAL_CHARACTER_DATA = {
  name: "Gimli 'The Anvil' Ironfist",
  race: "Mountain Dwarf",
  class: "Artificer",
  subclass: "Forge of the Artificer",
  level: 6,
  proficiencyBonus: 3,
  stats: {
    STR: { value: 10, savingThrowProficiency: false },
    DEX: { value: 12, savingThrowProficiency: false },
    CON: { value: 16, savingThrowProficiency: true },
    INT: { value: 18, savingThrowProficiency: true },
    WIS: { value: 11, savingThrowProficiency: false },
    CHA: { value: 10, savingThrowProficiency: false }
  },
  vitals: {
    hp: { current: 51, max: 51, temp: 0 },
    ac: 20,
    initiative: 1,
    speed: 25,
    hitDice: { current: 6, max: 6, type: "d8" }
  },
  skills: [
    { name: "Acrobatics", stat: "DEX", proficient: false },
    { name: "Animal Handling", stat: "WIS", proficient: false },
    { name: "Arcana", stat: "INT", proficient: true },
    { name: "Athletics", stat: "STR", proficient: false },
    { name: "Deception", stat: "CHA", proficient: false },
    { name: "History", stat: "INT", proficient: true },
    { name: "Insight", stat: "WIS", proficient: false },
    { name: "Intimidation", stat: "CHA", proficient: false },
    { name: "Investigation", stat: "INT", proficient: true },
    { name: "Medicine", stat: "WIS", proficient: true },
    { name: "Nature", stat: "INT", proficient: true },
    { name: "Perception", stat: "WIS", proficient: true },
    { name: "Performance", stat: "CHA", proficient: false },
    { name: "Persuasion", stat: "CHA", proficient: false },
    { name: "Religion", stat: "INT", proficient: false },
    { name: "Sleight of Hand", stat: "DEX", proficient: false },
    { name: "Stealth", stat: "DEX", proficient: false },
    { name: "Survival", stat: "WIS", proficient: false }
  ],
  features: [
    {
      name: "Magical Tinkering",
      source: "Artificer",
      description: "You can invest a spark of magic into mundane objects.",
      limit: 4,
      uses: 0,
      reset: "long"
    },
    {
      name: "Infuse Item",
      source: "Artificer",
      description: "You can imbue mundane items with magical infusions. (3 active, 6 known)",
      limit: 3,
      uses: 0,
      reset: "long"
    },
    {
      name: "Master of the Forge",
      source: "Subclass",
      description: "Proficiency with heavy armor and smith's tools.",
      limit: null
    },
    {
      name: "Soul of the Forge",
      source: "Subclass",
      description: "+1 bonus to AC while wearing armor.",
      limit: null
    },
    {
      name: "Blessed by the Forge",
      source: "Subclass",
      description: "Grant a +1 bonus to a weapon or armor until next long rest.",
      limit: 1,
      uses: 0,
      reset: "long"
    }
  ],
  spellcasting: {
    ability: "INT",
    saveDC: 15,
    attackBonus: 7,
    slots: {
      1: { total: 4, used: 0 },
      2: { total: 2, used: 0 }
    },
    spells: [
      { name: "Guidance", level: 0, prepared: true, description: "Divination cantrip." },
      { name: "Fire Bolt", level: 0, prepared: true, description: "Evocation cantrip." },
      { name: "Cure Wounds", level: 1, prepared: true, description: "Heal a creature." },
      { name: "Shield", level: 1, prepared: true, description: "+5 AC as a reaction." },
      { name: "Identify", level: 1, prepared: true, description: "Identify magic items." },
      { name: "Heat Metal", level: 2, prepared: true, description: "Heat metal object." },
      { name: "Aid", level: 2, prepared: true, description: "Buff HP." }
    ]
  },
  inventory: [
    { id: 1, name: "Scale Mail +1", type: "armor", equipped: true, weight: 45, properties: "AC 15 + Dex(max 2)" },
    { id: 2, name: "Shield +1", type: "armor", equipped: true, weight: 6, properties: "AC +3" },
    { id: 3, name: "Warhammer", type: "weapon", equipped: true, weight: 2, properties: "1d8 bludgeoning", damage: "1d8", stat: "STR" }
  ],
  attacks: [
    { name: "Warhammer", bonus: 3, damage: "1d8+0", type: "Bludgeoning" },
    { name: "Fire Bolt", bonus: 7, damage: "2d10", type: "Fire" }
  ],
  currency: {
    gp: 150,
    sp: 20,
    cp: 0
  }
};
