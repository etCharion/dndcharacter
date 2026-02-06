import { characterData } from '../data/character.js';
import { auth, db, googleProvider } from './firebase-config.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let state = { ...characterData };
let currentUser = null;
let saveTimeout = null;

let uiState = {
    expandedFeatures: new Set(),
    expandedSpells: new Set(),
    expandedPlans: new Set(),
    expandedTraits: new Set(),
    expandedInventory: new Set(),
    expandedCustomAttacks: new Set(),
    featureFilters: new Set(),
    spellFilters: new Set(),
    inventoryFilters: new Set(),
    collapsedCategories: new Set(['actions', 'bonus-actions', 'reactions']),
    showCommonActions: {
        actions: true,
        'bonus-actions': false,
        reactions: false
    },
    tooltips: {}
};

const ITEM_TYPES = ['Weapon', 'Armor', 'Potion', 'Scroll', 'Tool', 'Gear', 'Consumable', 'Valuable', 'Other'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

const CONDITIONS_DATA = {
    'Blinded': 'Attacks against you have Advantage. Your attack rolls have Disadvantage. You fail any ability check that requires sight.',
    'Charmed': 'You can\'t attack the charmer or target them with harmful abilities. The charmer has Advantage on ability checks to interact socially with you.',
    'Deafened': 'You fail any ability check that requires hearing.',
    'Frightened': 'You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight. You can\'t willingly move closer to the source.',
    'Grappled': 'Your speed is 0. You have Disadvantage on attack rolls against anyone except the grappler. The grappler can move you.',
    'Incapacitated': 'You can\'t take actions, bonus actions, or reactions. Your concentration is broken. You can\'t speak.',
    'Invisible': 'You have Advantage on attack rolls. Attack rolls against you have Disadvantage. You aren\'t affected by features that require sight. You are heavily obscured.',
    'Paralyzed': 'You have the Incapacitated and Restrained conditions. You fail Str and Dex saves. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet.',
    'Petrified': 'You are transformed into inanimate material. You have the Incapacitated and Restrained conditions. Attack rolls against you have Advantage. You fail Str and Dex saves. You have Resistance to all damage and are immune to Poison.',
    'Poisoned': 'You have Disadvantage on attack rolls and ability checks.',
    'Prone': 'Your only movement option is to crawl. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet. Otherwise, the attack roll has Disadvantage.',
    'Restrained': 'Your speed is 0. Attack rolls against you have Advantage. Your attack rolls have Disadvantage. You have Disadvantage on Dex saves.',
    'Stunned': 'You have the Incapacitated and Restrained conditions. You fail Str and Dex saves. Attack rolls against you have Advantage.',
    'Unconscious': 'You have the Incapacitated and Restrained conditions. You are Prone. You fail Str and Dex saves. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet.'
};

syncStateWithMasterData(state);

const FEATURE_CATEGORIES = {
    'Race': (f) => f.source === 'Race',
    'Feats': (f) => f.source.includes('Feat'),
    'Class': (f) => f.source.includes('Artificer'),
    'Subclass': (f) => f.source.includes('Battle Smith')
};

const SPELL_FILTER_GROUPS = {
    level: ['Lv 0', 'Lv 1', 'Lv 2'],
    action: ['Action', 'Bonus Action', 'Reaction'],
    range: ['Touch'],
    effect: ['Damage']
};

const SPELL_FILTERS = {
    'Lv 0': (s) => s.level === 0,
    'Lv 1': (s) => s.level === 1,
    'Lv 2': (s) => s.level === 2,
    'Action': (s) => s.castingTime.includes('Action') && !s.castingTime.includes('Bonus'),
    'Bonus Action': (s) => s.castingTime.includes('Bonus Action'),
    'Reaction': (s) => s.castingTime.includes('Reaction'),
    'Touch': (s) => s.range === 'Touch',
    'Damage': (s) => (s.description || '').toLowerCase().includes('damage') || (s.name || '').toLowerCase().includes('smite')
};

// Helper to sync state with characterData (for updates/new features)
function syncStateWithMasterData(targetState) {
    if (!targetState.settings) {
        targetState.settings = {
            featureSort: 'name',
            spellSort: 'level',
            planSort: 'name',
            theme: 'punk-theme'
        };
    }
    if (!targetState.settings.theme) targetState.settings.theme = 'punk-theme';

    if (!targetState.plans) targetState.plans = characterData.plans;
    targetState.plans.all = characterData.plans.all;

    if (!targetState.spells) targetState.spells = characterData.spells;
    targetState.spells.all = characterData.spells.all;

    targetState.spells.prepared.forEach(ps => {
        const master = characterData.spells.all.find(s => s.name === ps.name);
        if (master) {
            const { alwaysPrepared, ...masterData } = master;
            Object.assign(ps, masterData);
            if (alwaysPrepared !== undefined) ps.alwaysPrepared = alwaysPrepared;
        }
    });

    targetState.features.forEach(f => {
        let master = characterData.features.find(mf => mf.name === f.name);
        if (!master && f.name === "Warcaster") {
            master = characterData.features.find(mf => mf.name === "War Caster");
        }
        if (master) {
            f.name = master.name;
            f.description = master.description;
            f.level = master.level;
            if (master.actions) f.actions = master.actions;
            else delete f.actions;

            if (master.limitedUse) {
                if (!f.limitedUse) {
                    f.limitedUse = { ...master.limitedUse, used: 0 };
                } else {
                    f.limitedUse.max = master.limitedUse.max;
                    f.limitedUse.reset = master.limitedUse.reset;
                }
            } else {
                delete f.limitedUse;
            }
        }
    });

    characterData.features.forEach(mf => {
        if (!targetState.features.some(f => f.name === mf.name)) {
            targetState.features.push({ ...mf });
        }
    });

    if (targetState.steelDefender) {
        if (targetState.steelDefender.actions) {
            targetState.steelDefender.actions.forEach(a => {
                const master = characterData.steelDefender.actions.find(ma => ma.name === a.name);
                if (master) a.description = master.description;
            });
        } else if (characterData.steelDefender.actions) {
            targetState.steelDefender.actions = characterData.steelDefender.actions;
        }

        if (targetState.steelDefender.reactions) {
            targetState.steelDefender.reactions.forEach(r => {
                const master = characterData.steelDefender.reactions.find(mr => mr.name === r.name);
                if (master) r.description = master.description;
            });
        } else if (characterData.steelDefender.reactions) {
            targetState.steelDefender.reactions = characterData.steelDefender.reactions;
        }

        ['immunities', 'senses', 'languages', 'traits', 'hitDice'].forEach(prop => {
            if (targetState.steelDefender[prop] === undefined && characterData.steelDefender[prop] !== undefined) {
                targetState.steelDefender[prop] = characterData.steelDefender[prop];
            }
        });
    }

    if (!targetState.traits) targetState.traits = characterData.traits || [];
    if (!targetState.settings.inventorySort) targetState.settings.inventorySort = 'name';

    targetState.inventory.forEach(item => {
        if (item.quantity === undefined) item.quantity = 1;
        if (item.weight === undefined) item.weight = 0;
        if (item.attackBonus === undefined) item.attackBonus = 0;
        if (item.damageBonus === undefined) item.damageBonus = 0;
        if (item.rarity === undefined) item.rarity = 'Common';
        if (item.description === undefined) item.description = item.properties || '';
        if (item.type) {
            const normalizedType = item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase();
            if (ITEM_TYPES.includes(normalizedType)) item.type = normalizedType;
            else if (normalizedType === 'Tools') item.type = 'Tool';
            else item.type = 'Other';
        } else {
            item.type = 'Other';
        }

        if (item.price === undefined) {
            item.price = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
            if (item.cost && typeof item.cost === 'string') {
                const parts = item.cost.toLowerCase().split(' ');
                const val = parseInt(parts[0]);
                const unit = parts[1];
                if (!isNaN(val) && unit) {
                    if (unit.startsWith('c')) item.price.cp = val;
                    else if (unit.startsWith('s')) item.price.sp = val;
                    else if (unit.startsWith('e')) item.price.ep = val;
                    else if (unit.startsWith('g')) item.price.gp = val;
                    else if (unit.startsWith('p')) item.price.pp = val;
                }
            }
        }

        // Clean up old fields
        delete item.cost;
        delete item.properties;
    });

    if (targetState.initiative === undefined) targetState.initiative = characterData.initiative || 0;
    if (targetState.speed === undefined) targetState.speed = characterData.speed || 30;
    if (targetState.spellSaveDC === undefined) targetState.spellSaveDC = characterData.spellSaveDC || 8;
    if (targetState.spellAttackBonus === undefined) targetState.spellAttackBonus = characterData.spellAttackBonus || 0;

    if (targetState.heroicInspiration === undefined) targetState.heroicInspiration = characterData.heroicInspiration || false;
    if (targetState.hitDice === undefined) targetState.hitDice = { ...characterData.hitDice };
    if (targetState.conditions === undefined) targetState.conditions = [...(characterData.conditions || [])];
    if (targetState.exhaustion === undefined) targetState.exhaustion = characterData.exhaustion || 0;
    if (!targetState.proficiencies) targetState.proficiencies = JSON.parse(JSON.stringify(characterData.proficiencies));
    if (!targetState.senses) targetState.senses = JSON.parse(JSON.stringify(characterData.senses || []));

    for (let skill in characterData.skills) {
        if (!targetState.skills[skill]) {
            targetState.skills[skill] = { ...characterData.skills[skill] };
        }
    }

    targetState.inventory.forEach(item => {
        if (item.type && item.type.toLowerCase() === 'weapon' && !item.preferredStat) {
            item.preferredStat = 'int'; // Default for Battle Smith
        }
    });

    // Ensure all inventory items have a unique ID
    targetState.inventory.forEach(item => {
        if (!item.id) {
            item.id = 'item_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }
    });

    // Initialize attacks list if missing
    if (!targetState.attacks) {
        targetState.attacks = [];
        // Migration: Add equipped weapons to the attacks list
        targetState.inventory.forEach(item => {
            if (item.type && item.type.toLowerCase() === 'weapon' && item.equipped) {
                targetState.attacks.push({
                    type: 'weapon',
                    itemId: item.id
                });
            }
        });
    } else {
        // Cleanup: remove weapon attacks if the item no longer exists in inventory
        targetState.attacks = targetState.attacks.filter(at => {
            if (at.type === 'weapon') {
                return targetState.inventory.some(item => item.id === at.itemId);
            }
            return true;
        });

        // Ensure custom attacks have IDs and bonuses
        targetState.attacks.forEach(at => {
            if (at.type !== 'weapon') {
                if (at.attackBonus === undefined) at.attackBonus = 0;
                if (at.damageBonus === undefined) at.damageBonus = 0;
                if (!at.id) {
                    at.id = 'atk_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                }
            }
        });
    }
}

function saveState() {
    if (!currentUser) return;

    // Debounce saves to Firestore
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            // Clean undefined values before saving to Firestore
            const cleanState = JSON.parse(JSON.stringify(state));
            await setDoc(doc(db, "users", currentUser.uid), cleanState);
            console.log("State saved to Firestore");
        } catch (e) {
            console.error("Error saving state: ", e);
        }
    }, 1000);
}

