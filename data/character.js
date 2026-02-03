export const characterData = {
    name: "Gimli Ironfist",
    class: "Artificer (Battle Smith)",
    level: 6,
    race: "Mountain Dwarf",
    background: "Guild Artisan",
    alignment: "Lawful Good",
    stats: {
        str: 16,
        dex: 10,
        con: 16,
        int: 18,
        wis: 12,
        cha: 8
    },
    hp: {
        current: 51,
        max: 51,
        temp: 0
    },
    ac: 19,
    speed: 25,
    proficiencyBonus: 3,
    savingThrows: ["con", "int"],
    skills: {
        athletics: { proficient: true, expert: false },
        history: { proficient: true, expert: false },
        insight: { proficient: true, expert: false },
        investigation: { proficient: true, expert: false },
        perception: { proficient: true, expert: false }
    },
    features: [
        {
            name: "Magical Tinkering",
            description: "You learn how to invest a spark of magic into mundane objects. To use this ability, you must have thieves' tools or artisan's tools in hand. You then touch a tiny nonmagical object as an action and give it one of several magical properties.",
            source: "Artificer 1",
            details: "Properties: Light, Recorded Message, Odor/Sound, Static Visual Effect."
        },
        {
            name: "Infuse Item",
            description: "You've gained the ability to imbue mundane items with certain magical infusions.",
            source: "Artificer 2",
            details: "Infusions Known: 6. Items Infused: 3. Infusions: Enhanced Defense, Enhanced Weapon, Returning Weapon, Replicate Magic Item, etc.",
            limitedUse: {
                max: 3,
                reset: "longRest"
            }
        },
        {
            name: "The Right Tool for the Job",
            description: "You can magically create one set of artisan's tools in an unoccupied space within 5 feet of you. This creation requires 1 hour of uninterrupted work, which can coincide with a short or long rest.",
            source: "Artificer 3"
        },
        {
            name: "Tool Mastery",
            description: "Your proficiency bonus is now doubled for any ability check you make that uses your proficiency with a tool.",
            source: "Artificer 6"
        },
        {
            name: "Battle Ready",
            description: "When you attack with a magic weapon, you can use your Intelligence modifier, instead of Strength or Dexterity modifier, for the attack and damage rolls.",
            source: "Battle Smith 3"
        },
        {
            name: "Extra Attack",
            description: "You can attack twice, instead of once, whenever you take the Attack action on your turn.",
            source: "Artificer 5"
        }
    ],
    spells: {
        slots: {
            1: { max: 4, used: 0 },
            2: { max: 2, used: 0 }
        },
        prepared: [
            { name: "Cure Wounds", level: 1, type: "Artificer", description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier." },
            { name: "Shield", level: 1, type: "Battle Smith", description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile." },
            { name: "Heroism", level: 1, type: "Battle Smith", description: "A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to being frightened and gains temporary hit points equal to your spellcasting ability modifier at the start of each of its turns." },
            { name: "Thunderwave", level: 1, type: "Artificer", description: "A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw." },
            { name: "Blur", level: 2, type: "Battle Smith", description: "Your body becomes blurred, shifting and wavering to all who can see you. For the duration, any creature has disadvantage on attack rolls against you." },
            { name: "Branding Smite", level: 2, type: "Battle Smith", description: "The next time you hit a creature with a weapon attack before this spell ends, the weapon gleams with astral radiance as you strike. The attack deals an extra 2d6 radiant damage." }
        ],
        all: [
            { name: "Guidance", level: 0, description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice." },
            { name: "Mending", level: 0, description: "This spell repairs a single break or tear in an object you touch." },
            { name: "Cure Wounds", level: 1 },
            { name: "Faerie Fire", level: 1 },
            { name: "Grease", level: 1 },
            { name: "Heroism", level: 1 },
            { name: "Shield", level: 1 },
            { name: "Thunderwave", level: 1 },
            { name: "Aid", level: 2 },
            { name: "Blur", level: 2 },
            { name: "Branding Smite", level: 2 },
            { name: "Lesser Restoration", level: 2 },
            { name: "Warding Bond", level: 2 }
        ]
    },
    inventory: [
        { name: "Warhammer", type: "weapon", properties: "Versatile (1d10)", weight: 2, cost: "15 gp", equipped: true },
        { name: "Half Plate", type: "armor", properties: "AC 15 + Dex (max 2)", weight: 40, cost: "750 gp", equipped: true },
        { name: "Shield", type: "armor", properties: "AC +2", weight: 6, cost: "10 gp", equipped: true },
        { name: "Smith's Tools", type: "tools", weight: 8, cost: "20 gp" },
        { name: "Tinker's Tools", type: "tools", weight: 10, cost: "50 gp" }
    ],
    money: {
        cp: 0, sp: 0, gp: 120, ep: 0, pp: 0
    },
    steelDefender: {
        name: "Iron Defender",
        ac: 16,
        hp: { current: 35, max: 35 },
        speed: 40,
        stats: { str: 14, dex: 12, con: 14, int: 4, wis: 10, cha: 6 },
        actions: [
            { name: "Force-Empowered Rend", description: "Melee Attack Roll: +7 to hit, reach 5 ft. Hit: 1d8 + 4 force damage." },
            { name: "Repair (3/Day)", description: "The defender, or one Construct or object it can see within 5 feet of it, regains 2d8 + 4 HP.", limitedUse: { max: 3, reset: "longRest" } }
        ],
        reactions: [
            { name: "Deflect Attack", description: "Trigger: A creature the defender can see within 5 feet of it makes an attack roll targeting a different creature. Response: The triggering creature makes the attack roll with Disadvantage." }
        ]
    }
};
