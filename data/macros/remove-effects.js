// === REMOVE TEMPORARY EFFECTS MACRO ===
// Lists and removes temporary effects from the controlled token.

const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn("No token selected.");
  return;
}
const actor = token.actor;
if (!actor) {
  ui.notifications.error("Selected token has no actor.");
  return;
}

const effects = actor.effects.contents.filter(e => e.isTemporary);
if (!effects.length) {
  ui.notifications.info("This actor has no temporary effects.");
  return;
}

let effectRows = '';
for (const effect of effects) {
  const name = effect.name ?? effect.label ?? "Unnamed Effect";
  const icon = effect.icon ? `<img src="${effect.icon}" style="width:18px;height:18px;border:none;vertical-align:middle;margin-right:6px;border-radius:3px;">` : '';
  const duration =
    effect.duration?.rounds  ? `${effect.duration.rounds} round${effect.duration.rounds !== 1 ? 's' : ''}` :
    effect.duration?.seconds ? `${effect.duration.seconds}s` :
    "Temporary";
  effectRows += `
    <label class="effect-row">
      <input type="checkbox" name="effect" value="${effect.id}" />
      <span class="effect-icon">${icon}</span>
      <span class="effect-name">${name}</span>
      <span class="effect-duration">${duration}</span>
    </label>`;
}

const content = `
  <style>
    #effects-dialog .window-header {
      background: linear-gradient(135deg, #1a0e00, #2e1a00) !important;
      border-bottom: 2px solid #bfa046 !important;
    }
    #effects-dialog .window-content {
      background: #12100e !important;
      padding: 12px !important;
    }
    #effects-dialog .section-label {
      color: #bfa046;
      font-family: 'Papyrus', serif;
      font-size: 0.8em;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    #effects-dialog .actor-name {
      color: #ccc0a0;
      font-size: 0.9em;
      font-style: italic;
      margin-bottom: 10px;
    }
    #effects-dialog .effect-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 340px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
    }
    #effects-dialog .effect-list::-webkit-scrollbar { width: 6px; }
    #effects-dialog .effect-list::-webkit-scrollbar-track { background: #1a1208; }
    #effects-dialog .effect-list::-webkit-scrollbar-thumb { background: #bfa046; border-radius: 3px; }
    #effects-dialog .effect-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #1e1a12;
      border: 1px solid #3a2a0b;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    #effects-dialog .effect-row:hover {
      background: #2e2010;
      border-color: #bfa046;
    }
    #effects-dialog .effect-row input[type="checkbox"] {
      accent-color: #bfa046;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      cursor: pointer;
    }
    #effects-dialog .effect-name {
      flex: 1;
      color: #ccc0a0;
      font-size: 0.95em;
    }
    #effects-dialog .effect-duration {
      color: #7a6a40;
      font-size: 0.8em;
      white-space: nowrap;
    }
    #effects-dialog .select-row {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    #effects-dialog .sel-btn {
      flex: 1;
      padding: 4px 8px;
      font-size: 0.8em;
      cursor: pointer;
      background: #1e1a12 !important;
      color: #7a6a40 !important;
      border: 1px solid #3a2a0b !important;
      border-radius: 4px !important;
      box-shadow: none !important;
      margin: 0 !important;
      transition: color 0.15s, border-color 0.15s !important;
    }
    #effects-dialog .sel-btn:hover {
      color: #bfa046 !important;
      border-color: #bfa046 !important;
    }
    #effects-dialog .dialog-buttons {
      display: flex !important;
      gap: 6px !important;
      padding: 8px 12px 12px !important;
      background: #12100e !important;
      border-top: 1px solid #3a2a0b !important;
    }
    #effects-dialog .dialog-buttons button {
      flex: 1;
      padding: 7px 12px !important;
      font-size: 0.95em !important;
      cursor: pointer !important;
      border-radius: 5px !important;
      box-shadow: none !important;
      margin: 0 !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
    }
    #effects-dialog .dialog-buttons button[data-button="delete"] {
      background: #3a1010 !important;
      color: #ff8080 !important;
      border: 1.5px solid #cc3333 !important;
    }
    #effects-dialog .dialog-buttons button[data-button="delete"]:hover {
      background: #4e1818 !important;
      border-color: #ff4444 !important;
      color: #ffaaaa !important;
    }
    #effects-dialog .dialog-buttons button[data-button="cancel"] {
      background: #1e1a12 !important;
      color: #a08060 !important;
      border: 1px solid #3a2a0b !important;
    }
    #effects-dialog .dialog-buttons button[data-button="cancel"]:hover {
      background: #2a2010 !important;
      border-color: #bfa046 !important;
      color: #e7d7a1 !important;
    }
  </style>
  <div style="display:flex;flex-direction:column;gap:0;">
    <div class="section-label">✨ Temporary Effects</div>
    <div class="actor-name">${actor.name}</div>
    <div class="select-row">
      <button class="sel-btn" id="sel-all">Select All</button>
      <button class="sel-btn" id="sel-none">Deselect All</button>
    </div>
    <div class="effect-list">${effectRows}</div>
  </div>`;

new Dialog({
  title: "✨ Temporary Effects",
  content,
  buttons: {
    delete: {
      icon: '<i class="fas fa-trash"></i>',
      label: "Delete Selected",
      callback: async html => {
        const ids = html.find('input[name="effect"]:checked').map((i, el) => el.value).get();
        if (!ids.length) { ui.notifications.warn("No effects selected."); return; }
        await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
        ui.notifications.info(`✨ Removed ${ids.length} effect(s) from ${actor.name}.`);
      }
    },
    cancel: {
      icon: '<i class="fas fa-times"></i>',
      label: "Cancel"
    }
  },
  default: "cancel",
  render: html => {
    html.closest('.app').attr('id', 'effects-dialog');
    html.find('#sel-all').on('click',  () => html.find('input[name="effect"]').prop('checked', true));
    html.find('#sel-none').on('click', () => html.find('input[name="effect"]').prop('checked', false));
  }
}, { width: 340 }).render(true);