async function init() {
    setupAuth();
    setupEventListeners();
    renderTabs();
}

function applyTheme(theme) {
    document.body.classList.remove('punk-theme', 'parchment-theme');
    document.body.classList.add(theme);
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = theme;

    // Update browser theme color to match the theme
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'parchment-theme' ? '#8b4513' : '#a855f7');
    }
}

function setupAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('user-email').innerText = user.email;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');

            try {
                await loadState(user.uid);
            } catch (e) {
                console.error("Failed to load state, rendering with default/local state", e);
            }
            applyTheme(state.settings.theme || 'punk-theme');
            renderAll();
        } else {
            currentUser = null;
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
        }
    });

    document.getElementById('login-btn').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider);
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth);
    });

    document.getElementById('switch-account-btn').addEventListener('click', () => {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        signInWithPopup(auth, googleProvider);
    });
}

async function loadState(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        state = docSnap.data();
        syncStateWithMasterData(state);
    } else {
        // Migration from LocalStorage or New User
        const localData = localStorage.getItem('dnd_char_state');
        if (localData) {
            state = JSON.parse(localData);
            console.log("Migrated data from LocalStorage");
        } else {
            state = { ...characterData };
            console.log("New user, using default characterData");
        }
        syncStateWithMasterData(state);

        // Clean undefined values before saving initial state to Firestore
        const cleanState = JSON.parse(JSON.stringify(state));
        await setDoc(docRef, cleanState);
    }
}

function setupEventListeners() {
    document.getElementById('rest-short').addEventListener('click', () => {
        handleShortRest();
        renderAll();
    });
    document.getElementById('rest-long').addEventListener('click', () => {
        handleLongRest();
        renderAll();
    });
    document.getElementById('theme-select').addEventListener('change', (e) => {
        const newTheme = e.target.value;
        state.settings.theme = newTheme;
        applyTheme(newTheme);
        saveState();
    });
    attachInlineEdit(document.getElementById('char-name'), 'name');
}

function handleShortRest() {
    state.features.forEach(f => {
        if (f.limitedUse && f.limitedUse.reset === 'shortRest') {
            f.limitedUse.used = 0;
        }
    });
    saveState();
}

function handleLongRest() {
    // Reset Spell Slots
    for (let lvl in state.spells.slots) {
        state.spells.slots[lvl].used = 0;
    }

    // Reset Feature Uses
    state.features.forEach(f => {
        if (f.limitedUse) {
            f.limitedUse.used = 0;
        }
    });

    // Reset Steel Defender
    if (state.steelDefender) {
        if (state.steelDefender.actions) {
            state.steelDefender.actions.forEach(a => {
                if (a.limitedUse) a.limitedUse.used = 0;
            });
        }
        if (state.steelDefender.hp) state.steelDefender.hp.current = state.steelDefender.hp.max;
        if (state.steelDefender.hitDice) state.steelDefender.hitDice.current = state.steelDefender.hitDice.max;
    }

    // Recover Hit Dice (half of max, min 1)
    if (state.hitDice) {
        const recovery = Math.max(1, Math.floor(state.hitDice.max / 2));
        state.hitDice.current = Math.min(state.hitDice.max, state.hitDice.current + recovery);
    }

    // Reduce Exhaustion
    if (state.exhaustion > 0) {
        state.exhaustion -= 1;
    }

    state.hp.current = state.hp.max;
    saveState();
}

function renderTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

function renderStatusBar() {
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;

    statusBar.innerHTML = `
        <div class="status-item inspiration-toggle ${state.heroicInspiration ? 'active' : ''}" onclick="toggleHeroicInspiration()">
            <span class="status-icon">★</span>
            <span class="label">Heroic Inspiration</span>
        </div>
        <div class="status-item">
            <span class="label">Hit Dice (${state.hitDice.die})</span>
            <span class="value">
                <span class="editable" data-field="hitDice.current" data-type="number">${state.hitDice.current}</span> / <span class="editable" data-field="hitDice.max" data-type="number">${state.hitDice.max}</span>
            </span>
        </div>
        <div class="status-item exhaustion-tracker">
            <span class="label">Exhaustion</span>
            <div class="exhaustion-pips">
                ${[1, 2, 3, 4, 5, 6].map(lvl => `
                    <div class="exhaust-pip ${state.exhaustion >= lvl ? 'active' : ''}" onclick="updateExhaustion(${lvl})"></div>
                `).join('')}
            </div>
        </div>
        <div class="status-item conditions-status">
            <span class="label">Conditions</span>
            <div id="active-conditions" class="active-conditions-list">
                ${state.conditions.length > 0 ? state.conditions.map(c => `
                    <span class="condition-tag tooltip-trigger">
                        ${c}
                        <div class="tooltip">${CONDITIONS_DATA[c] || ''}</div>
                    </span>
                `).join('') : '<span class="no-conditions">None</span>'}
                <button class="add-condition-btn" onclick="toggleConditionsMenu(event)">+</button>
            </div>
            <div id="conditions-menu" class="conditions-menu hidden" onclick="event.stopPropagation()">
                <div class="conditions-menu-header">
                    <span>Manage Conditions</span>
                    <button onclick="toggleConditionsMenu(event)">×</button>
                </div>
                <div class="conditions-grid">
                    ${Object.keys(CONDITIONS_DATA).sort().map(c => `
                        <label class="condition-option">
                            <input type="checkbox" ${state.conditions.includes(c) ? 'checked' : ''} onchange="toggleCondition('${c}')">
                            ${c}
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    statusBar.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, true));
}

window.toggleHeroicInspiration = () => {
    state.heroicInspiration = !state.heroicInspiration;
    saveState();
    renderAll();
};

window.updateExhaustion = (lvl) => {
    if (state.exhaustion === lvl) state.exhaustion = lvl - 1;
    else state.exhaustion = lvl;
    saveState();
    renderAll();
};

window.toggleCondition = (c) => {
    const idx = state.conditions.indexOf(c);
    if (idx > -1) state.conditions.splice(idx, 1);
    else state.conditions.push(c);
    saveState();
    renderAll();
};

window.toggleConditionsMenu = (e) => {
    e.stopPropagation();
    const menu = document.getElementById('conditions-menu');
    menu.classList.toggle('hidden');
};

// Close menu when clicking outside
document.addEventListener('click', () => {
    const menu = document.getElementById('conditions-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

function renderStats() {
    renderStatusBar();
    // Character Name
    const nameEl = document.getElementById('char-name');
    nameEl.innerText = state.name;

    // Header Info Bar
    const headerInfo = document.getElementById('header-info');
    headerInfo.innerHTML = `
        <span>Race: <strong class="editable" data-field="race">${state.race}</strong></span>
        <span>Background: <strong class="editable" data-field="background">${state.background}</strong></span>
        <span>Level: <strong class="editable" data-field="level" data-type="number">${state.level}</strong></span>
    `;
    headerInfo.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, el.dataset.type === 'number'));

    // Compact Stats Bar (Attributes + Saves)
    const compactStats = document.getElementById('compact-stats');
    compactStats.innerHTML = '';
    const statsList = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    statsList.forEach(stat => {
        const val = state.stats[stat];
        const mod = Math.floor((val - 10) / 2);
        const isProficient = state.savingThrows.includes(stat);
        const saveMod = mod + (isProficient ? state.proficiencyBonus : 0);

        const div = document.createElement('div');
        div.className = 'stat-item';
        div.innerHTML = `
            <span class="label">${stat}</span>
            <span class="value editable" data-field="stats.${stat}" data-type="number">${val}</span>
            <span class="sub-value proficiency-toggle ${isProficient ? 'proficient' : ''}" onclick="toggleSavingThrow('${stat}')">Save: ${saveMod >= 0 ? '+' : ''}${saveMod}</span>
        `;
        compactStats.appendChild(div);
    });
    compactStats.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, true));

    // Combat Essentials
    const combatEssentials = document.getElementById('combat-essentials');
    combatEssentials.innerHTML = `
        <div class="essential-item">
            <span class="label">HP</span>
            <span class="value"><span class="editable" data-field="hp.current" data-type="number">${state.hp.current}</span> / <span class="editable" data-field="hp.max" data-type="number">${state.hp.max}</span></span>
        </div>
        <div class="essential-item">
            <span class="label">AC</span>
            <span class="value editable" data-field="ac" data-type="number">${state.ac}</span>
        </div>
        <div class="essential-item">
            <span class="label">Initiative</span>
            <span class="value editable" data-field="initiative" data-type="number">${state.initiative >= 0 ? '+' : ''}${state.initiative}</span>
        </div>
        <div class="essential-item">
            <span class="label">Speed</span>
            <span class="value editable" data-field="speed" data-type="number">${state.speed}</span>
        </div>
        <div class="essential-item">
            <span class="label">Proficiency</span>
            <span class="value">+${state.proficiencyBonus}</span>
        </div>
        <div class="essential-item">
            <span class="label">Spell DC</span>
            <span class="value editable" data-field="spellSaveDC" data-type="number">${state.spellSaveDC}</span>
        </div>
        <div class="essential-item">
            <span class="label">Spell Attack</span>
            <span class="value editable" data-field="spellAttackBonus" data-type="number">+${state.spellAttackBonus}</span>
        </div>
        <div class="essential-item">
            <span class="label">Passive Perc.</span>
            <span class="value editable" data-field="skills.perception.passive" data-type="number">${state.skills.perception.passive}</span>
        </div>
    `;
    combatEssentials.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, true));

    // Main Stats Grid - Compact Skills List
    const statsDiv = document.getElementById('stats-grid');
    statsDiv.innerHTML = '<h3>Skills</h3>';
    statsDiv.className = 'skills-container';

    // Sort skills alphabetically
    const sortedSkills = Object.keys(state.skills).sort();

    const skillList = document.createElement('div');
    skillList.className = 'skills-list';

    sortedSkills.forEach(skill => {
        const s = state.skills[skill];
        const ability = getAbilityForSkill(skill);
        const mod = Math.floor((state.stats[ability] - 10) / 2);
        const total = mod + (s.proficient ? state.proficiencyBonus : 0) + (s.expert ? state.proficiencyBonus : 0);
        // Note: s.expert adds another PB if already proficient, effectively doubling PB.
        // 2024 rules: total = mod + (proficient ? PB : 0) + (expert ? PB : 0)

        const displayName = skill.replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/^\w/, c => c.toUpperCase())
            .replace(/\bOf\b/g, 'of');

        const item = document.createElement('div');
        item.className = `skill-item ${s.proficient ? 'proficient' : ''} ${s.expert ? 'expert' : ''}`;
        item.innerHTML = `
            <div class="skill-prof-marker"></div>
            <span class="skill-total">${total >= 0 ? '+' : ''}${total}</span>
            <span class="skill-name">${displayName}</span>
            <span class="skill-ability">${ability.toUpperCase()}</span>
        `;
        item.onclick = () => toggleSkillProficiency(skill);
        skillList.appendChild(item);
    });
    statsDiv.appendChild(skillList);

    renderStatsExtras();
}

