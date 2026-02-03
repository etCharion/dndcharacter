import { characterData } from '../data/character.js';

let state = JSON.parse(localStorage.getItem('dnd_char_state')) || { ...characterData };

let uiState = {
    expandedFeatures: new Set(),
    expandedSpells: new Set(),
    expandedPlans: new Set(),
    expandedTraits: new Set(),
    featureFilters: new Set(),
    spellFilters: new Set()
};

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

// Ensure new structure elements exist and master lists are up to date
if (!state.plans) state.plans = characterData.plans;
state.plans.all = characterData.plans.all;

if (!state.spells) state.spells = characterData.spells;
state.spells.all = characterData.spells.all;

if (!state.traits) state.traits = characterData.traits || [];

if (state.initiative === undefined) state.initiative = characterData.initiative || 0;
if (state.speed === undefined) state.speed = characterData.speed || 30;
if (state.spellSaveDC === undefined) state.spellSaveDC = characterData.spellSaveDC || 8;
if (state.spellAttackBonus === undefined) state.spellAttackBonus = characterData.spellAttackBonus || 0;

// Ensure all skills from characterData are present in state
for (let skill in characterData.skills) {
    if (!state.skills[skill]) {
        state.skills[skill] = { ...characterData.skills[skill] };
    }
}

function saveState() {
    localStorage.setItem('dnd_char_state', JSON.stringify(state));
}

