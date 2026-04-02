// === MANAGE TOKEN EFFECTS MACRO ===

const token = canvas.tokens.controlled[0];
if (!token) { ui.notifications.warn("No token selected."); return; }
const actor = token.actor;
if (!actor) { ui.notifications.error("Selected token has no actor."); return; }

const allConditions = (CONFIG.statusEffects ?? [])
  .filter(e => e.id)
  .map(e => ({
    id:   e.id,
    name: game.i18n.localize(e.name ?? e.label ?? e.id),
    img:  e.img ?? e.icon ?? "icons/svg/mystery-man.svg"
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const tempEffects = actor.effects.contents.filter(e => e.isTemporary);
const removeRows = tempEffects.length
  ? tempEffects.map(e => {
      const name = e.name ?? e.label ?? "Unnamed";
      const icon = e.img ?? e.icon;
      const imgTag = icon ? `<img src="${icon}" style="width:18px;height:18px;border:none;vertical-align:middle;margin-right:6px;border-radius:3px;">` : '';
      const dur =
        e.duration?.rounds  ? `${e.duration.rounds} rnd${e.duration.rounds !== 1 ? 's' : ''}` :
        e.duration?.seconds ? `${e.duration.seconds}s` : "Temp";
      return `<label class="effect-row">
        <input type="checkbox" name="effect" value="${e.id}" />
        <span>${imgTag}</span>
        <span class="effect-name">${name}</span>
        <span class="effect-duration">${dur}</span>
      </label>`;
    }).join("")
  : `<div style="color:#7a6a40;font-style:italic;padding:10px 4px">No temporary effects.</div>`;

const addGrid = allConditions.map(c => `
  <div class="cond-cell" data-id="${c.id}" title="${c.name}">
    <img src="${c.img}" width="28" height="28" style="border:none;display:block;margin:0 auto 3px;border-radius:3px;pointer-events:none" />
    <span style="pointer-events:none">${c.name}</span>
  </div>`).join("");

const content = `
<style>
  #eff-mgr .window-header { background:linear-gradient(135deg,#1a0e00,#2e1a00)!important; border-bottom:2px solid #bfa046!important; }
  #eff-mgr .window-content { background:#12100e!important; padding:0!important; }
  #eff-mgr .tab-bar { display:flex; border-bottom:1px solid #3a2a0b; background:#1a1208; }
  #eff-mgr .tab-btn { flex:1; padding:8px; font-size:0.85em; cursor:pointer; color:#7a6a40; background:none; border:none; border-bottom:2px solid transparent; transition:color .15s,border-color .15s; }
  #eff-mgr .tab-btn.active { color:#bfa046; border-bottom-color:#bfa046; }
  #eff-mgr .tab-panel { display:none; padding:12px; }
  #eff-mgr .tab-panel.active { display:block; }
  #eff-mgr .section-label { color:#bfa046; font-family:'Papyrus',serif; font-size:0.8em; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
  #eff-mgr .actor-name { color:#ccc0a0; font-size:0.9em; font-style:italic; margin-bottom:10px; }
  #eff-mgr .sel-row { display:flex; gap:6px; margin-bottom:8px; }
  #eff-mgr .sel-btn { flex:1; padding:4px 8px; font-size:0.8em; cursor:pointer; background:#1e1a12!important; color:#7a6a40!important; border:1px solid #3a2a0b!important; border-radius:4px!important; box-shadow:none!important; margin:0!important; }
  #eff-mgr .sel-btn:hover { color:#bfa046!important; border-color:#bfa046!important; }
  #eff-mgr .effect-list { display:flex; flex-direction:column; gap:4px; max-height:300px; overflow-y:auto; padding-right:4px; }
  #eff-mgr .effect-list::-webkit-scrollbar { width:6px; }
  #eff-mgr .effect-list::-webkit-scrollbar-track { background:#1a1208; }
  #eff-mgr .effect-list::-webkit-scrollbar-thumb { background:#bfa046; border-radius:3px; }
  #eff-mgr .effect-row { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#1e1a12; border:1px solid #3a2a0b; border-radius:5px; cursor:pointer; }
  #eff-mgr .effect-row:hover { background:#2e2010; border-color:#bfa046; }
  #eff-mgr .effect-row input { accent-color:#bfa046; width:14px; height:14px; flex-shrink:0; cursor:pointer; }
  #eff-mgr .effect-name { flex:1; color:#ccc0a0; font-size:0.95em; }
  #eff-mgr .effect-duration { color:#7a6a40; font-size:0.8em; white-space:nowrap; }
  #eff-mgr .cond-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; }
  #eff-mgr .cond-cell { display:flex; flex-direction:column; align-items:center; padding:6px 4px; background:#1e1a12; border:1px solid #3a2a0b; border-radius:5px; cursor:pointer; font-size:0.72em; color:#7a6a40; text-align:center; line-height:1.2; transition:background .15s,border-color .15s,color .15s; user-select:none; }
  #eff-mgr .cond-cell:hover { background:#2e2010; border-color:#bfa046; color:#ccc0a0; }
  #eff-mgr .cond-cell.selected { background:#2a1e08; border-color:#bfa046; color:#e7d7a1; outline:1px solid #bfa046; }
  #eff-mgr .dialog-buttons { display:flex!important; gap:6px!important; padding:8px 12px 12px!important; background:#12100e!important; border-top:1px solid #3a2a0b!important; }
  #eff-mgr .dialog-buttons button { flex:1; padding:7px 12px!important; font-size:0.95em!important; cursor:pointer!important; border-radius:5px!important; box-shadow:none!important; margin:0!important; }
  #eff-mgr .dialog-buttons button[data-button="remove"] { background:#3a1010!important; color:#ff8080!important; border:1.5px solid #cc3333!important; }
  #eff-mgr .dialog-buttons button[data-button="remove"]:hover { background:#4e1818!important; border-color:#ff4444!important; color:#ffaaaa!important; }
  #eff-mgr .dialog-buttons button[data-button="add"] { background:#0e2a1a!important; color:#80e0a0!important; border:1.5px solid #2a8a4a!important; }
  #eff-mgr .dialog-buttons button[data-button="add"]:hover { background:#163a22!important; border-color:#44cc66!important; color:#aaffcc!important; }
  #eff-mgr .dialog-buttons button[data-button="cancel"] { background:#1e1a12!important; color:#a08060!important; border:1px solid #3a2a0b!important; }
  #eff-mgr .dialog-buttons button[data-button="cancel"]:hover { background:#2a2010!important; border-color:#bfa046!important; color:#e7d7a1!important; }
</style>
<div>
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="remove">✨ Remove Effects</button>
    <button class="tab-btn" data-tab="add">➕ Add Condition</button>
  </div>
  <div class="tab-panel active" data-panel="remove">
    <div class="section-label" style="margin-top:2px">Temporary Effects</div>
    <div class="actor-name">${actor.name}</div>
    <div class="sel-row">
      <button class="sel-btn" id="sel-all">Select All</button>
      <button class="sel-btn" id="sel-none">Deselect All</button>
    </div>
    <div class="effect-list">${removeRows}</div>
  </div>
  <div class="tab-panel" data-panel="add">
    <div class="section-label" style="margin-top:2px">dnd5e Conditions</div>
    <div class="actor-name">${actor.name}</div>
    <div class="cond-grid">${addGrid}</div>
  </div>
</div>`;

// Closure-based selection state — immune to html reference issues
const selectedConditions = new Set();

const dlg = new Dialog({
  title: "Manage Token Effects",
  content,
  buttons: {
    remove: {
      icon: '<i class="fas fa-trash"></i>',
      label: "Remove Selected",
      callback: async html => {
        const ids = html.find('input[name="effect"]:checked').map((_, el) => el.value).get();
        if (!ids.length) { ui.notifications.warn("No effects selected."); return; }
        await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
        ui.notifications.info(`Removed ${ids.length} effect(s) from ${actor.name}.`);
      }
    },
    add: {
      icon: '<i class="fas fa-plus"></i>',
      label: "Add Selected",
      callback: async () => {
        const ids = Array.from(selectedConditions);
        if (!ids.length) { ui.notifications.warn("No conditions selected."); return; }
        for (const id of ids) await actor.toggleStatusEffect(id, { active: true });
        ui.notifications.info(`Added ${ids.length} condition(s) to ${actor.name}.`);
      }
    },
    cancel: {
      icon: '<i class="fas fa-times"></i>',
      label: "Cancel"
    }
  },
  default: "cancel",
  render: html => {
    html.closest('.app').attr('id', 'eff-mgr');

    html.find('.tab-btn').on('click', ev => {
      const tab = ev.currentTarget.dataset.tab;
      html.find('.tab-btn').removeClass('active');
      html.find('.tab-panel').removeClass('active');
      $(ev.currentTarget).addClass('active');
      html.find(`[data-panel="${tab}"]`).addClass('active');
      dlg.setPosition({ width: tab === "add" ? 500 : 380, height: "auto" });
    });

    html.find('#sel-all').on('click',  () => html.find('input[name="effect"]').prop('checked', true));
    html.find('#sel-none').on('click', () => html.find('input[name="effect"]').prop('checked', false));

    html.find('.cond-cell').on('click', ev => {
      const cell = $(ev.currentTarget);
      const id = ev.currentTarget.dataset.id;
      if (selectedConditions.has(id)) {
        selectedConditions.delete(id);
        cell.removeClass('selected');
      } else {
        selectedConditions.add(id);
        cell.addClass('selected');
      }
    });
  }
}, { width: 380, height: "auto" }).render(true);
