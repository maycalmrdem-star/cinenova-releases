/**
 * CineNova Watch Party
 * Desktop Electron Native App Support & 6-Digit Room System
 */

const SUPABASE_URL = "https://wslsmfkqjaiaayzhbibp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbHNtZmtxamFpYWF5emhiaWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODI5NTAsImV4cCI6MjA5Njg1ODk1MH0.Vs8Egs2yJwMOLLwhsYc5PVmZA3QWgEZ4FhzOQ5i9xQQ";

let supabaseClient = null;
let realtimeChannel = null;

const isDesktopApp = navigator.userAgent.includes('Electron');

// SECURITY: escape any peer-supplied text (names, room codes) before it's
// inserted via innerHTML — these values come from other participants and
// are otherwise a stored-XSS vector broadcast to everyone in the room.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// Room State
let currentRoomId = null;
let currentPartyName = "Watch Party";
let isHost = false;
let myName = "User";
let participants = {};

// WebRTC State
let localStream = null;
let peerConnections = {};
const configuration = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    // Show 'Join Party' nav only if in the Desktop App
    if (isDesktopApp) {
        const joinBtn = document.getElementById('nav-join-party');
        if (joinBtn) {
            joinBtn.style.display = 'block';
            joinBtn.onclick = handleJoinPartyClick;
        }
    }
});

window.startWatchParty = async function (item) {
    if (!isDesktopApp) {
        alert("Watch Party Sync is highly restricted by browsers.\nTo enjoy automatic video synchronization, please download the free CineNova Secure Desktop App from the bottom of the page!");
        return;
    }

    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    const partyTitle = prompt("Enter a name for your Watch Party:", `${item.title || item.name} Party`);
    if (!partyTitle) return;

    currentPartyName = partyTitle;
    myName = prompt("Enter your Admin username:", "Host") || "Host";

    // Generate exactly 6 digits
    currentRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    isHost = true;

    // The Host's state
    window.hostedMediaInfo = { id: item.id, type: item.media_type || 'movie' };

    document.getElementById('detail-modal').classList.remove('active');

    playItem(item, -1, 1, 1);

    await joinRoom(currentRoomId);
};

// When user clicks the top nav to join a room via code
async function handleJoinPartyClick() {
    const code = prompt("Enter the 6-Digit Party Code:");
    if (!code || code.length < 6) return;

    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    isHost = false;
    currentRoomId = code;
    myName = prompt(`Joining ${code}... Enter your username:`, `Guest_${Math.floor(Math.random() * 1000)}`) || "Guest";

    alert("Joining room " + code + ". Waiting for host to send media info...");
    await joinRoom(code);
}

