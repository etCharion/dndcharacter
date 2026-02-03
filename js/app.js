let state = null;

document.addEventListener('DOMContentLoaded', () => {
    state = loadData();

    // Initial Render
    renderAll();

    // Event Listeners
    setupTabListeners();
    setupFilterListeners();
});

function loadData() {
    const saved = localStorage.getItem('dnd_character_data');
    if (saved) {
        return JSON.parse(saved);
    }
    // Initialize Defender if not present in initial data
    const data = {...INITIAL_CHARACTER_DATA};
    if (!data.defender) {
        data.defender = {
            hp: { current: 35, max: 35 },
            repairUses: 0
        };
    }
    return data;
}

function saveData() {
    localStorage.setItem('dnd_character_data', JSON.stringify(state));
}

function renderAll() {
    renderHeader();
    renderStats();
    renderSkills();
    renderFeatures();
    renderSpells();
    renderCombat();
    renderDefender();
}

function renderHeader() {
    document.getElementById('char-name').textContent = state.name;
    document.getElementById('char-race').textContent = state.race;
    document.getElementById('char-class').textContent = state.class;
    document.getElementById('char-level').textContent = state.level;

    const hpInput = document.getElementById('hp-current');
    hpInput.value = state.vitals.hp.current;
    document.getElementById('hp-max').textContent = state.vitals.hp.max;
    document.getElementById('ac-value').textContent = state.vitals.ac;
    document.getElementById('prof-bonus').textContent = `+${state.proficiencyBonus}`;

    hpInput.oninput = (e) => {
        state.vitals.hp.current = parseInt(e.target.value) || 0;
        saveData();
    };
}

function renderStats() {
    const container = document.querySelector('.stats-grid');
    container.innerHTML = '';

    for (const [stat, data] of Object.entries(state.stats)) {
        const mod = Math.floor((data.value - 10) / 2);
        const box = document.createElement('div');
        box.className = 'stat-box';
        box.innerHTML = `
            <label>${stat}</label>
            <div class="stat-value">${data.value}</div>
            <div class="stat-mod">${mod >= 0 ? '+' : ''}${mod}</div>
        `;
        container.appendChild(box);
    }
}

function renderSkills() {
    const container = document.querySelector('.skills-list');
    container.innerHTML = '';

    state.skills.forEach(skill => {
        const mod = Math.floor((state.stats[skill.stat].value - 10) / 2);
        const total = mod + (skill.proficient ? state.proficiencyBonus : 0);
        const row = document.createElement('div');
        row.className = `skill-row ${skill.proficient ? 'proficient' : ''}`;
        row.innerHTML = `
            <span>${skill.proficient ? '●' : '○'} ${skill.name} <small>(${skill.stat.substring(0,3)})</small></span>
            <span>${total >= 0 ? '+' : ''}${total}</span>
        `;
        container.appendChild(row);
    });
}