function renderStatsExtras() {
    const container = document.getElementById('stats-extras');
    if (!container) return;
    container.innerHTML = '';

    renderLimitedUseOverview(container);
    renderSteelDefenderOverview(container);
    renderTraitsOverview(container);
    renderProficienciesOverview(container);
    renderSensesOverview(container);
}

function renderProficienciesOverview(parent) {
    const section = document.createElement('div');
    section.className = 'extra-section';
    section.innerHTML = '<h3>Proficiencies</h3>';

    const categories = [
        { key: 'weapons', label: 'Weapons' },
        { key: 'armor', label: 'Armor' },
        { key: 'tools', label: 'Tools' },
        { key: 'languages', label: 'Languages' }
    ];

    categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'proficiency-category';
        catDiv.innerHTML = `
            <div class="category-header-small">
                <strong>${cat.label}</strong>
                <button class="small-btn" onclick="addProficiency('${cat.key}')">+</button>
            </div>
            <div class="proficiency-list">
                ${state.proficiencies[cat.key].map((p, i) => `
                    <div class="proficiency-item">
                        <span class="editable" data-field="proficiencies.${cat.key}.${i}">${p}</span>
                        <span class="delete-btn" onclick="deleteProficiency('${cat.key}', ${i})">×</span>
                    </div>
                `).join('')}
            </div>
        `;
        section.appendChild(catDiv);
    });

    section.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field));
    parent.appendChild(section);
}

window.addProficiency = (key) => {
    state.proficiencies[key].push("New proficiency");
    saveState();
    renderAll();
};

window.deleteProficiency = (key, index) => {
    state.proficiencies[key].splice(index, 1);
    saveState();
    renderAll();
};

function renderSensesOverview(parent) {
    const section = document.createElement('div');
    section.className = 'extra-section';
    section.innerHTML = '<h3>Senses <button onclick="addSense()">+ Add</button></h3>';

    const list = document.createElement('div');
    list.className = 'senses-list';
    state.senses.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'sense-item';
        item.innerHTML = `
            <strong class="editable" data-field="senses.${i}.name">${s.name}</strong>:
            <span class="editable" data-field="senses.${i}.value">${s.value}</span>
            <span class="delete-btn" onclick="deleteSense(${i})">×</span>
        `;
        list.appendChild(item);
    });
    section.appendChild(list);

    section.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field));
    parent.appendChild(section);
}

window.addSense = () => {
    state.senses.push({ name: "New Sense", value: "Value" });
    saveState();
    renderAll();
};

window.deleteSense = (i) => {
    state.senses.splice(i, 1);
    saveState();
    renderAll();
};

function renderLimitedUseOverview(parent) {
    const section = document.createElement('div');
    section.className = 'extra-section';
    section.innerHTML = '<h3>Limited Use</h3>';

    // Spell Slots
    for (let lvl in state.spells.slots) {
        const slot = state.spells.slots[lvl];
        const item = document.createElement('div');
        item.className = 'limited-use-stats-item';
        item.innerHTML = `
            <span class="feat-name" onclick="document.querySelector('[data-tab=\'spells\']').click()">Spell Slots Lvl ${lvl}</span>
            <div class="uses">
                <div class="limited-use">
                    ${Array.from({ length: slot.max }).map((_, i) => `
                        <input type="checkbox" ${i < slot.used ? 'checked' : ''} onclick="toggleSpellSlot(${lvl}, ${i})">
                    `).join('')}
                    <span>(longRest)</span>
                </div>
            </div>
        `;
        section.appendChild(item);
    }

    state.features.forEach((feat, index) => {
        if (feat.limitedUse) {
            const item = document.createElement('div');
            item.className = 'limited-use-stats-item';
            item.innerHTML = `
                <span class="feat-name" onclick="jumpToFeature(${index})">${feat.name}</span>
                <div class="uses">
                    ${renderLimitedUse(feat, 'feature', index)}
                </div>
            `;
            section.appendChild(item);
        }
    });
    parent.appendChild(section);
}

function renderSteelDefenderOverview(parent) {
    if (!state.steelDefender) return;
    const sd = state.steelDefender;
    const section = document.createElement('div');
    section.className = 'extra-section';
    section.innerHTML = '<h3>Steel Defender</h3>';

    const overview = document.createElement('div');
    overview.className = 'sd-overview-content';

    const intMod = Math.floor((state.stats.int - 10) / 2);
    sd.ac = 12 + intMod;
    sd.hp.max = 5 + (5 * state.level);

    overview.innerHTML = `
        <div class="sd-overview-grid">
            <div class="sd-stat"><strong>AC:</strong> ${sd.ac}</div>
            <div class="sd-stat"><strong>HP:</strong> <span class="editable" data-field="steelDefender.hp.current" data-type="number">${sd.hp.current}</span> / ${sd.hp.max}</div>
            <div class="sd-stat"><strong>Speed:</strong> ${sd.speed}</div>
            <div class="sd-stat"><strong>Perc:</strong> ${10 + state.proficiencyBonus}</div>
        </div>
        <div class="sd-actions-minimal">
            ${sd.actions ? sd.actions.map((a, i) => {
                if (!a.limitedUse) return '';
                return `
                <div class="limited-use-stats-item">
                    <span class="feat-name" onclick="document.querySelector('[data-tab=\'steel-defender\']').click()">${a.name}</span>
                    ${renderLimitedUse(a, 'sd-action', i)}
                </div>
                `;
            }).join('') : ''}
            ${sd.hitDice ? `
                <div class="limited-use-stats-item">
                    <span class="feat-name" onclick="document.querySelector('[data-tab=\'steel-defender\']').click()">Hit Dice (${sd.hitDice.max}d8)</span>
                    <div class="uses">
                        <div class="limited-use">
                            ${Array.from({ length: sd.hitDice.max }).map((_, i) => `
                                <input type="checkbox" ${i < (sd.hitDice.max - sd.hitDice.current) ? 'checked' : ''} onclick="toggleSDHitDice(${i})">
                            `).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    section.appendChild(overview);
    overview.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, true));
    parent.appendChild(section);
}

window.toggleSDHitDice = (useIndex) => {
    const sd = state.steelDefender;
    const currentUsed = sd.hitDice.max - sd.hitDice.current;

    if (useIndex < currentUsed) {
        sd.hitDice.current = sd.hitDice.max - useIndex;
    } else {
        sd.hitDice.current = sd.hitDice.max - (useIndex + 1);
    }

    saveState();
    renderAll();
};

window.updateWeaponStatById = (id, stat) => {
    const item = state.inventory.find(i => i.id === id);
    if (item) item.preferredStat = stat;
    saveState();
    renderAll();
};

function renderTraitsOverview(parent) {
    const section = document.createElement('div');
    section.className = 'extra-section';
    section.innerHTML = `
        <h3>Overviews <button onclick="addTrait()">+ Add</button></h3>
    `;

    state.traits.forEach((trait, index) => {
        const isExpanded = uiState.expandedTraits.has(index);
        const item = document.createElement('div');
        item.className = 'trait-item';
        item.innerHTML = `
            <div class="trait-header" onclick="toggleTrait(${index})">
                <div class="trait-icon ${trait.type}">${trait.type}</div>
                <strong class="trait-name editable" data-field="traits.${index}.name">${trait.name}</strong>
                <span class="delete-btn" onclick="event.stopPropagation(); deleteTrait(${index})">×</span>
            </div>
            <div class="trait-body ${isExpanded ? '' : 'hidden'}">
                <div class="editable" data-field="traits.${index}.note" data-type="textarea">${trait.note || 'No note.'}</div>
                <div class="trait-source">Source: <span class="editable" data-field="traits.${index}.source">${trait.source || 'Unknown'}</span></div>
                <div class="trait-type-selector">
                    Type: <select onchange="updateTraitType(${index}, this.value)">
                        <option value="A" ${trait.type === 'A' ? 'selected' : ''}>Advantage</option>
                        <option value="D" ${trait.type === 'D' ? 'selected' : ''}>Disadvantage</option>
                        <option value="R" ${trait.type === 'R' ? 'selected' : ''}>Resistance</option>
                        <option value="I" ${trait.type === 'I' ? 'selected' : ''}>Immunity</option>
                    </select>
                </div>
            </div>
        `;
        section.appendChild(item);
    });

    section.querySelectorAll('.editable').forEach(el => {
        el.addEventListener('click', (e) => e.stopPropagation());
        attachInlineEdit(el, el.dataset.field);
    });

    parent.appendChild(section);
}

window.toggleTrait = (index) => {
    if (uiState.expandedTraits.has(index)) {
        uiState.expandedTraits.delete(index);
    } else {
        uiState.expandedTraits.add(index);
    }
    renderAll();
};

window.toggleCustomAttackExpanded = (id) => {
    if (uiState.expandedCustomAttacks.has(id)) {
        uiState.expandedCustomAttacks.delete(id);
    } else {
        uiState.expandedCustomAttacks.add(id);
    }
    renderAll();
};

window.addTrait = () => {
    state.traits.push({ name: "New Trait", type: "A", note: "Add note here", source: "Add source here" });
    saveState();
    renderAll();
};

window.deleteTrait = (index) => {
    state.traits.splice(index, 1);
    saveState();
    renderAll();
};

