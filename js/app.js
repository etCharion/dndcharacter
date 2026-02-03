import { characterData } from '../data/character.js';

let state = JSON.parse(localStorage.getItem('dnd_char_state')) || { ...characterData };

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
    const statsDiv = document.getElementById('stats-grid');
    statsDiv.innerHTML = '';
    for (let stat in state.stats) {
        const val = state.stats[stat];
        const mod = Math.floor((val - 10) / 2);
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-name">${stat.toUpperCase()}</div>
            <div class="stat-value">${val}</div>
            <div class="stat-mod">${mod >= 0 ? '+' : ''}${mod}</div>
        `;
        statsDiv.appendChild(card);
    }

    const basicInfo = document.getElementById('basic-info');
    basicInfo.innerHTML = `
        <div class="info-item"><span>Level:</span> <strong>${state.level}</strong></div>
        <div class="info-item"><span>HP:</span> <strong>${state.hp.current} / ${state.hp.max}</strong></div>
        <div class="info-item"><span>AC:</span> <strong>${state.ac}</strong></div>
        <div class="info-item"><span>Proficiency:</span> <strong>+${state.proficiencyBonus}</strong></div>
    `;
}

function renderFeatures(filter = '') {
    const container = document.getElementById('features-list');
    container.innerHTML = '';
    state.features.forEach((feat, index) => {
        if (filter && !feat.name.toLowerCase().includes(filter.toLowerCase()) && !feat.description.toLowerCase().includes(filter.toLowerCase())) {
            return;
        }
        const item = document.createElement('div');
        item.className = 'feature-item';
        item.innerHTML = `
            <div class="feature-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <strong>${feat.name}</strong> <span>${feat.source}</span>
            </div>
            <div class="feature-body hidden">
                <div class="feature-desc">${feat.description}</div>
                ${feat.details ? `<div class="feature-details">${feat.details}</div>` : ''}
                ${feat.limitedUse ? renderLimitedUse(feat, 'feature', index) : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

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

function renderSpells(filter = '') {
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
    state.spells.prepared.forEach((spell, idx) => {
        if (filter && !spell.name.toLowerCase().includes(filter.toLowerCase())) return;
        const sDiv = document.createElement('div');
        sDiv.className = 'spell-item';
        sDiv.innerHTML = `
            <div onclick="this.querySelector('.spell-desc').classList.toggle('hidden')">
                <strong>${spell.name}</strong> (Lvl ${spell.level}) - ${spell.type}
                <button onclick="event.stopPropagation(); castSpell(${idx})">Cast</button>
                <button onclick="event.stopPropagation(); unprepareSpell(${idx})">Unprepare</button>
                <div class="spell-desc hidden">${spell.description || 'No description.'}</div>
            </div>
        `;
        preparedDiv.appendChild(sDiv);
    });

    const allSpellsDiv = document.getElementById('all-spells-list');
    allSpellsDiv.innerHTML = '<h3>All Known Spells</h3>';
    state.spells.all.forEach((spell, idx) => {
        if (filter && !spell.name.toLowerCase().includes(filter.toLowerCase())) return;
        const isPrepared = state.spells.prepared.some(p => p.name === spell.name);
        if (isPrepared) return;
        const sDiv = document.createElement('div');
        sDiv.className = 'spell-item-all';
        sDiv.innerHTML = `
            <span>${spell.name} (Lvl ${spell.level})</span>
            <button onclick="prepareSpell(${idx})">Prepare</button>
        `;
        allSpellsDiv.appendChild(sDiv);
    });
}

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

window.toggleEditStats = () => {
    const form = document.getElementById('edit-stats-form');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        form.innerHTML = `
            Level: <input type="number" value="${state.level}" onchange="updateState('level', this.value)"><br>
            Max HP: <input type="number" value="${state.hp.max}" onchange="updateHP('max', this.value)"><br>
            Current HP: <input type="number" value="${state.hp.current}" onchange="updateHP('current', this.value)"><br>
            AC: <input type="number" value="${state.ac}" onchange="updateState('ac', this.value)"><br>
            STR: <input type="number" value="${state.stats.str}" onchange="updateStat('str', this.value)"><br>
            INT: <input type="number" value="${state.stats.int}" onchange="updateStat('int', this.value)"><br>
            CON: <input type="number" value="${state.stats.con}" onchange="updateStat('con', this.value)"><br>
            DEX: <input type="number" value="${state.stats.dex}" onchange="updateStat('dex', this.value)"><br>
            WIS: <input type="number" value="${state.stats.wis}" onchange="updateStat('wis', this.value)"><br>
            CHA: <input type="number" value="${state.stats.cha}" onchange="updateStat('cha', this.value)"><br>
        `;
    } else {
        form.style.display = 'none';
    }
};

window.updateState = (field, val) => {
    state[field] = parseInt(val);
    if (field === 'level') {
        state.proficiencyBonus = Math.floor((state.level - 1) / 4) + 2;
    }
    saveState();
    renderAll();
};

window.updateHP = (field, val) => {
    state.hp[field] = parseInt(val);
    saveState();
    renderAll();
};

window.updateStat = (stat, val) => {
    state.stats[stat] = parseInt(val);
    saveState();
    renderAll();
};

function renderAll() {
    renderStats();
    renderFeatures();
    renderSpells();
    renderInventory();
    renderSteelDefender();
}

init();
