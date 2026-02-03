import { allSpells } from './spells.js';
import { allPlans } from './plans.js';

export const characterData = {
    name: "Praštiklešť",
    class: "Artificer (Battle Smith)",
    level: 6,
    race: "Dwarf (Mountain Dwarf)",
    background: "Merchant",
    alignment: "Neutral",
    stats: {
        str: 11,
        dex: 16,
        con: 18,
        int: 20,
        wis: 14,
        cha: 16
    },
    hp: {
        current: 63,
        max: 63,
        temp: 0
    },
    ac: 19, // Half Plate (15) + Dex (2 max) + Shield (2) = 19. If they have Shield +1, it would be 20.
    speed: 30,
    proficiencyBonus: 3,
    savingThrows: ["con", "int"],
    skills: {
        acrobatics: { proficient: false, expert: false },
        animalHandling: { proficient: true, expert: false },
        arcana: { proficient: false, expert: false },
        athletics: { proficient: false, expert: false },
        deception: { proficient: false, expert: false },
        history: { proficient: false, expert: false },
        insight: { proficient: false, expert: false },
        intimidation: { proficient: false, expert: false },
        investigation: { proficient: false, expert: false },
        medicine: { proficient: false, expert: false },
        nature: { proficient: false, expert: false },
        perception: { proficient: false, expert: false, passive: 15 },
        performance: { proficient: false, expert: false },
        persuasion: { proficient: true, expert: false },
        religion: { proficient: false, expert: false },
        sleightOfHand: { proficient: false, expert: false },
        stealth: { proficient: false, expert: false },
        survival: { proficient: false, expert: false }
    },
    features: [
        {
            name: "Darkvision",
            description: "You have Darkvision with a range of 120 feet.",
            source: "Race"
        },
        {
            name: "Dwarven Resilience",
            description: "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.",
            source: "Race"
        },
        {
            name: "Dwarven Toughness",
            description: "Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level.",
            source: "Race"
        },
        {
            name: "Stonecunning",
            description: "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes while touching a stone surface.",
            source: "Race",
            limitedUse: {
                max: 3,
                reset: "longRest"
            }
        },
        {
            name: "Lucky",
            description: "You have Luck Points that you can spend to gain Advantage or impose Disadvantage on attack rolls against you.",
            source: "Feat (Background)",
            limitedUse: {
                max: 3,
                reset: "longRest"
            }
        },
        {
            name: "Warcaster",
            description: "Advantage on Con saves for Concentration. Can cast spells as reactions for opportunity attacks. Can perform Somatic components with weapons/shield.",
            source: "Feat"
        },
        {
            name: "Tinker's Magic",
            description: "You know the Mending cantrip. You can also create mundane items using Tinker's Tools.",
            source: "Artificer 1"
        },
        {
            name: "Replicate Magic Item",
            description: "You can create magic items from your known plans after a long rest.",
            source: "Artificer 2",
            limitedUse: {
                max: 3,
                reset: "longRest"
            }
        },
        {
            name: "Tools of the Trade",
            description: "Proficiency with Smith's Tools. Time required to craft weapons is halved.",
            source: "Battle Smith 3"
        },
        {
            name: "Battle Ready",
            description: "Use Intelligence for attack/damage rolls with magic weapons. Proficiency with Martial weapons.",
            source: "Battle Smith 3"
        },
        {
            name: "Extra Attack",
            description: "You can attack twice. You can forgo one attack to command your Steel Defender to take the Force-Empowered Rend action.",
            source: "Artificer 5"
        },
        {
            name: "Magic Item Tinker",
            description: "Recharge, Drain, or Transmute magic items created with Replicate Magic Item.",
            source: "Artificer 6",
            limitedUse: {
                max: 1,
                reset: "longRest"
            }
        }
    ],
    spells: {
        slots: {
            1: { max: 4, used: 0 },
            2: { max: 2, used: 0 }
        },
        prepared: allSpells.filter(s => s.alwaysPrepared || s.level === 0),
        all: allSpells
    },
    plans: {
        prepared: [],
        all: allPlans
    },
    inventory: [
        { name: "Navigator's Tools", type: "tools", weight: 2, cost: "25 gp" },
        { name: "Pouch", type: "gear", weight: 1, cost: "5 sp" },
        { name: "Pouch", type: "gear", weight: 1, cost: "5 sp" },
        { name: "Traveler's Clothes", type: "gear", weight: 4, cost: "2 gp" },
        { name: "Warhammer", type: "weapon", properties: "Versatile (1d10)", weight: 2, cost: "15 gp", equipped: true },
        { name: "Half Plate", type: "armor", properties: "AC 15 + Dex (max 2)", weight: 40, cost: "750 gp", equipped: true },
        { name: "Shield", type: "armor", properties: "AC +2", weight: 6, cost: "10 gp", equipped: true }
    ],
    money: {
        cp: 0, sp: 0, gp: 22, ep: 0, pp: 0
    },
    initiative: 3,
    speed: 30,
    spellSaveDC: 16,
    spellAttackBonus: 8,
    steelDefender: {
        name: "Steel Defender",
        ac: 17, // 12 + INT(5) = 17
        hp: { current: 35, max: 35 }, // 5 + 5*6 = 35
        speed: 40,
        stats: { str: 14, dex: 12, con: 14, int: 4, wis: 10, cha: 6 },
        actions: [
            {
                name: "Force-Empowered Rend",
                description: "Melee Attack Roll: +8 to hit, reach 5 ft. Hit: 1d8 + 5 force damage."
            },
            {
                name: "Repair (3/Day)",
                description: "The defender, or one Construct or object it can see within 5 feet of it, regains 2d8 + 5 HP.",
                limitedUse: { max: 3, reset: "longRest" }
            }
        ],
        reactions: [
            {
                name: "Deflect Attack",
                description: "Trigger: A creature the defender can see within 5 feet of it makes an attack roll targeting a different creature. Response: The triggering creature makes the attack roll with Disadvantage."
            }
        ]
    }
};
