// === DYNAMIC SOUNDBOARD MACRO ===
// Plays sounds from the "Panic Button" playlist for all players.
// Creates the playlist automatically if it doesn't exist.

const PLAYLIST_NAME = "Panic Button";

let playlist = game.playlists.contents.find(p => p.name === PLAYLIST_NAME);

if (!playlist) {
  playlist = await Playlist.create({ name: PLAYLIST_NAME, mode: -1 });
  ui.notifications.info(`🎵 Created playlist "${PLAYLIST_NAME}". Add sounds to it via the Playlists sidebar.`);
}

function buildSoundButtons(pl) {
  const sounds = pl.sounds.contents;
  if (!sounds.length)
    return `<p style="color:#888;font-style:italic;padding:8px 0;">No sounds yet — add them via the Playlists sidebar.</p>`;
  return sounds.map(s => {
    const path = s.path || s.sound?.src || "";
    const vol  = s.volume ?? 0.8;
    return `<button class="snd-btn" data-path="${path}" data-vol="${vol}">${s.name}</button>`;
  }).join('');
}

const content = `
  <style>
    #soundboard-dialog .window-header {
      background: linear-gradient(135deg, #1a0e00, #2e1a00) !important;
      border-bottom: 2px solid #bfa046 !important;
    }
    #soundboard-dialog .window-content {
      background: #12100e !important;
      padding: 12px !important;
    }
    #soundboard-dialog #sound-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 340px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
    }
    #soundboard-dialog #sound-list::-webkit-scrollbar { width: 6px; }
    #soundboard-dialog #sound-list::-webkit-scrollbar-track { background: #1a1208; }
    #soundboard-dialog #sound-list::-webkit-scrollbar-thumb { background: #bfa046; border-radius: 3px; }
    #soundboard-dialog .snd-btn {
      width: 100% !important;
      padding: 7px 12px !important;
      text-align: left !important;
      background: #1e1a12 !important;
      color: #ccc0a0 !important;
      border: 1px solid #3a2a0b !important;
      border-radius: 5px !important;
      font-size: 0.95em !important;
      cursor: pointer !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    #soundboard-dialog .snd-btn:hover {
      background: #2e2010 !important;
      border-color: #bfa046 !important;
      color: #ffe08a !important;
    }
    #soundboard-dialog .snd-btn:active {
      background: #3a2800 !important;
      color: #fff !important;
    }
    #soundboard-dialog .playlist-label {
      color: #bfa046;
      font-family: 'Papyrus', serif;
      font-size: 0.8em;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
  </style>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div class="playlist-label">🔊 ${PLAYLIST_NAME}</div>
    <div id="sound-list">${buildSoundButtons(playlist)}</div>
  </div>`;

new Dialog({
  title: "🎵 Soundboard",
  content,
  buttons: {},
  render: html => {
    html.closest('.app').attr('id', 'soundboard-dialog');

    html.on('click', '.snd-btn', function () {
      const path = $(this).data('path');
      const vol  = parseFloat($(this).data('vol')) || 0.8;
      if (!path) return;
      AudioHelper.play({ src: path, volume: vol, autoplay: true, loop: false }, true);
      ui.notifications.info(`🔊 Playing: ${$(this).text()}`);
    });
  },
  default: "close"
}, { width: 340 }).render(true);
