// === SHOW ART MACRO ===
// Shows and shares an actor's portrait with all players.
// - One token selected: shows immediately
// - Multiple tokens selected: pick from list
// - No token selected: actor search dialog

function showActorArt(actor) {
  const ip = new ImagePopout(actor.img, {
    title: actor.name,
    shareable: true,
    uuid: actor.uuid
  });
  ip.render(true);
  ip.shareImage();
  ui.notifications.info(`🖼 Showing art: ${actor.name}`);
}

// ---- Shared chrome style ----
const STYLE = `
  <style>
    #show-art-dialog .window-header {
      background: linear-gradient(135deg, #1a0e00, #2e1a00) !important;
      border-bottom: 2px solid #bfa046 !important;
    }
    #show-art-dialog .window-content {
      background: #12100e !important;
      padding: 12px !important;
    }
    #show-art-dialog .dialog-buttons {
      display: flex !important;
      gap: 6px !important;
      padding: 8px 12px 12px !important;
      background: #12100e !important;
      border-top: 1px solid #3a2a0b !important;
    }
    #show-art-dialog .dialog-buttons button {
      flex: 1;
      padding: 7px 12px !important;
      font-size: 0.95em !important;
      cursor: pointer !important;
      border-radius: 5px !important;
      box-shadow: none !important;
      margin: 0 !important;
      background: #1e1a12 !important;
      color: #a08060 !important;
      border: 1px solid #3a2a0b !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
    }
    #show-art-dialog .dialog-buttons button:hover {
      background: #2a2010 !important;
      border-color: #bfa046 !important;
      color: #e7d7a1 !important;
    }
    #show-art-dialog .art-item {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 6px 10px !important;
      background: #1e1a12 !important;
      border: 1px solid #3a2a0b !important;
      border-radius: 5px !important;
      cursor: pointer !important;
      width: 100% !important;
      text-align: left !important;
      box-shadow: none !important;
      margin: 0 !important;
      transition: background 0.15s, border-color 0.15s !important;
    }
    #show-art-dialog .art-item:hover {
      background: #2e2010 !important;
      border-color: #bfa046 !important;
    }
    #show-art-dialog .art-item img {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #5a3e1b;
      flex-shrink: 0;
    }
    #show-art-dialog .art-item span {
      color: #ccc0a0;
      font-size: 0.95em;
    }
    #show-art-dialog .section-label {
      color: #bfa046;
      font-family: 'Papyrus', serif;
      font-size: 0.8em;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    #show-art-dialog #art-search {
      width: 100%;
      padding: 7px 10px;
      background: #1e1a12;
      color: #e7d7a1;
      border: 1.5px solid #bfa046;
      border-radius: 6px;
      font-size: 0.95em;
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    #show-art-dialog .actor-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 320px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
    }
    #show-art-dialog .actor-list::-webkit-scrollbar { width: 6px; }
    #show-art-dialog .actor-list::-webkit-scrollbar-track { background: #1a1208; }
    #show-art-dialog .actor-list::-webkit-scrollbar-thumb { background: #bfa046; border-radius: 3px; }
  </style>`;

function buildActorButtons(actors) {
  return actors.map(a => `
    <button class="art-item" data-actor-id="${a.id}">
      <img src="${a.img}" />
      <span>${a.name}</span>
    </button>`).join('');
}

function openPickerDialog(actors) {
  new Dialog({
    title: "🖼 Show Art",
    content: `
      ${STYLE}
      <div class="section-label">🎭 Select Actor</div>
      <input id="art-search" type="text" placeholder="Filter..." />
      <div class="actor-list" id="actor-list">
        ${buildActorButtons(actors)}
      </div>`,
    buttons: { close: { label: "Close" } },
    render: html => {
      html.closest('.app').attr('id', 'show-art-dialog');

      html.find('#art-search').on('input', function () {
        const q = $(this).val().toLowerCase();
        const filtered = actors.filter(a => a.name.toLowerCase().includes(q));
        html.find('#actor-list').html(buildActorButtons(filtered));
        bindClicks(html);
      });

      bindClicks(html);
    }
  }, { width: 320 }).render(true);
}

function bindClicks(html) {
  html.find('.art-item').off('click').on('click', function () {
    const actor = game.actors.get($(this).data('actor-id'));
    if (actor) showActorArt(actor);
  });
}

// ---- Entry point ----
const controlled = canvas.tokens.controlled;

if (controlled.length === 1) {
  // Single token — show immediately
  const actor = controlled[0].actor;
  if (!actor?.img) { ui.notifications.warn("Token has no actor portrait."); return; }
  showActorArt(actor);

} else if (controlled.length > 1) {
  // Multiple tokens — picker pre-filtered to selected
  const actors = controlled.map(t => t.actor).filter(a => a?.img);
  if (!actors.length) { ui.notifications.warn("No actors with portraits found."); return; }
  openPickerDialog(actors);

} else {
  // No selection — full actor browser
  const actors = game.actors.contents.filter(a => a.img).sort((a, b) => a.name.localeCompare(b.name));
  if (!actors.length) { ui.notifications.warn("No actors with portraits found."); return; }
  openPickerDialog(actors);
}
