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
    traits: [
        { name: "Poison Resistance", type: "R", note: "Resistance to Poison damage.", source: "Dwarven Resilience" },
        { name: "Poison Save Advantage", type: "A", note: "Advantage on saving throws to avoid or end the Poisoned condition.", source: "Dwarven Resilience" },
        { name: "Concentration Advantage", type: "A", note: "Advantage on Con saves for Concentration.", source: "Warcaster" }
    ],
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
            description: "You gain the following benefits:<br>• <strong>Luck Points.</strong> You have a number of Luck Points equal to your Proficiency Bonus (3) and can spend the points on the benefits below. You regain your expended Luck Points when you finish a Long Rest.<br>• <strong>Advantage.</strong> When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.<br>• <strong>Disadvantage.</strong> When a creature rolls a d20 for an attack roll against you, you can spend 1 Luck Point to impose Disadvantage on that roll.",
            source: "Feat (Background)",
            limitedUse: {
                max: 3,
                reset: "longRest"
            }
        },
        {
            name: "War Caster",
            description: "You gain the following benefits:<br>• <strong>Ability Score Increase.</strong> Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20 (already included).<br>• <strong>Concentration.</strong> You have Advantage on Constitution saving throws that you make to maintain Concentration.<br>• <strong>Reactive Spell.</strong> When a creature provokes an Opportunity Attack from you by leaving your reach, you can take a Reaction to cast a spell at the creature rather than making an Opportunity Attack. The spell must have a casting time of one action and must target only that creature.<br>• <strong>Somatic Components.</strong> You can perform the Somatic components of spells even when you have weapons or a Shield in one or both hands.",
            source: "Feat"
        },
        {
            name: "Tinker's Magic",
            description: "You know the <em>Mending</em> cantrip.<br><br>As a Magic action while holding Tinker’s Tools, you can create one item in an unoccupied space within 5 feet of yourself, choosing the item from the following list:<br>Ball Bearings, Flask, Pouch, Basket, Grappling Hook, Rope, Bedroll, Hunting Trap, Sack, Bell, Jug, Shovel, Blanket, Lamp, Spikes (Iron), Block and Tackle, Manacles, String, Bottle (Glass), Net, Tinderbox, Bucket, Oil, Torch, Caltrops, Paper, Vial, Candle, Parchment, Crowbar, Pole.<br><br>The item lasts until you finish a Long Rest, at which point it vanishes. You can use this feature a number of times equal to your Intelligence modifier (5), and you regain all expended uses when you finish a Long Rest.",
            source: "Artificer 1",
            limitedUse: {
                max: 5,
                reset: "longRest"
            }
        },
        {
            name: "Replicate Magic Item",
            description: "You have learned arcane plans that you use to make magic items.<br><br>• <strong>Creating an Item.</strong> When you finish a Long Rest, you can create up to 3 different magic items if you have Tinker’s Tools in hand. Each item is based on one of the plans you know for this feature.<br>• <strong>Attunement.</strong> If a created item requires Attunement, you can attune yourself to it the instant you create it.<br>• <strong>Max Items.</strong> You can’t have more magic items from this feature than the number shown in the Magic Items column of the Artificer Features table for your level (3 items at level 6). If you try to exceed your maximum number of magic items, the oldest item vanishes, and then the new item appears.<br>• <strong>Duration.</strong> A magic item created by this feature functions as the normal magic item, except its magic isn’t permanent; when you die, the magic item vanishes after 1d4 days. If you replace a plan you know with a new plan, any magic item created with the replaced plan immediately vanishes. If an item is a container (like a Bag of Holding), its contents appear in its space when it vanishes.<br>• <strong>Spellcasting Focus.</strong> You can use any Wand or Weapon created by this feature as a Spellcasting Focus.",
            source: "Artificer 2",
            limitedUse: {
                max: 3,
                reset: "longRest"
            }
        },
        {
            name: "Tools of the Trade",
            description: "You gain the following benefits:<br>• <strong>Tool Proficiency.</strong> You gain proficiency with Smith’s Tools. (If already proficient, choose another).<br>• <strong>Weapon Crafting.</strong> When you craft a nonmagical or magic weapon, the amount of time required to craft it is halved.",
            source: "Battle Smith 3"
        },
        {
            name: "Battle Ready",
            description: "Your combat training and your experiments with magic have paid off in two ways:<br>• <strong>Arcane Empowerment.</strong> When you attack with a magic weapon, you can use your Intelligence modifier, instead of your Strength or Dexterity modifier, for the attack and damage rolls.<br>• <strong>Weapon Knowledge.</strong> You gain proficiency with Martial weapons. You can use a weapon with which you have proficiency as a Spellcasting Focus for your Artificer spells.",
            source: "Battle Smith 3"
        },
        {
            name: "Extra Attack",
            description: "You can attack twice instead of once whenever you take the Attack action on your turn. You can forgo one of your attacks when you take the Attack action to command your Steel Defender to take the <em>Force-Empowered Rend</em> action.",
            source: "Artificer 5"
        },
        {
            name: "Magic Item Tinker",
            description: "Your Replicate Magic Item feature gains the following options:<br>• <strong>Charge Magic Item.</strong> As a Bonus Action, you can touch a magic item within 5 feet of yourself that you created with Replicate Magic Item and that uses charges. You expend a level 1+ spell slot and recharge the item. The number of charges the item regains is equal to the level of spell slot expended.<br>• <strong>Drain Magic Item.</strong> As a Bonus Action, you can touch a magic item within 5 feet of yourself that you created with Replicate Magic Item and cause the item to vanish, converting its magical energy into a spell slot. The slot is level 1 if the item is Common or level 2 if the item is Uncommon or Rare. Once used, you can’t do so again until you finish a Long Rest. Any spell slot you create vanishes when you finish a Long Rest.<br>• <strong>Transmute Magic Item.</strong> As a Magic action, you can touch one magic item within 5 feet of yourself that you created with Replicate Magic Item and transform it into a different magic item. The resulting item must be based on a magic item plan you know. Once used, you can’t do so again until you finish a Long Rest.",
            source: "Artificer 6",
            limitedUse: {
                max: 1,
                reset: "longRest"
            }
        },
        {
            name: "Spellcasting",
            description: "You have learned how to channel magical energy through objects.<br><br>• <strong>Tools Required.</strong> You produce your Artificer spells through tools. You can use Thieves’ Tools, Tinker’s Tools, or another kind of Artisan’s Tools with which you have proficiency as a Spellcasting Focus, and you must have one of those focuses in hand when you cast an Artificer spell (meaning the spell has an M component when you cast it).<br>• <strong>Cantrips.</strong> You know two Artificer cantrips. Whenever you finish a Long Rest, you can replace one of your cantrips with another Artificer cantrip of your choice.<br>• <strong>Prepared Spells.</strong> Whenever you finish a Long Rest, you can change your list of prepared spells, replacing any of the spells there with other Artificer spells for which you have spell slots.<br>• <strong>Spellcasting Ability.</strong> Intelligence is your spellcasting ability for your Artificer spells.",
            source: "Artificer 1"
        },
        {
            name: "Steel Defender",
            description: "Your tinkering has borne you a companion, a Steel Defender. It is Friendly to you and your allies and obeys you. It vanishes if you die.<br><br>• <strong>In Combat.</strong> In combat, the defender acts during your turn. It can move and take its Reaction on its own, but the only action it takes is the Dodge action unless you take a Bonus Action to command it to take an action. If you have the Incapacitated condition, the defender acts on its own.<br>• <strong>Restoring or Replacing.</strong> If the defender has died within the last hour, you can take a Magic action to touch it and expend a spell slot. The defender returns to life after 1 minute with all its Hit Points restored. Whenever you finish a Long Rest, you can create a new defender if you have Smith’s Tools in hand.",
            source: "Battle Smith 3"
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
                description: "Melee Attack Roll: Bonus equals your spell attack modifier (+8), reach 5 ft. Hit: 1d8 + 2 plus your Intelligence modifier (1d8 + 7) Force damage."
            },
            {
                name: "Repair (3/Day)",
                description: "The defender, or one Construct or object it can see within 5 feet of it, regains a number of Hit Points equal to 2d8 plus your Intelligence modifier (2d8 + 5).",
                limitedUse: { max: 3, reset: "longRest" }
            }
        ],
        reactions: [
            {
                name: "Deflect Attack",
                description: "<strong>Trigger:</strong> A creature the defender can see within 5 feet of it makes an attack roll targeting a different creature.<br><strong>Response:</strong> The triggering creature makes the attack roll with Disadvantage."
            }
        ]
    }
};