function init() {
    renderTabs();
    renderAll();
    setupEventListeners();
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
    for (let lvl in state.spells.slots) {
        state.spells.slots[lvl].used = 0;
    }
    state.features.forEach(f => {
        if (f.limitedUse) {
            f.limitedUse.used = 0;
        }
    });
    if (state.steelDefender && state.steelDefender.actions) {
        state.steelDefender.actions.forEach(a => {
            if (a.limitedUse) a.limitedUse.used = 0;
        });
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

function renderStats() {
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
}

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
                    <span>${a.name}</span>
                    ${renderLimitedUse(a, 'sd-action', i)}
                </div>
                `;
            }).join('') : ''}
        </div>
    `;

    section.appendChild(overview);
    overview.querySelectorAll('.editable').forEach(el => attachInlineEdit(el, el.dataset.field, true));
    parent.appendChild(section);
}

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
                <div class="editable" data-field="traits.${index}.note">${trait.note || 'No note.'}</div>
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

window.jumpToFeature = (index) => {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => {
        if (t.dataset.tab === 'features') {
            t.click();
        }
    });

    uiState.expandedFeatures.add(index);
    renderAll();

    setTimeout(() => {
        const featEl = document.querySelectorAll('.feature-item')[index];
        if (featEl) {
            featEl.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
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
        if (element.querySelector('input')) return;

        const originalValue = element.innerText.replace('+', '').split('/')[0].trim();
        const input = document.createElement('input');
        input.type = isNumeric ? 'number' : 'text';
        input.value = originalValue;
        input.className = 'inline-edit';

        const oldContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(input);
        input.focus();
        input.select();

        const save = () => {
            let newValue = input.value;
            if (isNumeric) newValue = parseInt(newValue) || 0;
            updateStateByPath(field, newValue);
            renderAll();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
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

function updateStateByPath(path, value) {
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
    state.features.forEach((feat, index) => {
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

function renderSpells(filter = null) {
    if (filter === null) {
        const el = document.getElementById('spell-filter');
        filter = el ? el.value : '';
    }

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

    state.spells.prepared.forEach((spell, idx) => {
        if (!matchesFilters(spell)) return;
        const isExpanded = uiState.expandedSpells.has('prepared-' + spell.name);
        const sDiv = document.createElement('div');
        sDiv.className = `spell-item ${isExpanded ? 'expanded-item' : ''}`;

        const comps = spell.components ? spell.components.split('(')[0].trim() : '';
        const previewInfo = `Lvl ${spell.level} | ${spell.castingTime} | ${spell.range} | ${spell.duration} | ${comps}`;

        const castBtn = spell.level > 0 ? `<button onclick="event.stopPropagation(); castSpell(${idx})">Cast</button>` : '';
        const unprepareBtn = (spell.alwaysPrepared || spell.level === 0) ? '' : `<button onclick="event.stopPropagation(); unprepareSpell(${idx})">Unprepare</button>`;

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
    state.spells.all.forEach((spell, idx) => {
        if (!matchesFilters(spell)) return;
        const isPrepared = state.spells.prepared.some(p => p.name === spell.name);
        if (isPrepared) return;
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
                    <button onclick="event.stopPropagation(); prepareSpell(${idx})">Prepare</button>
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

function renderInventory() {
    const invDiv = document.getElementById('inventory-list');
    invDiv.innerHTML = '';
    state.inventory.forEach((item, idx) => {
        const iDiv = document.createElement('div');
        iDiv.className = 'inv-item';
        iDiv.innerHTML = `
            <input type="text" value="${item.name}" onchange="updateItem(${idx}, 'name', this.value)">
            <input type="text" value="${item.properties || ''}" onchange="updateItem(${idx}, 'properties', this.value)">
            <label><input type="checkbox" ${item.equipped ? 'checked' : ''} onchange="toggleEquip(${idx})"> Equip</label>
            <button onclick="removeItem(${idx})">x</button>
        `;
        invDiv.appendChild(iDiv);
    });

    const moneyDiv = document.getElementById('money-display');
    moneyDiv.innerHTML = `GP: <input type="number" value="${state.money.gp}" onchange="updateMoney('gp', this.value)">`;

    const attackDiv = document.getElementById('attacks-list');
    attackDiv.innerHTML = '';
    state.inventory.filter(i => i.type === 'weapon' && i.equipped).forEach(w => {
        const aDiv = document.createElement('div');
        aDiv.className = 'attack-item';
        const intMod = Math.floor((state.stats.int - 10) / 2);
        const hit = state.proficiencyBonus + intMod;
        aDiv.innerHTML = `
            <strong>${w.name}</strong>
            <span>Hit: +${hit}</span>
            <span>Damage: ${w.properties} + ${intMod}</span>
        `;
        attackDiv.appendChild(aDiv);
    });
}

window.updateItem = (idx, field, val) => {
    state.inventory[idx][field] = val;
    saveState();
    renderAll();
};

window.updateMoney = (field, val) => {
    state.money[field] = parseInt(val);
    saveState();
};

window.removeItem = (idx) => {
    state.inventory.splice(idx, 1);
    saveState();
    renderAll();
};

window.addInventoryItem = () => {
    state.inventory.push({ name: 'New Item', type: 'weapon', properties: '1d6', equipped: false });
    saveState();
    renderAll();
};

window.toggleEquip = (idx) => {
    state.inventory[idx].equipped = !state.inventory[idx].equipped;
    saveState();
    renderAll();
};

function renderSteelDefender() {
    const sd = state.steelDefender;
    const intMod = Math.floor((state.stats.int - 10) / 2);
    const pb = state.proficiencyBonus;

    sd.ac = 12 + intMod;
    sd.hp.max = 5 + (5 * state.level);

    const div = document.getElementById('sd-info');
    div.innerHTML = `
        <h3>${sd.name}</h3>
        <p>AC: ${sd.ac} | HP: ${sd.hp.current}/${sd.hp.max} | Speed: ${sd.speed}</p>
        <p>Senses: Darkvision 60 ft., Passive Perception 10 + PB = ${10 + pb}</p>
        <div>
            <strong>Actions:</strong>
            ${sd.actions.map((a, i) => {
                let desc = a.description;
                if (a.name === "Force-Empowered Rend") {
                    desc = `Melee Attack Roll: +${pb + intMod} to hit, reach 5 ft. Hit: 1d8 + ${pb} force damage.`;
                }
                if (a.name === "Repair (3/Day)") {
                    desc = `The defender, or one Construct or object it can see within 5 feet of it, regains 2d8 + ${pb} HP.`;
                }
                return `
                <div class="sd-action">
                    <strong>${a.name}</strong>: ${desc}
                    ${a.limitedUse ? renderLimitedUse(a, 'sd-action', i) : ''}
                </div>
                `;
            }).join('')}
        </div>
    `;
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
    const preparedDiv = document.getElementById('prepared-plans');
    preparedDiv.innerHTML = '<h3>Prepared Plans</h3>';
    state.plans.prepared.forEach((plan, idx) => {
        if (filter && !plan.name.toLowerCase().includes(filter.toLowerCase())) return;
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
                    <div class="editable" data-field="plans.prepared.${idx}.description">${plan.description}</div>
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
    state.plans.all.forEach((plan, idx) => {
        if (filter && !plan.name.toLowerCase().includes(filter.toLowerCase())) return;

        // Only skip if it's already prepared AND it's NOT a "Common magic item"
        const isPrepared = state.plans.prepared.some(p => p.name === plan.name);
        if (isPrepared && plan.name !== "Common magic item") return;

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

window.filterPlans = () => {
    const val = document.getElementById('plan-filter').value;
    renderPlans(val);
};

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
    renderSteelDefender();
}

init();