window.updateTraitType = (index, val) => {
    state.traits[index].type = val;
    saveState();
    renderAll();
};

window.jumpToFeature = (originalIndex) => {
    // Switch to Features tab
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => {
        if (t.dataset.tab === 'features') {
            t.click();
        }
    });

    // Expand the feature
    uiState.expandedFeatures.add(originalIndex);
    renderAll();

    // Scroll into view
    setTimeout(() => {
        const featEl = document.querySelector(`.feature-item[data-index="${originalIndex}"]`);
        if (featEl) {
            featEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            featEl.classList.add('highlight-pulse');
            setTimeout(() => featEl.classList.remove('highlight-pulse'), 2000);
        }
    }, 150);
};

window.toggleSkillProficiency = (skill) => {
    state.skills[skill].proficient = !state.skills[skill].proficient;
    saveState();
    renderAll();
};

function getAbilityForSkill(skill) {
    const mapping = {
        animalHandling: 'wis',
        persuasion: 'cha',
        perception: 'wis',
        investigation: 'int',
        athletics: 'str',
        acrobatics: 'dex',
        sleightOfHand: 'dex',
        stealth: 'dex',
        arcana: 'int',
        history: 'int',
        nature: 'int',
        religion: 'int',
        insight: 'wis',
        medicine: 'wis',
        survival: 'wis',
        deception: 'cha',
        intimidation: 'cha',
        performance: 'cha'
    };
    return mapping[skill] || 'int';
}

function attachInlineEdit(element, field, isNumeric = false) {
    element.addEventListener('click', () => {
        if (element.querySelector('input') || element.querySelector('textarea')) return;

        const originalValue = element.innerText.replace('+', '').split('/')[0].trim();
        const type = element.dataset.type || (isNumeric ? 'number' : 'text');

        const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        if (type !== 'textarea') {
            input.type = type;
        }
        input.value = originalValue;
        input.className = 'inline-edit';
        if (type !== 'number') {
            input.classList.add('inline-edit-large');
        }

        const oldContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(input);
        input.focus();
        if (type !== 'textarea') {
            input.select();
        }

        const save = () => {
            let newValue = input.value;
            if (type === 'number') newValue = parseInt(newValue) || 0;
            updateStateByPath(field, newValue);
            renderAll();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (type !== 'textarea') {
                    save();
                } else if (e.ctrlKey) {
                    save();
                }
            }
            if (e.key === 'Escape') {
                element.innerHTML = oldContent;
                renderAll();
            }
        });
    });
}

window.toggleSavingThrow = (stat) => {
    const idx = state.savingThrows.indexOf(stat);
    if (idx > -1) {
        state.savingThrows.splice(idx, 1);
    } else {
        state.savingThrows.push(stat);
    }
    saveState();
    renderAll();
};

window.updateStateByPath = function(path, value) {
    const parts = path.split('.');
    let current = state;
    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;

    if (path === 'level') {
        state.proficiencyBonus = Math.floor((state.level - 1) / 4) + 2;
    }

    saveState();
}