async function joinRoom(roomId) {
    if (!supabaseClient) return;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // Start muted by default
        localStream.getAudioTracks()[0].enabled = false;
    } catch (e) {
        console.error("Microphone access denied", e);
    }

    realtimeChannel = supabaseClient.channel(roomId, {
        config: {
            broadcast: { self: false },
            presence: { key: myName }
        }
    });

    realtimeChannel.on('presence', { event: 'sync' }, () => {
        participants = realtimeChannel.presenceState();
        updateViewersUI();
    });

    realtimeChannel.on('broadcast', { event: 'signal' }, async (payload) => {
        const data = payload.payload;

        // Host providing media index to guests
        if (data.type === 'media_info' && !isHost) {
            const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8';
            const searchRes = await fetch(`https://api.themoviedb.org/3/${data.mediaType}/${data.mediaId}?api_key=${TMDB_KEY}`).then(r => r.json());
            if (searchRes.id) {
                searchRes.media_type = data.mediaType;
                playItem(searchRes, -1, 1, 1);
                setTimeout(() => {
                    buildVoiceUI();
                    currentPartyName = data.partyName;
                    const pTitle = document.getElementById('player-title');
                    if (pTitle) pTitle.innerText = `${currentPartyName} (${pTitle.innerText})`;
                    updateMicBtnUI();
                }, 500); // ensure iframe is built
            }
        }

        // WebRTC Signaling
        if (data.type === 'peer_join') {
            // New peer joined. If I am host, I will send them the media info
            if (isHost && window.hostedMediaInfo) {
                broadcastSignal({ type: 'media_info', mediaId: window.hostedMediaInfo.id, mediaType: window.hostedMediaInfo.type, partyName: currentPartyName });
            }

            createPeerConnection(data.sender);
            const offer = await peerConnections[data.sender].createOffer();
            await peerConnections[data.sender].setLocalDescription(offer);
            broadcastSignal({ type: 'offer', offer: offer, sender: supabaseClient.realtime.clientId, target: data.sender });
        } else if (data.type === 'offer' && data.target === supabaseClient.realtime.clientId) {
            createPeerConnection(data.sender);
            await peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnections[data.sender].createAnswer();
            await peerConnections[data.sender].setLocalDescription(answer);
            broadcastSignal({ type: 'answer', answer: answer, sender: supabaseClient.realtime.clientId, target: data.sender });
        } else if (data.type === 'answer' && data.target === supabaseClient.realtime.clientId) {
            await peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === 'ice-candidate' && data.target === supabaseClient.realtime.clientId) {
            await peerConnections[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });

    // ── NATIVE APP AUTO-SYNC HANDLERS ──
    realtimeChannel.on('broadcast', { event: 'host_sync' }, (payload) => {
        if (!isHost && isDesktopApp) {
            const data = payload.payload;
            const iframe = document.getElementById('player-frame');
            if (!iframe) return;

            // In Electron with webSecurity:false, we can access the iframe's video
            try {
                const innerDoc = iframe.contentWindow.document;
                const innerVid = innerDoc.querySelector('video');
                if (innerVid) {
                    if (data.action === 'play') innerVid.play();
                    if (data.action === 'pause') innerVid.pause();
                    if (data.action === 'seek') innerVid.currentTime = data.time;
                }
            } catch (e) {
                console.warn("God-Mode access delayed or failed", e);
            }
        }
    });

    realtimeChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await realtimeChannel.track({ name: myName, isHost: isHost, joinedAt: Date.now() });
            broadcastSignal({ type: 'peer_join', sender: supabaseClient.realtime.clientId });

            if (isHost) {
                buildVoiceUI();
                attachHostGodModeBindings();
                updateMicBtnUI();
            }
        }
    });
}

function broadcastSignal(payload) {
    if (realtimeChannel) realtimeChannel.send({ type: 'broadcast', event: 'signal', payload: payload });
}

function broadcastHostSync(action, time = 0) {
    if (realtimeChannel && isHost) {
        realtimeChannel.send({ type: 'broadcast', event: 'host_sync', payload: { action, time } });
    }
}

// ── WebRTC ──
function createPeerConnection(peerId) {
    if (peerConnections[peerId]) return;
    const pc = new RTCPeerConnection(configuration);
    peerConnections[peerId] = pc;
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = event => {
        if (event.candidate) broadcastSignal({ type: 'ice-candidate', candidate: event.candidate, sender: supabaseClient.realtime.clientId, target: peerId });
    };

    pc.ontrack = event => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };
}

// ── NATIVE SYNC INJECTOR ──
function attachHostGodModeBindings() {
    if (!isHost || !isDesktopApp) return;

    // Every few seconds, attempt to locate the internal iframe video element and bind to it
    const finderInterval = setInterval(() => {
        const iframe = document.getElementById('player-frame');
        if (iframe && iframe.contentWindow) {
            try {
                const innerDoc = iframe.contentWindow.document;
                const innerVid = innerDoc.querySelector('video');

                if (innerVid && !innerVid.hasAttribute('data-wp-bound')) {
                    innerVid.setAttribute('data-wp-bound', 'true');

                    innerVid.addEventListener('play', () => broadcastHostSync('play'));
                    innerVid.addEventListener('pause', () => broadcastHostSync('pause'));
                    innerVid.addEventListener('seeked', () => broadcastHostSync('seek', innerVid.currentTime));

                    alert("Native Sync Active! Play/Pause will now automatically broadcast to guests!");
                    clearInterval(finderInterval);
                }
            } catch (e) { }
        }
    }, 2000);
}