function renderFeatures() {
    const container = document.getElementById('features-list');
    container.innerHTML = '';

    state.features.forEach((feat, index) => {
        const card = document.createElement('div');
        card.className = 'feature-card';
        card.dataset.source = feat.source;
        card.innerHTML = `
            <div class="card-header" onclick="toggleDetails(this)">
                <strong>${feat.name}</strong>
                <small>${feat.source}</small>
            </div>
            <div class="card-details hidden">
                <p>${feat.description}</p>
                ${feat.limit ? renderUses(feat, index) : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderUses(feat, index) {
    let html = `<div class="uses-tracker">`;
    for (let i = 0; i < feat.limit; i++) {
        const filled = i < feat.uses ? 'filled' : '';
        html += `<div class="use-box ${filled}" onclick="toggleFeatureUse(${index}, ${i}, this)"></div>`;
    }
    html += ` <small>(${feat.reset} rest)</small></div>`;
    return html;
}

window.toggleFeatureUse = (index, useIndex, el) => {
    const feat = state.features[index];
    if (el.classList.contains('filled')) {
        feat.uses = useIndex;
    } else {
        feat.uses = useIndex + 1;
    }
    saveData();
    const container = el.parentElement;
    const boxes = container.querySelectorAll('.use-box');
    boxes.forEach((box, i) => {
        box.classList.toggle('filled', i < feat.uses);
    });
};

function renderSpells() {
    const slotContainer = document.getElementById('slot-trackers');
    slotContainer.innerHTML = '';

    for (const [lvl, data] of Object.entries(state.spellcasting.slots)) {
        const row = document.createElement('div');
        row.className = 'slot-row';
        row.innerHTML = `
            <label>Level ${lvl}</label>
            <div class="slot-boxes">
                ${renderSlotBoxes(lvl, data)}
            </div>
        `;
        slotContainer.appendChild(row);
    }

    const spellContainer = document.getElementById('spells-list');
    spellContainer.innerHTML = '';

    state.spellcasting.spells.forEach((spell, index) => {
        const card = document.createElement('div');
        card.className = `spell-card ${spell.prepared ? 'prepared' : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <span onclick="togglePrepared(${index})" style="cursor:pointer">
                    ${spell.prepared ? '★' : '☆'} <strong>${spell.name}</strong>
                </span>
                <small>Lvl ${spell.level}</small>
            </div>
            <div class="card-details hidden">
                <p>${spell.description}</p>
                ${spell.level > 0 && spell.prepared ? `<button class="punk-btn" onclick="castSpell(${spell.level})">Cast (Expends Slot)</button>` : ''}
                ${spell.level > 0 && !spell.prepared ? '<p><small>Must be prepared to cast.</small></p>' : ''}
            </div>
        `;
        card.querySelector('.card-header').addEventListener('click', (e) => {
            if (e.target.tagName !== 'SPAN') toggleDetails(card.querySelector('.card-header'));
        });
        spellContainer.appendChild(card);
    });
}

function renderSlotBoxes(lvl, data) {
    let html = '';
    for (let i = 0; i < data.total; i++) {
        const filled = i < data.used ? 'filled' : '';
        html += `<div class="use-box ${filled}" onclick="toggleSlot(${lvl}, ${i}, this)"></div>`;
    }
    return html;
}

window.toggleSlot = (lvl, index, el) => {
    const slot = state.spellcasting.slots[lvl];
    if (el.classList.contains('filled')) {
        slot.used = index;
    } else {
        slot.used = index + 1;
    }
    saveData();
    const container = el.parentElement;
    const boxes = container.querySelectorAll('.use-box');
    boxes.forEach((box, i) => {
        box.classList.toggle('filled', i < slot.used);
    });
};

window.castSpell = (lvl) => {
    if (state.spellcasting.slots[lvl].used < state.spellcasting.slots[lvl].total) {
        state.spellcasting.slots[lvl].used++;
        saveData();
        renderSpells();
    } else {
        alert("No slots remaining!");
    }
};

window.togglePrepared = (index) => {
    const spell = state.spellcasting.spells[index];
    if (spell.level === 0) return;
    spell.prepared = !spell.prepared;
    saveData();
    renderSpells();
};

function renderCombat() {
    // Generate dynamic attacks from inventory if they don't exist as overrides
    if (!state.attackOverrides) state.attackOverrides = {};

    const baseAttacks = [
        { id: 'firebolt', name: "Fire Bolt", bonus: 7, damage: "2d10", type: "Fire" }
    ];

    state.inventory.filter(item => item.type === 'weapon' && item.equipped).forEach(weapon => {
        const mod = Math.floor((state.stats[weapon.stat || 'STR'].value - 10) / 2);
        baseAttacks.push({
            id: `weapon-${weapon.id}`,
            name: weapon.name,
            bonus: mod + state.proficiencyBonus,
            damage: `${weapon.damage}${mod >= 0 ? '+' : ''}${mod}`,
            type: weapon.properties || 'Physical'
        });
    });

    const attackContainer = document.getElementById('attacks-list');
    attackContainer.innerHTML = '';
    baseAttacks.forEach(atk => {
        const override = state.attackOverrides[atk.id] || {};
        const bonus = override.bonus !== undefined ? override.bonus : atk.bonus;
        const damage = override.damage !== undefined ? override.damage : atk.damage;

        const div = document.createElement('div');
        div.className = 'feature-card';
        div.innerHTML = `
            <div class="card-header">
                <strong>${atk.name}</strong>
                <span>
                    +<input type="number" value="${bonus}" class="atk-edit-input" oninput="updateAttackOverride('${atk.id}', 'bonus', this.value)"> to hit
                </span>
            </div>
            <div class="card-details">
                Damage: <input type="text" value="${damage}" class="atk-edit-input wide" oninput="updateAttackOverride('${atk.id}', 'damage', this.value)">
                (${atk.type})
            </div>
        `;
        attackContainer.appendChild(div);
    });

    const invContainer = document.getElementById('inventory-list');
    invContainer.innerHTML = '';
    state.inventory.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'feature-card';
        div.innerHTML = `
            <div class="card-header">
                <span onclick="toggleEquip(${index})" style="cursor:pointer">
                    ${item.equipped ? '☑' : '☐'} ${item.name}
                </span>
                <small>${item.type}</small>
            </div>
            <div class="card-details hidden">
                ${item.properties}
                <br>
                <button class="punk-btn" onclick="removeItem(${index})">Delete</button>
            </div>
        `;
        div.querySelector('.card-header').addEventListener('click', (e) => {
            if (e.target.tagName !== 'SPAN') toggleDetails(div.querySelector('.card-header'));
        });
        invContainer.appendChild(div);
    });

    // Currency
    const gp = document.getElementById('gp-val');
    const sp = document.getElementById('sp-val');
    const cp = document.getElementById('cp-val');

    gp.value = state.currency.gp;
    sp.value = state.currency.sp;
    cp.value = state.currency.cp;

    gp.oninput = (e) => { state.currency.gp = parseInt(e.target.value) || 0; saveData(); };
    sp.oninput = (e) => { state.currency.sp = parseInt(e.target.value) || 0; saveData(); };
    cp.oninput = (e) => { state.currency.cp = parseInt(e.target.value) || 0; saveData(); };
}

window.updateAttackOverride = (id, field, value) => {
    if (!state.attackOverrides[id]) state.attackOverrides[id] = {};
    state.attackOverrides[id][field] = value;
    saveData();
};

window.toggleEquip = (index) => {
    state.inventory[index].equipped = !state.inventory[index].equipped;
    saveData();
    renderCombat();
};

window.addNewItem = () => {
    const name = prompt("Item Name:");
    if (!name) return;
    const type = prompt("Type (weapon/armor/gear):", "gear");
    const props = prompt("Properties (e.g. 1d6 bludgeoning):", "");

    const newItem = {
        id: Date.now(),
        name: name,
        type: type,
        equipped: false,
        properties: props
    };

    if (type === 'weapon') {
        newItem.damage = prompt("Base Damage (e.g. 1d6):", "1d6");
        newItem.stat = prompt("Stat (STR/DEX):", "STR");
    }

    state.inventory.push(newItem);
    saveData();
    renderCombat();
};

window.removeItem = (index) => {
    state.inventory.splice(index, 1);
    saveData();
    renderCombat();
};

function renderDefender() {
    const actions = [
        { id: 'rend', name: "Force-Empowered Rend", bonus: 7, damage: "1d8+4", type: "Force" },
        { id: 'repair', name: "Repair", limit: 3, uses: state.defender.repairUses, reset: "long" }
    ];

    const hpInput = document.getElementById('defender-hp');
    hpInput.value = state.defender.hp.current;
    hpInput.oninput = (e) => {
        state.defender.hp.current = parseInt(e.target.value) || 0;
        saveData();
    };

    const container = document.getElementById('defender-actions');
    container.innerHTML = '';
    actions.forEach((act, index) => {
        const div = document.createElement('div');
        div.className = 'feature-card';
        div.innerHTML = `
            <div class="card-header">
                <strong>${act.name}</strong>
                ${act.bonus ? `<span>+${act.bonus} to hit</span>` : ''}
            </div>
            <div class="card-details">
                ${act.damage ? `Damage: ${act.damage} ${act.type}` : ''}
                ${act.limit ? renderDefenderUses(act) : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

function renderDefenderUses(act) {
    let html = `<div class="uses-tracker">`;
    for (let i = 0; i < act.limit; i++) {
        const filled = i < act.uses ? 'filled' : '';
        html += `<div class="use-box ${filled}" onclick="toggleDefenderRepair(${i}, this)"></div>`;
    }
    html += ` <small>(long rest)</small></div>`;
    return html;
}

window.toggleDefenderRepair = (useIndex, el) => {
    if (el.classList.contains('filled')) {
        state.defender.repairUses = useIndex;
    } else {
        state.defender.repairUses = useIndex + 1;
    }
    saveData();
    const container = el.parentElement;
    const boxes = container.querySelectorAll('.use-box');
    boxes.forEach((box, i) => {
        box.classList.toggle('filled', i < state.defender.repairUses);
    });
};

window.toggleDetails = (el) => {
    const details = el.nextElementSibling;
    details.classList.toggle('hidden');
};

function setupTabListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });
}

function setupFilterListeners() {
    const search = document.getElementById('feature-search');
    const sourceFilter = document.getElementById('feature-source-filter');

    const filterFn = () => {
        const query = search.value.toLowerCase();
        const source = sourceFilter.value;

        document.querySelectorAll('.feature-card').forEach(card => {
            if (card.closest('#features-list')) {
                const name = card.querySelector('strong').textContent.toLowerCase();
                const cardSource = card.dataset.source;
                const matchesQuery = name.includes(query);
                const matchesSource = source === 'all' || cardSource === source;
                card.classList.toggle('hidden', !matchesQuery || !matchesSource);
            }
        });
    };

    search.addEventListener('input', filterFn);
    sourceFilter.addEventListener('change', filterFn);
}