function renderFeatures(filter = null) {
    if (filter === null) {
        const el = document.getElementById('feature-filter');
        filter = el ? el.value : '';
    }

    const tabEl = document.getElementById('features');
    let sortRow = tabEl.querySelector('.sort-row');
    if (!sortRow) {
        sortRow = document.createElement('div');
        sortRow.className = 'sort-row';
        sortRow.style.marginBottom = '15px';
        tabEl.querySelector('.filter-row').after(sortRow);
    }
    sortRow.innerHTML = `
        <span class="sort-label">Sort by:</span>
        <select class="sort-select" onchange="updateSort('feature', this.value)">
            <option value="name" ${state.settings.featureSort === 'name' ? 'selected' : ''}>Name</option>
            <option value="level" ${state.settings.featureSort === 'level' ? 'selected' : ''}>Level</option>
            <option value="source" ${state.settings.featureSort === 'source' ? 'selected' : ''}>Type (Source)</option>
        </select>
    `;

    const filterContainer = document.getElementById('feature-category-filters');
    if (filterContainer) {
        filterContainer.innerHTML = '';
        Object.keys(FEATURE_CATEGORIES).forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${uiState.featureFilters.has(cat) ? 'active' : ''}`;
            btn.innerText = cat;
            btn.onclick = () => toggleFeatureFilter(cat);
            filterContainer.appendChild(btn);
        });
    }

    const container = document.getElementById('features-list');
    container.innerHTML = '';

    // Create a copy for sorting/filtering
    const sortedFeatures = state.features.map((f, i) => ({ ...f, originalIndex: i }));

    const featureSort = state.settings.featureSort;
    sortedFeatures.sort((a, b) => {
        if (featureSort === 'level') {
            if ((a.level || 0) !== (b.level || 0)) return (a.level || 0) - (b.level || 0);
            return a.name.localeCompare(b.name);
        }
        if (featureSort === 'source') {
            if (a.source !== b.source) return a.source.localeCompare(b.source);
            return a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
    });

    sortedFeatures.forEach((feat) => {
        const index = feat.originalIndex;
        // Text filter
        if (filter && !feat.name.toLowerCase().includes(filter.toLowerCase()) && !feat.description.toLowerCase().includes(filter.toLowerCase())) {
            return;
        }

        // Category filter
        if (uiState.featureFilters.size > 0) {
            let matchesAny = false;
            uiState.featureFilters.forEach(cat => {
                if (FEATURE_CATEGORIES[cat](feat)) matchesAny = true;
            });
            if (!matchesAny) return;
        }

        const isExpanded = uiState.expandedFeatures.has(index);
        const item = document.createElement('div');
        item.className = `feature-item ${isExpanded ? 'expanded-item' : ''}`;
        item.dataset.index = index;
        item.innerHTML = `
            <div class="feature-header" onclick="toggleFeatureExpanded(${index})">
                <strong>${feat.name}</strong> <span>${feat.source}</span>
            </div>
            <div class="feature-body ${isExpanded ? '' : 'hidden'}">
                <div class="feature-desc">${feat.description}</div>
                ${feat.details ? `<div class="feature-details">${feat.details}</div>` : ''}
                ${feat.limitedUse ? renderLimitedUse(feat, 'feature', index) : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

window.toggleFeatureExpanded = (index) => {
    if (uiState.expandedFeatures.has(index)) {
        uiState.expandedFeatures.delete(index);
    } else {
        uiState.expandedFeatures.add(index);
    }
    const val = document.getElementById('feature-filter').value;
    renderFeatures(val);
};

window.toggleFeatureFilter = (cat) => {
    if (uiState.featureFilters.has(cat)) {
        uiState.featureFilters.delete(cat);
    } else {
        uiState.featureFilters.add(cat);
    }
    const val = document.getElementById('feature-filter').value;
    renderFeatures(val);
};

window.updateSort = (type, value) => {
    state.settings[`${type}Sort`] = value;
    saveState();
    if (type === 'feature') renderFeatures();
    if (type === 'spell') renderSpells();
    if (type === 'plan') renderPlans();
    if (type === 'inventory') renderInventory();
};

function renderLimitedUse(obj, type, index) {
    let html = '<div class="limited-use">';
    const used = obj.limitedUse.used || 0;
    for (let i = 0; i < obj.limitedUse.max; i++) {
        const checked = i < used ? 'checked' : '';
        html += `<input type="checkbox" ${checked} onclick="toggleLimitedUse('${type}', ${index}, ${i})">`;
    }
    html += ` <span>(${obj.limitedUse.reset})</span></div>`;
    return html;
}

window.toggleLimitedUse = (type, index, useIndex) => {
    let obj;
    if (type === 'feature') obj = state.features[index];
    if (type === 'sd-action') obj = state.steelDefender.actions[index];

    const used = obj.limitedUse.used || 0;
    if (useIndex < used) {
        obj.limitedUse.used = useIndex;
    } else {
        obj.limitedUse.used = useIndex + 1;
    }
    saveState();
    renderAll();
};

const CASTING_TIME_ORDER = {
    '1 Action': 1,
    '1 Bonus Action': 2,
    '1 Reaction': 3,
    '1 Minute': 4,
    '10 Minutes': 5,
    '1 Hour': 6,
    'Ritual': 7
};

function getCastingTimeValue(time) {
    if (time.includes('Action') && !time.includes('Bonus')) return 1;
    if (time.includes('Bonus Action')) return 2;
    if (time.includes('Reaction')) return 3;
    if (time.toLowerCase().includes('ritual') && !time.includes('Action')) return 7;
    const minutes = time.match(/(\d+) [Mm]inute/);
    if (minutes) return 10 + parseInt(minutes[1]);
    const hours = time.match(/(\d+) [Hh]our/);
    if (hours) return 100 + parseInt(hours[1]);
    return 999;
}

function getRangeValue(range) {
    if (range.toLowerCase() === 'self') return 0;
    if (range.toLowerCase() === 'touch') return 1;
    const feet = range.match(/(\d+) [Ff]eet/);
    if (feet) return parseInt(feet[1]);
    const miles = range.match(/(\d+) [Mm]ile/);
    if (miles) return parseInt(miles[1]) * 5280;
    return 999999;
}

function sortSpells(spells) {
    const spellSort = state.settings.spellSort;
    return [...spells].sort((a, b) => {
        if (spellSort === 'level') {
            if (a.level !== b.level) return a.level - b.level;
            return a.name.localeCompare(b.name);
        }
        if (spellSort === 'castingTime') {
            const valA = getCastingTimeValue(a.castingTime);
            const valB = getCastingTimeValue(b.castingTime);
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }
        if (spellSort === 'range') {
            const valA = getRangeValue(a.range);
            const valB = getRangeValue(b.range);
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
    });
}

function renderSpells(filter = null) {
    if (filter === null) {
        const el = document.getElementById('spell-filter');
        filter = el ? el.value : '';
    }

    const tabEl = document.getElementById('spells');
    let sortRow = tabEl.querySelector('.sort-row-spells');
    if (!sortRow) {
        sortRow = document.createElement('div');
        sortRow.className = 'sort-row-spells';
        sortRow.style.marginBottom = '15px';
        tabEl.querySelector('.spell-filters').appendChild(sortRow);
    }
    sortRow.innerHTML = `
        <span class="sort-label">Sort by:</span>
        <select class="sort-select" onchange="updateSort('spell', this.value)">
            <option value="name" ${state.settings.spellSort === 'name' ? 'selected' : ''}>Name</option>
            <option value="level" ${state.settings.spellSort === 'level' ? 'selected' : ''}>Level</option>
            <option value="castingTime" ${state.settings.spellSort === 'castingTime' ? 'selected' : ''}>Casting Time</option>
            <option value="range" ${state.settings.spellSort === 'range' ? 'selected' : ''}>Range</option>
        </select>
    `;

    const filterContainer = document.getElementById('spell-category-filters');
    if (filterContainer) {
        filterContainer.innerHTML = '';
        Object.keys(SPELL_FILTERS).forEach(fKey => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${uiState.spellFilters.has(fKey) ? 'active' : ''}`;
            btn.innerText = fKey;
            btn.onclick = () => toggleSpellFilter(fKey);
            filterContainer.appendChild(btn);
        });
    }

    const slotsDiv = document.getElementById('spell-slots');
    slotsDiv.innerHTML = '<h3>Spell Slots</h3>';
    for (let lvl in state.spells.slots) {
        const slot = state.spells.slots[lvl];
        const row = document.createElement('div');
        row.className = 'slot-row';
        row.innerHTML = `<span>Level ${lvl}:</span>`;
        for (let i = 0; i < slot.max; i++) {
            const checked = i < slot.used ? 'checked' : '';
            row.innerHTML += `<input type="checkbox" ${checked} onclick="toggleSpellSlot(${lvl}, ${i})">`;
        }
        slotsDiv.appendChild(row);
    }

    const preparedDiv = document.getElementById('prepared-spells');
    preparedDiv.innerHTML = '<h3>Prepared Spells</h3>';

    const matchesFilters = (spell) => {
        // Text filter
        if (filter && !spell.name.toLowerCase().includes(filter.toLowerCase()) && !spell.description.toLowerCase().includes(filter.toLowerCase())) {
            return false;
        }

        // Category filters (Additive/AND across groups, OR within groups)
        for (const group in SPELL_FILTER_GROUPS) {
            const groupFilters = SPELL_FILTER_GROUPS[group];
            const activeInGroup = groupFilters.filter(f => uiState.spellFilters.has(f));

            if (activeInGroup.length > 0) {
                const matchesAnyInGroup = activeInGroup.some(f => SPELL_FILTERS[f](spell));
                if (!matchesAnyInGroup) return false;
            }
        }
        return true;
    };

    const sortedPrepared = sortSpells(state.spells.prepared);
    sortedPrepared.forEach((spell) => {
        if (!matchesFilters(spell)) return;
        const originalIdx = state.spells.prepared.findIndex(p => p.name === spell.name);
        const isExpanded = uiState.expandedSpells.has('prepared-' + spell.name);
        const sDiv = document.createElement('div');
        sDiv.className = `spell-item ${isExpanded ? 'expanded-item' : ''}`;

        const comps = spell.components ? spell.components.split('(')[0].trim() : '';
        const previewInfo = `Lvl ${spell.level} | ${spell.castingTime} | ${spell.range} | ${spell.duration} | ${comps}`;

        const castBtn = spell.level > 0 ? `<button onclick="event.stopPropagation(); castSpell(${originalIdx})">Cast</button>` : '';
        const unprepareBtn = (spell.alwaysPrepared || spell.level === 0) ? '' : `<button onclick="event.stopPropagation(); unprepareSpell(${originalIdx})">Unprepare</button>`;

        sDiv.innerHTML = `
            <div onclick="toggleSpellExpanded('prepared-${spell.name}')">
                <div class="spell-header">
                    <strong>${spell.name}</strong>
                    <span class="spell-preview">${previewInfo}</span>
                    <div class="spell-actions">
                        ${castBtn}
                        ${unprepareBtn}
                    </div>
                </div>
                <div class="spell-desc ${isExpanded ? '' : 'hidden'}">
                    <div><em>${spell.school || ''} | ${spell.type || ''}</em></div>
                    ${spell.description || 'No description.'}
                </div>
            </div>
        `;
        preparedDiv.appendChild(sDiv);
    });

    const allSpellsDiv = document.getElementById('all-spells-list');
    allSpellsDiv.innerHTML = '<h3>All Known Spells</h3>';
    const sortedAll = sortSpells(state.spells.all);
    sortedAll.forEach((spell) => {
        if (!matchesFilters(spell)) return;
        const isPrepared = state.spells.prepared.some(p => p.name === spell.name);
        if (isPrepared) return;
        const originalIdx = state.spells.all.findIndex(s => s.name === spell.name);
        const isExpanded = uiState.expandedSpells.has('all-' + spell.name);
        const sDiv = document.createElement('div');
        sDiv.className = `spell-item-all ${isExpanded ? 'expanded-item' : ''}`;

        const comps = spell.components ? spell.components.split('(')[0].trim() : '';
        const previewInfo = `Lvl ${spell.level} | ${spell.castingTime} | ${spell.range} | ${spell.duration} | ${comps}`;

        sDiv.innerHTML = `
            <div onclick="toggleSpellExpanded('all-${spell.name}')">
                <div class="spell-header">
                    <strong>${spell.name}</strong>
                    <span class="spell-preview">${previewInfo}</span>
                    <button onclick="event.stopPropagation(); prepareSpell(${originalIdx})">Prepare</button>
                </div>
                <div class="spell-desc ${isExpanded ? '' : 'hidden'}">
                    <div><em>${spell.school || ''} | ${spell.type || ''}</em></div>
                    ${spell.description || 'No description.'}
                </div>
            </div>
        `;
        allSpellsDiv.appendChild(sDiv);
    });
}

window.toggleSpellExpanded = (id) => {
    if (uiState.expandedSpells.has(id)) {
        uiState.expandedSpells.delete(id);
    } else {
        uiState.expandedSpells.add(id);
    }
    renderSpells();
};

window.toggleSpellFilter = (fKey) => {
    if (uiState.spellFilters.has(fKey)) {
        uiState.spellFilters.delete(fKey);
    } else {
        uiState.spellFilters.add(fKey);
    }
    renderSpells();
};

window.toggleSpellSlot = (lvl, index) => {
    const slot = state.spells.slots[lvl];
    if (index < slot.used) {
        slot.used = index;
    } else {
        slot.used = index + 1;
    }
    saveState();
    renderAll();
};

window.castSpell = (idx) => {
    const spell = state.spells.prepared[idx];
    if (spell.level > 0) {
        if (state.spells.slots[spell.level].used < state.spells.slots[spell.level].max) {
            state.spells.slots[spell.level].used++;
            saveState();
            renderAll();
        } else {
            alert('No slots left!');
        }
    }
};

window.prepareSpell = (idx) => {
    state.spells.prepared.push(state.spells.all[idx]);
    saveState();
    renderAll();
};

window.unprepareSpell = (idx) => {
    state.spells.prepared.splice(idx, 1);
    saveState();
    renderAll();
};

const COMMON_ACTIONS = [
    { name: "Attack", description: "Make one melee or ranged attack, or multiple if you have Extra Attack." },
    { name: "Dash", description: "Gain extra movement for the current turn equal to your Speed." },
    { name: "Disengage", description: "Your movement doesn't provoke Opportunity Attacks for the rest of the turn." },
    { name: "Dodge", description: "Attack rolls against you have Disadvantage, and you have Advantage on Dex saves." },
    { name: "Help", description: "Give Advantage to a creature's next ability check or attack roll." },
    { name: "Hide", description: "Make a Stealth check to become Hidden." },
    { name: "Magic", description: "Cast a spell, use a magic item, or use a feature that requires this action." },
    { name: "Ready", description: "Define a trigger and an action to take as a Reaction when the trigger occurs." },
    { name: "Search", description: "Make a Wisdom (Perception) or Wisdom (Insight) check." },
    { name: "Study", description: "Make an Intelligence check (Arcana, History, Nature, Religion, etc.)." },
    { name: "Utter", description: "Speak briefly or use a command word of a magic item." },
    { name: "Influence", description: "Make a Charisma check (Deception, Intimidation, Performance, Persuasion) to influence a creature." }
];

const COMMON_REACTIONS = [
    { name: "Opportunity Attack", description: "Make one melee attack against a creature that leaves your reach without Disengaging." }
];

window.toggleCategory = (cat) => {
    if (uiState.collapsedCategories.has(cat)) {
        uiState.collapsedCategories.delete(cat);
    } else {
        uiState.collapsedCategories.add(cat);
    }
    renderCombatActions();
};

window.toggleCommonActions = (cat) => {
    uiState.showCommonActions[cat] = !uiState.showCommonActions[cat];
    renderCombatActions();
};

function renderCombatActions() {
    const actionsList = document.getElementById('actions-list');
    const bonusActionsList = document.getElementById('bonus-actions-list');
    const reactionsList = document.getElementById('reactions-list');

    if (!actionsList || !bonusActionsList || !reactionsList) return;

    // Handle collapsed states and UI icons
    const categories = ['actions', 'bonus-actions', 'reactions'];
    categories.forEach(cat => {
        const container = document.getElementById(`${cat}-list`);
        const wrapper = document.getElementById(`category-${cat}`);
        const checkbox = document.getElementById(`toggle-common-${cat === 'actions' ? 'actions' : cat}`);
        const isCollapsed = uiState.collapsedCategories.has(cat);

        if (isCollapsed) {
            container.classList.add('hidden');
            wrapper.classList.add('collapsed');
        } else {
            container.classList.remove('hidden');
            wrapper.classList.remove('collapsed');
        }

        if (checkbox) {
            checkbox.checked = uiState.showCommonActions[cat];
        }
    });

    actionsList.innerHTML = '';
    bonusActionsList.innerHTML = '';
    reactionsList.innerHTML = '';

    // Helper to render action items
    const createActionItem = (name, description, isCommon = false, featIndex = null) => {
        const item = document.createElement('div');
        item.className = `combat-action-item ${isCommon ? 'common' : 'specific'}`;

        let header = '';
        let usesHtml = '';
        if (featIndex !== null) {
            const feat = state.features[featIndex];
            header = `<strong class="feat-name" onclick="jumpToFeature(${featIndex})">${name}</strong>`;
            if (feat.limitedUse) {
                usesHtml = `<div class="action-uses">${renderLimitedUse(feat, 'feature', featIndex)}</div>`;
            }
        } else {
            header = `<strong>${name}</strong>`;
        }

        item.innerHTML = `
            <div class="action-main">
                ${header}
                <div class="action-preview">${description}</div>
            </div>
            ${usesHtml}
        `;
        return item;
    };

    // Render Common Actions
    if (uiState.showCommonActions.actions) {
        COMMON_ACTIONS.forEach(action => {
            actionsList.appendChild(createActionItem(action.name, action.description, true));
        });
    }

    if (uiState.showCommonActions.reactions) {
        COMMON_REACTIONS.forEach(reaction => {
            reactionsList.appendChild(createActionItem(reaction.name, reaction.description, true));
        });
    }

    // Extract Specific Actions from Features
    state.features.forEach((feat, index) => {
        if (feat.actions) {
            feat.actions.forEach(action => {
                let targetList = null;
                const type = action.type.toLowerCase();
                if (type.includes('bonus')) targetList = bonusActionsList;
                else if (type.includes('reaction')) targetList = reactionsList;
                else targetList = actionsList; // Default to Action (handles "Magic Action", "Action", etc.)

                targetList.appendChild(createActionItem(action.name, action.description, false, index));
            });
        }
    });
}

window.renderInventory = function(filter = null) {
    if (filter === null) {
        const el = document.getElementById('inventory-filter');
        filter = el ? el.value : '';
    }

    const filterContainer = document.getElementById('inventory-category-filters');
    if (filterContainer) {
        filterContainer.innerHTML = '';
        ITEM_TYPES.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${uiState.inventoryFilters.has(cat) ? 'active' : ''}`;
            btn.innerText = cat;
            btn.onclick = () => toggleInventoryFilter(cat);
            filterContainer.appendChild(btn);
        });
    }

    const invDiv = document.getElementById('inventory-list');
    invDiv.innerHTML = '';

    // Calculate Totals
    let totalWeight = 0;
    let totalValueCP = 0;

    // Item Weight/Value
    state.inventory.forEach(item => {
        totalWeight += (item.weight || 0) * (item.quantity || 1);
        totalValueCP += getPriceInCP(item.price) * (item.quantity || 1);
    });

    // Coin Weight
    const coinCount = (state.money.cp || 0) + (state.money.sp || 0) + (state.money.ep || 0) + (state.money.gp || 0) + (state.money.pp || 0);
    const coinWeight = coinCount / 50;
    totalWeight += coinWeight;

    const moneyDiv = document.getElementById('money-display');
    if (moneyDiv) {
        moneyDiv.innerHTML = `
            <div class="totals-row">
                <div class="total-item">
                    <span class="label">Total Weight:</span>
                    <span class="value"><strong>${totalWeight.toFixed(2)}</strong> lbs</span>
                    <span class="sub-label">(incl. ${coinWeight.toFixed(2)} lbs coins)</span>
                </div>
                <div class="total-item">
                    <span class="label">Total Value:</span>
                    <span class="value">${formatCurrency(totalValueCP)}</span>
                </div>
            </div>
            <div class="coins-editor">
                <div class="coin-input"><span>PP</span><input type="number" value="${state.money.pp}" onchange="updateMoney('pp', this.value)"></div>
                <div class="coin-input"><span>GP</span><input type="number" value="${state.money.gp}" onchange="updateMoney('gp', this.value)"></div>
                <div class="coin-input"><span>EP</span><input type="number" value="${state.money.ep}" onchange="updateMoney('ep', this.value)"></div>
                <div class="coin-input"><span>SP</span><input type="number" value="${state.money.sp}" onchange="updateMoney('sp', this.value)"></div>
                <div class="coin-input"><span>CP</span><input type="number" value="${state.money.cp}" onchange="updateMoney('cp', this.value)"></div>
            </div>
        `;
    }

    // Sort and Filter Items
    const items = state.inventory.map((item, idx) => ({ ...item, originalIndex: idx }));

    const inventorySort = state.settings.inventorySort;
    items.sort((a, b) => {
        if (inventorySort === 'price') return getPriceInCP(b.price) - getPriceInCP(a.price);
        if (inventorySort === 'weight') return (b.weight || 0) - (a.weight || 0);
        if (inventorySort === 'type') return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
    });

    items.forEach((item) => {
        const idx = item.originalIndex;

        // Text Filter
        if (filter && !item.name.toLowerCase().includes(filter.toLowerCase()) && !item.description.toLowerCase().includes(filter.toLowerCase())) {
            return;
        }

        // Category Filter
        if (uiState.inventoryFilters.size > 0 && !uiState.inventoryFilters.has(item.type)) {
            return;
        }

        const isExpanded = uiState.expandedInventory.has(idx);
        const iDiv = document.createElement('div');
        iDiv.className = `inv-item-card ${isExpanded ? 'expanded-item' : ''}`;

        const priceSummary = getPriceInCP(item.price) > 0 ? formatCurrency(getPriceInCP(item.price)) : '';

        iDiv.innerHTML = `
            <div class="inv-item-header" onclick="toggleInventoryExpanded(${idx})">
                <div class="inv-item-main-info">
                    <span class="inv-item-qty">x<strong class="editable" data-field="inventory.${idx}.quantity" data-type="number">${item.quantity}</strong></span>
                    <strong class="inv-item-name editable" data-field="inventory.${idx}.name">${item.name}</strong>
                    <span class="inv-item-type">${item.type}</span>
                </div>
                <div class="inv-item-meta">
                    <span class="inv-item-weight">${item.weight} lbs</span>
                    <span class="inv-item-price">${priceSummary}</span>
                    <label onclick="event.stopPropagation()"><input type="checkbox" ${item.equipped ? 'checked' : ''} onchange="toggleEquip(${idx})"> Equip</label>
                    <button class="delete-btn" onclick="event.stopPropagation(); removeItem(${idx})">×</button>
                </div>
            </div>
            <div class="inv-item-body ${isExpanded ? '' : 'hidden'}">
                <div class="inv-item-details-grid">
                    <div class="detail-field">
                        <label>Description</label>
                        <div class="editable" data-field="inventory.${idx}.description" data-type="textarea">${item.description || 'No description.'}</div>
                    </div>
                    <div class="detail-field-row">
                        <div class="detail-field">
                            <label>Type</label>
                            <select onchange="updateItem(${idx}, 'type', this.value)">
                                ${ITEM_TYPES.map(t => `<option value="${t}" ${item.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="detail-field">
                            <label>Rarity</label>
                            <select onchange="updateItem(${idx}, 'rarity', this.value)">
                                ${RARITIES.map(r => `<option value="${r}" ${item.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                        </div>
                        <div class="detail-field">
                            <label>Weight (ea)</label>
                            <span class="editable" data-field="inventory.${idx}.weight" data-type="number">${item.weight}</span>
                        </div>
                    </div>
                    <div class="detail-field price-editor">
                        <label>Price (ea)</label>
                        <div class="price-inputs-row">
                            <div class="coin-input"><span>PP</span><input type="number" value="${item.price.pp}" onchange="updateStateByPath('inventory.${idx}.price.pp', parseInt(this.value) || 0); renderAll()"></div>
                            <div class="coin-input"><span>GP</span><input type="number" value="${item.price.gp}" onchange="updateStateByPath('inventory.${idx}.price.gp', parseInt(this.value) || 0); renderAll()"></div>
                            <div class="coin-input"><span>EP</span><input type="number" value="${item.price.ep}" onchange="updateStateByPath('inventory.${idx}.price.ep', parseInt(this.value) || 0); renderAll()"></div>
                            <div class="coin-input"><span>SP</span><input type="number" value="${item.price.sp}" onchange="updateStateByPath('inventory.${idx}.price.sp', parseInt(this.value) || 0); renderAll()"></div>
                            <div class="coin-input"><span>CP</span><input type="number" value="${item.price.cp}" onchange="updateStateByPath('inventory.${idx}.price.cp', parseInt(this.value) || 0); renderAll()"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        iDiv.querySelectorAll('.editable').forEach(el => {
            el.addEventListener('click', (e) => e.stopPropagation());
            attachInlineEdit(el, el.dataset.field, el.dataset.type === 'number');
        });

        invDiv.appendChild(iDiv);
    });

    const attackDiv = document.getElementById('attacks-list');
    attackDiv.innerHTML = '';
    state.attacks.forEach((a, idx) => {
        const aDiv = document.createElement('div');
        aDiv.className = 'attack-item';

        if (a.type === 'weapon') {
            const itemIndex = state.inventory.findIndex(i => i.id === a.itemId);
            if (itemIndex === -1) return;
            const item = state.inventory[itemIndex];

            const prefStat = item.preferredStat || 'int';
            const statMod = Math.floor((state.stats[prefStat] - 10) / 2);
            const atkBonus = item.attackBonus || 0;
            const dmgBonus = item.damageBonus || 0;
            const hit = state.proficiencyBonus + statMod + atkBonus;
            const damageDesc = item.description || '1d4';
            const isExpanded = uiState.expandedCustomAttacks.has(item.id);

            aDiv.innerHTML = `
                <div class="attack-header" onclick="toggleCustomAttackExpanded('${item.id}')">
                    <strong>${item.name}</strong>
                    <div class="attack-controls">
                        <div class="stat-toggles">
                            <button class="stat-toggle ${prefStat === 'str' ? 'active' : ''}" onclick="event.stopPropagation(); updateWeaponStatById('${item.id}', 'str')">STR</button>
                            <button class="stat-toggle ${prefStat === 'dex' ? 'active' : ''}" onclick="event.stopPropagation(); updateWeaponStatById('${item.id}', 'dex')">DEX</button>
                            <button class="stat-toggle ${prefStat === 'int' ? 'active' : ''}" onclick="event.stopPropagation(); updateWeaponStatById('${item.id}', 'int')">INT</button>
                        </div>
                        <button class="small-btn" onclick="event.stopPropagation(); moveAttack(${idx}, -1)">↑</button>
                        <button class="small-btn" onclick="event.stopPropagation(); moveAttack(${idx}, 1)">↓</button>
                        <button class="delete-btn" onclick="event.stopPropagation(); removeAttackFromList(${idx})">×</button>
                    </div>
                </div>
                <div class="custom-attack-configs ${isExpanded ? '' : 'hidden'}">
                    <div class="config-row">
                        <span class="label">Attack Bonus:</span>
                        <span class="editable" data-field="inventory.${itemIndex}.attackBonus" data-type="number">${atkBonus}</span>
                        <span class="label">Damage Bonus:</span>
                        <span class="editable" data-field="inventory.${itemIndex}.damageBonus" data-type="number">${dmgBonus}</span>
                    </div>
                </div>
                <div class="attack-details">
                    <span class="attack-tooltip-trigger">
                        Hit: +${hit}
                        <div class="attack-tooltip">Hit: PB (+${state.proficiencyBonus}) + ${prefStat.toUpperCase()} (${statMod >= 0 ? '+' : ''}${statMod}) ${atkBonus !== 0 ? (atkBonus > 0 ? '+ ' + atkBonus : '- ' + Math.abs(atkBonus)) : ''} = +${hit}</div>
                    </span>
                    <span class="attack-tooltip-trigger">
                        Damage: ${damageDesc} ${statMod + dmgBonus >= 0 ? '+' : ''}${statMod + dmgBonus}
                        <div class="attack-tooltip">Damage: ${damageDesc} + ${prefStat.toUpperCase()} (${statMod >= 0 ? '+' : ''}${statMod}) ${dmgBonus !== 0 ? (dmgBonus > 0 ? '+ ' + dmgBonus : '- ' + Math.abs(dmgBonus)) : ''}</div>
                    </span>
                </div>
            `;
        } else {
            const statMod = Math.floor((state.stats[a.stat] - 10) / 2);
            const atkBonus = a.attackBonus || 0;
            const dmgBonus = a.damageBonus || 0;
            const hit = state.proficiencyBonus + statMod + atkBonus;
            const dc = 8 + state.proficiencyBonus + statMod + atkBonus;
            const isExpanded = uiState.expandedCustomAttacks.has(a.id);

            aDiv.innerHTML = `
                <div class="attack-header" onclick="toggleCustomAttackExpanded('${a.id}')">
                    <strong class="editable" data-field="attacks.${idx}.name">${a.name}</strong>
                    <div class="attack-controls">
                        ${(a.spellLevel > 0) ? `<button class="small-btn" onclick="event.stopPropagation(); castAttackSpell(${idx})">Cast</button>` : ''}
                        <button class="small-btn" onclick="event.stopPropagation(); moveAttack(${idx}, -1)">↑</button>
                        <button class="small-btn" onclick="event.stopPropagation(); moveAttack(${idx}, 1)">↓</button>
                        <button class="delete-btn" onclick="event.stopPropagation(); removeAttackFromList(${idx})">×</button>
                    </div>
                </div>
                <div class="custom-attack-configs ${isExpanded ? '' : 'hidden'}">
                    <div class="config-row">
                        <select onchange="updateAttackProperty(${idx}, 'attackType', this.value)">
                            <option value="attack" ${a.attackType === 'attack' ? 'selected' : ''}>Attack</option>
                            <option value="save" ${a.attackType === 'save' ? 'selected' : ''}>Save</option>
                        </select>
                        <span class="label">using</span>
                        <select onchange="updateAttackProperty(${idx}, 'stat', this.value)">
                            ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(s => `<option value="${s}" ${a.stat === s ? 'selected' : ''}>${s.toUpperCase()}</option>`).join('')}
                        </select>
                        ${a.attackType === 'save' ? `
                            <span class="label">vs Enemy</span>
                            <select onchange="updateAttackProperty(${idx}, 'saveStat', this.value)">
                                ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(s => `<option value="${s}" ${a.saveStat === s ? 'selected' : ''}>${s.toUpperCase()}</option>`).join('')}
                            </select>
                        ` : ''}
                    </div>
                    <div class="config-row">
                        <span class="label">Attack Bonus:</span>
                        <span class="editable" data-field="attacks.${idx}.attackBonus" data-type="number">${atkBonus}</span>
                        <span class="label">Damage Bonus:</span>
                        <span class="editable" data-field="attacks.${idx}.damageBonus" data-type="number">${dmgBonus}</span>
                    </div>
                    <div class="config-row">
                        <span class="label">Damage Dice:</span>
                        <span class="editable" data-field="attacks.${idx}.damage">${a.damage}</span>
                        <label class="toggle-control">
                            <input type="checkbox" ${a.addStatToDamage ? 'checked' : ''} onchange="updateAttackProperty(${idx}, 'addStatToDamage', this.checked)">
                            <span>+Stat</span>
                        </label>
                    </div>
                    <div class="config-row">
                        <span class="label">Spell Level:</span>
                        <select onchange="updateAttackProperty(${idx}, 'spellLevel', this.value === 'none' ? null : parseInt(this.value))">
                            <option value="none" ${a.spellLevel === null ? 'selected' : ''}>None</option>
                            <option value="0" ${a.spellLevel === 0 ? 'selected' : ''}>Cantrip</option>
                            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}" ${a.spellLevel === l ? 'selected' : ''}>Lvl ${l}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="attack-details">
                    ${a.attackType === 'attack' ? `
                        <span class="attack-tooltip-trigger">
                            Hit: +${hit}
                            <div class="attack-tooltip">Hit: PB (+${state.proficiencyBonus}) + ${a.stat.toUpperCase()} (${statMod >= 0 ? '+' : ''}${statMod}) ${atkBonus !== 0 ? (atkBonus > 0 ? '+ ' + atkBonus : '- ' + Math.abs(atkBonus)) : ''} = +${hit}</div>
                        </span>
                    ` : `
                        <span class="attack-tooltip-trigger">
                            DC ${dc} ${a.saveStat.toUpperCase()} Save
                            <div class="attack-tooltip">DC: 8 + PB (+${state.proficiencyBonus}) + ${a.stat.toUpperCase()} (${statMod >= 0 ? '+' : ''}${statMod}) ${atkBonus !== 0 ? (atkBonus > 0 ? '+ ' + atkBonus : '- ' + Math.abs(atkBonus)) : ''} = ${dc}</div>
                        </span>
                    `}
                    <span>
                        Damage: ${a.damage} ${a.addStatToDamage ? (statMod + dmgBonus >= 0 ? '+ ' + (statMod + dmgBonus) : '- ' + Math.abs(statMod + dmgBonus)) : (dmgBonus !== 0 ? (dmgBonus > 0 ? '+ ' + dmgBonus : '- ' + Math.abs(dmgBonus)) : '')}
                    </span>
                </div>
                <div class="attack-description editable" data-field="attacks.${idx}.description" data-type="textarea" placeholder="Add description/effects...">${a.description || 'Add description...'}</div>
            `;
        }

        aDiv.querySelectorAll('.editable').forEach(el => {
            el.addEventListener('click', (e) => e.stopPropagation());
            attachInlineEdit(el, el.dataset.field, el.dataset.type === 'number');
        });

        attackDiv.appendChild(aDiv);
    });
}

window.updateItem = (idx, field, val) => {
    state.inventory[idx][field] = val;
    saveState();
    renderAll();
};

window.updateMoney = (field, val) => {
    state.money[field] = parseInt(val) || 0;
    saveState();
    renderAll();
};

window.removeItem = (idx) => {
    const item = state.inventory[idx];
    if (item.id) {
        state.attacks = state.attacks.filter(at => !(at.type === 'weapon' && at.itemId === item.id));
    }
    state.inventory.splice(idx, 1);
    saveState();
    renderAll();
};

window.addInventoryItem = () => {
    state.inventory.push({
        name: 'New Item',
        type: 'Gear',
        quantity: 1,
        weight: 0,
        price: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        description: '',
        rarity: 'Common',
        equipped: false
    });
    saveState();
    renderAll();
};

window.addCustomAttack = () => {
    state.attacks.push({
        id: 'atk_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
        type: 'custom',
        name: 'New Attack',
        attackType: 'attack',
        stat: 'int',
        saveStat: 'dex',
        damage: '1d8',
        addStatToDamage: true,
        attackBonus: 0,
        damageBonus: 0,
        description: '',
        spellLevel: null
    });
    saveState();
    renderAll();
};

window.removeAttackFromList = (idx) => {
    const attack = state.attacks[idx];
    if (attack.type === 'weapon') {
        const item = state.inventory.find(item => item.id === attack.itemId);
        if (item) item.equipped = false;
    }
    state.attacks.splice(idx, 1);
    saveState();
    renderAll();
};

window.moveAttack = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= state.attacks.length) return;
    const temp = state.attacks[idx];
    state.attacks[idx] = state.attacks[newIdx];
    state.attacks[newIdx] = temp;
    saveState();
    renderAll();
};

window.updateAttackProperty = (idx, field, value) => {
    state.attacks[idx][field] = value;
    saveState();
    renderAll();
};

window.castAttackSpell = (idx) => {
    const attack = state.attacks[idx];
    if (attack.spellLevel === null || attack.spellLevel === 0) return;

    const level = attack.spellLevel;
    if (!state.spells.slots[level]) {
        alert(`No spell slots for level ${level} defined!`);
        return;
    }
    if (state.spells.slots[level].used < state.spells.slots[level].max) {
        state.spells.slots[level].used++;
        saveState();
        renderAll();
    } else {
        alert(`No level ${level} spell slots left!`);
    }
};

window.toggleEquip = (idx) => {
    const item = state.inventory[idx];
    item.equipped = !item.equipped;

    if (item.type && item.type.toLowerCase() === 'weapon') {
        if (item.equipped) {
            if (!state.attacks.some(at => at.type === 'weapon' && at.itemId === item.id)) {
                state.attacks.push({ type: 'weapon', itemId: item.id });
            }
        } else {
            state.attacks = state.attacks.filter(at => !(at.type === 'weapon' && at.itemId === item.id));
        }
    }

    saveState();
    renderAll();
};

function renderSteelDefender() {
    if (!state.steelDefender) return;
    const sd = state.steelDefender;
    const intMod = Math.floor((state.stats.int - 10) / 2);
    const pb = state.proficiencyBonus;

    sd.ac = 12 + intMod;
    sd.hp.max = 5 + (5 * state.level);

    const div = document.getElementById('sd-info');
    div.innerHTML = `
        <div class="sd-full-stat-block">
            <div class="sd-header-main">
                <h2 class="editable" data-field="steelDefender.name">${sd.name}</h2>
                <div class="sd-main-essentials">
                    <div class="essential-item">
                        <span class="label">AC</span>
                        <span class="value">${sd.ac}</span>
                    </div>
                    <div class="essential-item">
                        <span class="label">HP</span>
                        <span class="value"><span class="editable" data-field="steelDefender.hp.current" data-type="number">${sd.hp.current}</span> / ${sd.hp.max}</span>
                    </div>
                    <div class="essential-item">
                        <span class="label">Speed</span>
                        <span class="value">${sd.speed} ft.</span>
                    </div>
                    ${sd.hitDice ? `
                    <div class="essential-item">
                        <span class="label">Hit Dice</span>
                        <span class="value">${sd.hitDice.current} / ${sd.hitDice.max}</span>
                    </div>` : ''}
                </div>
            </div>

            <div class="sd-stats-grid compact-stats-bar">
                ${Object.keys(sd.stats).map(stat => {
                    const val = sd.stats[stat];
                    const mod = Math.floor((val - 10) / 2);
                    const saveMod = mod + pb; // Steel Bond adds PB to all saves
                    return `
                    <div class="stat-item">
                        <span class="label">${stat}</span>
                        <span class="value">${val} (${mod >= 0 ? '+' : ''}${mod})</span>
                        <span class="sub-value" title="Base Mod (${mod >= 0 ? '+' : ''}${mod}) + Proficiency Bonus (+${pb}) from Steel Bond">Save: ${saveMod >= 0 ? '+' : ''}${saveMod}</span>
                    </div>
                    `;
                }).join('')}
            </div>

            <div class="sd-details-section">
                <div class="sd-detail-item"><strong>Immunities:</strong> ${sd.immunities || 'None'}</div>
                <div class="sd-detail-item"><strong>Senses:</strong> ${sd.senses || 'Normal'}</div>
                <div class="sd-detail-item"><strong>Languages:</strong> ${sd.languages || 'None'}</div>
            </div>

            <div class="sd-traits-section">
                <h3>Traits</h3>
                ${(sd.traits || []).map(t => `
                    <div class="sd-trait">
                        <strong>${t.name}.</strong> ${t.description}
                    </div>
                `).join('')}
            </div>

            <div class="sd-actions-section">
                <h3>Actions</h3>
                ${sd.actions.map((a, i) => {
                    let desc = a.description;
                    if (a.name === "Force-Empowered Rend") {
                        desc = `Melee Attack Roll: +${pb + intMod} to hit, reach 5 ft. Hit: 1d8 + ${2 + intMod} force damage.`;
                    }
                    if (a.name === "Repair (3/Day)") {
                        desc = `The defender, or one Construct or object it can see within 5 feet of it, regains 2d8 + ${intMod} HP.`;
                    }
                    return `
                    <div class="sd-action">
                        <strong>${a.name}</strong>: ${desc}
                        ${a.limitedUse ? renderLimitedUse(a, 'sd-action', i) : ''}
                    </div>
                    `;
                }).join('')}
                ${sd.reactions ? `
                <h3>Reactions</h3>
                ${sd.reactions.map(r => `
                    <div class="sd-action">
                        <strong>${r.name}</strong>: ${r.description}
                    </div>
                `).join('')}
                ` : ''}
            </div>
        </div>
    `;
    div.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, el.dataset.type === 'number'));
}

window.filterFeatures = () => {
    const val = document.getElementById('feature-filter').value;
    renderFeatures(val);
};

window.filterSpells = () => {
    const val = document.getElementById('spell-filter').value;
    renderSpells(val);
};


function renderPlans(filter = '') {
    const tabEl = document.getElementById('plans');
    let sortRow = tabEl.querySelector('.sort-row');
    if (!sortRow) {
        sortRow = document.createElement('div');
        sortRow.className = 'sort-row';
        sortRow.style.marginBottom = '15px';
        tabEl.querySelector('.plan-filters').after(sortRow);
    }
    sortRow.innerHTML = `
        <span class="sort-label">Sort by:</span>
        <select class="sort-select" onchange="updateSort('plan', this.value)">
            <option value="name" ${state.settings.planSort === 'name' ? 'selected' : ''}>Name</option>
            <option value="level" ${state.settings.planSort === 'level' ? 'selected' : ''}>Level</option>
            <option value="rarity" ${state.settings.planSort === 'rarity' ? 'selected' : ''}>Rarity</option>
            <option value="type" ${state.settings.planSort === 'type' ? 'selected' : ''}>Type</option>
        </select>
    `;

    const preparedDiv = document.getElementById('prepared-plans');
    preparedDiv.innerHTML = '<h3>Prepared Plans</h3>';
    const sortedPrepared = sortPlans(state.plans.prepared);
    sortedPrepared.forEach((plan) => {
        if (filter && !plan.name.toLowerCase().includes(filter.toLowerCase())) return;
        const idx = state.plans.prepared.findIndex(p => p.name === plan.name && p.description === plan.description);
        const isExpanded = uiState.expandedPlans.has('prepared-' + idx);
        const pDiv = document.createElement('div');
        pDiv.className = `spell-item ${isExpanded ? 'expanded-item' : ''}`;

        const rarityInfo = plan.rarity ? `(${plan.rarity})` : '';
        const levelInfo = plan.level ? `Lvl ${plan.level}` : '';

        pDiv.innerHTML = `
            <div onclick="togglePlanExpanded('prepared-${idx}')">
                <div class="spell-header">
                    <strong class="editable" data-field="plans.prepared.${idx}.name">${plan.name}</strong>
                    <span class="spell-preview">${levelInfo} | ${rarityInfo}</span>
                    <button onclick="event.stopPropagation(); unpreparePlan(${idx})">Remove</button>
                </div>
                <div class="plan-desc ${isExpanded ? '' : 'hidden'}">
                    <div><em>${plan.type}</em></div>
                    <div class="editable" data-field="plans.prepared.${idx}.description" data-type="textarea">${plan.description}</div>
                </div>
            </div>
        `;
        preparedDiv.appendChild(pDiv);
    });
    preparedDiv.querySelectorAll('.editable').forEach(el => {
        el.addEventListener('click', (e) => e.stopPropagation());
        attachInlineEdit(el, el.dataset.field);
    });

    const allPlansDiv = document.getElementById('all-plans-list');
    allPlansDiv.innerHTML = '<h3>All Magic Item Plans</h3>';
    const sortedAll = sortPlans(state.plans.all);
    sortedAll.forEach((plan) => {
        if (filter && !plan.name.toLowerCase().includes(filter.toLowerCase())) return;

        // Only skip if it's already prepared AND it's NOT a "Common magic item"
        const isPrepared = state.plans.prepared.some(p => p.name === plan.name);
        if (isPrepared && plan.name !== "Common magic item") return;

        const idx = state.plans.all.findIndex(p => p.name === plan.name);
        const isExpanded = uiState.expandedPlans.has('all-' + idx);
        const pDiv = document.createElement('div');
        pDiv.className = `spell-item-all ${isExpanded ? 'expanded-item' : ''}`;

        const rarityInfo = plan.rarity ? `(${plan.rarity})` : '';
        const levelInfo = plan.level ? `Lvl ${plan.level}` : '';

        pDiv.innerHTML = `
            <div onclick="togglePlanExpanded('all-${idx}')">
                <div class="spell-header">
                    <strong>${plan.name}</strong>
                    <span class="spell-preview">${levelInfo} | ${rarityInfo}</span>
                    <button onclick="event.stopPropagation(); preparePlan(${idx})">Select</button>
                </div>
                <div class="plan-desc ${isExpanded ? '' : 'hidden'}">
                    <div><em>${plan.type}</em></div>
                    ${plan.description}
                </div>
            </div>
        `;
        allPlansDiv.appendChild(pDiv);
    });
}

window.togglePlanExpanded = (id) => {
    if (uiState.expandedPlans.has(id)) {
        uiState.expandedPlans.delete(id);
    } else {
        uiState.expandedPlans.add(id);
    }
    renderPlans();
};

const RARITY_ORDER = {
    'Common': 1,
    'Uncommon': 2,
    'Rare': 3,
    'Very Rare': 4,
    'Legendary': 5
};

function sortPlans(plans) {
    const planSort = state.settings.planSort;
    return [...plans].sort((a, b) => {
        if (planSort === 'level') {
            if ((a.level || 0) !== (b.level || 0)) return (a.level || 0) - (b.level || 0);
            return a.name.localeCompare(b.name);
        }
        if (planSort === 'rarity') {
            const valA = RARITY_ORDER[a.rarity] || 99;
            const valB = RARITY_ORDER[b.rarity] || 99;
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }
        if (planSort === 'type') {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
    });
}

window.filterPlans = () => {
    const val = document.getElementById('plan-filter').value;
    renderPlans(val);
};

window.filterInventory = () => {
    const val = document.getElementById('inventory-filter').value;
    renderInventory(val);
};

window.toggleInventoryExpanded = (index) => {
    if (uiState.expandedInventory.has(index)) {
        uiState.expandedInventory.delete(index);
    } else {
        uiState.expandedInventory.add(index);
    }
    const val = document.getElementById('inventory-filter') ? document.getElementById('inventory-filter').value : '';
    renderInventory(val);
};

window.toggleInventoryFilter = (cat) => {
    if (uiState.inventoryFilters.has(cat)) {
        uiState.inventoryFilters.delete(cat);
    } else {
        uiState.inventoryFilters.add(cat);
    }
    const val = document.getElementById('inventory-filter') ? document.getElementById('inventory-filter').value : '';
    renderInventory(val);
};

function getPriceInCP(price) {
    if (!price) return 0;
    return (price.cp || 0) + (price.sp || 0) * 10 + (price.ep || 0) * 50 + (price.gp || 0) * 100 + (price.pp || 0) * 1000;
}

function formatCurrency(totalCP) {
    let cp = totalCP;
    const pp = Math.floor(cp / 1000);
    cp %= 1000;
    const gp = Math.floor(cp / 100);
    cp %= 100;
    const ep = Math.floor(cp / 50);
    cp %= 50;
    const sp = Math.floor(cp / 10);
    cp %= 10;

    let result = [];
    if (pp > 0) result.push(`<strong>${pp}</strong> pp`);
    if (gp > 0) result.push(`<strong>${gp}</strong> gp`);
    if (ep > 0) result.push(`<strong>${ep}</strong> ep`);
    if (sp > 0) result.push(`<strong>${sp}</strong> sp`);
    if (cp > 0) result.push(`<strong>${cp}</strong> cp`);

    return result.length > 0 ? result.join(', ') : '0 gp';
}

window.preparePlan = (idx) => {
    state.plans.prepared.push({ ...state.plans.all[idx] });
    saveState();
    renderAll();
};

window.unpreparePlan = (idx) => {
    state.plans.prepared.splice(idx, 1);
    saveState();
    renderAll();
};

function renderAll() {
    renderStats();
    renderFeatures();
    renderSpells();
    renderPlans();
    renderInventory();
    renderCombatActions();
    renderSteelDefender();
}

init();

// Expose for testing and inline event handlers
window.renderAll = renderAll;
window.applyTheme = applyTheme;
window.__RENDER_ALL__ = renderAll;
window.__STATE__ = state;