// ── UI ──
function buildVoiceUI() {
    let wrap = document.getElementById('wp-overlay');
    if (!wrap) {
        const header = document.querySelector('.player-header');
        if (header) {
            const pTitle = document.getElementById('player-title');
            if (pTitle) pTitle.innerText = `${currentPartyName} (${pTitle.innerText})`;

            wrap = document.createElement('div');
            wrap.id = 'wp-overlay';
            wrap.style.cssText = "display:flex; align-items:center; gap: 15px; margin-left: auto; margin-right: 20px; background: rgba(0,0,0,0.7); padding: 5px 15px; border-radius: 20px; z-index: 9999;";

            const hostDisplay = `<span style="font-weight:bold; color:gold; margin-right:5px;">Room: ${escapeHtml(currentRoomId)}</span>`;

            wrap.innerHTML = `
                ${hostDisplay}
                <div style="position:relative;">
                    <button id="wp-viewers-btn" style="background:transparent; border:none; color:#ddd; cursor:pointer; font-size:1rem; display:flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-eye"></i> <span id="wp-count">1</span>
                    </button>
                    <div id="wp-viewers-list" style="display:none; position:absolute; top:30px; right:0; background:#222; border:1px solid #444; border-radius:8px; padding:10px; width:150px; flex-direction:column; gap:5px;">
                    </div>
                </div>
                <button id="wp-mic-btn" style="background:transparent; border:none; color:#ff4444; cursor:pointer; font-size:1.2rem;">
                    <i class="fa-solid fa-microphone-slash"></i>
                </button>
            `;
            header.insertBefore(wrap, document.getElementById('ep-nav'));

            document.getElementById('wp-mic-btn').onclick = () => {
                if (localStream) {
                    const audioTrack = localStream.getAudioTracks()[0];
                    audioTrack.enabled = !audioTrack.enabled;
                    updateMicBtnUI();
                }
            };
            document.getElementById('wp-viewers-btn').onclick = () => {
                const list = document.getElementById('wp-viewers-list');
                list.style.display = list.style.display === 'none' ? 'flex' : 'none';
            };
        }
    }
}

function updateViewersUI() {
    const listDiv = document.getElementById('wp-viewers-list');
    const countSpan = document.getElementById('wp-count');
    if (!listDiv || !countSpan) return;

    let count = 0;
    listDiv.innerHTML = `<div style="font-size:0.8rem; color:#888; margin-bottom:5px; border-bottom:1px solid #444; padding-bottom:3px;">In Room</div>`;

    for (const [key, presenceData] of Object.entries(participants)) {
        if (presenceData && presenceData.length > 0) {
            const user = presenceData[0];
            count++;
            listDiv.innerHTML += `<div style="font-size:0.9rem; color:#fff;">
                <i class="fa-solid ${user.isHost ? 'fa-crown' : 'fa-user'}" style="color:${user.isHost ? 'gold' : '#ccc'}; font-size:0.8rem;"></i>
                ${escapeHtml(user.name)}
            </div>`;
        }
    }
    countSpan.innerText = count.toString();
}

function updateMicBtnUI() {
    const btn = document.getElementById('wp-mic-btn');
    if (!btn || !localStream) return;
    const isMuted = !localStream.getAudioTracks()[0].enabled;
    if (isMuted) {
        btn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        btn.style.color = '#ff4444';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        btn.style.color = '#4caf50';
    }
}
