// --- STATE MANAGEMENT ---
let currentUser = null;
let peer = null;
let activeLocalStream = null;
let activeCall = null;

// Mock database storage in localStorage for real persistence across browser tabs!
const db = {
    getUsers: () => JSON.parse(localStorage.getItem('xchat_users')) || {},
    saveUsers: (users) => localStorage.setItem('xchat_users', JSON.stringify(users)),
    getPosts: () => JSON.parse(localStorage.getItem('xchat_posts')) || [],
    savePosts: (posts) => localStorage.setItem('xchat_posts', JSON.stringify(posts))
};

// --- DOM ELEMENTS ---
const authWindow = document.getElementById('auth-window');
const mainWindow = document.getElementById('main-window');
const txtUsername = document.getElementById('username');
const txtPassword = document.getElementById('password');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const feedContainer = document.getElementById('feed-container');

// --- APP INITIALIZATION ---
window.addEventListener('load', () => {
    updateClock();
    setInterval(updateClock, 60000);
    setupTabs();
});

function updateClock() {
    const now = new Date();
    document.getElementById('system-time').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// --- AUTHENTICATION ENGINE ---
document.getElementById('btn-signup').addEventListener('click', () => {
    const user = txtUsername.value.trim();
    const pass = txtPassword.value;
    if(!user || !pass) return alert("Enter valid credentials!");

    let users = db.getUsers();
    if(users[user]) return alert("User already exists!");

    users[user] = { password: pass, friends: [] };
    db.saveUsers(users);
    alert("Account created successfully! Please Log In.");
});

document.getElementById('btn-login').addEventListener('click', () => {
    const user = txtUsername.value.trim();
    const pass = txtPassword.value;

    let users = db.getUsers();
    if(users[user] && users[user].password === pass) {
        currentUser = user;
        initializeXchat();
    } else {
        alert("Invalid login details!");
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    location.reload(); // Quick reset
});

// --- MAIN APPLICATION START ---
function initializeXchat() {
    authWindow.classList.add('hidden');
    mainWindow.classList.remove('hidden');
    
    // Initialize WebRTC Communication via PeerJS
    // Generates a short dynamic hash for your live call tracking identity
    peer = new Peer(currentUser + '-' + Math.floor(Math.random()*1000));

    peer.on('open', (id) => {
        document.getElementById('my-peer-id').innerText = `Your Call ID: ${id}`;
    });

    // Handle Incoming Live Video Calls
    peer.on('call', (call) => {
        if(confirm(`Incoming live video call from another user. Accept?`)) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
                activeLocalStream = stream;
                document.getElementById('local-video').srcObject = stream;
                document.getElementById('video-panel').classList.remove('hidden');
                
                call.answer(stream);
                handleCallStream(call);
            }).catch(err => alert("Could not access camera: " + err));
        }
    });

    loadFriends();
    loadPosts();
    appendSystemMessage("Connected to Xchat network lobby.");
}

// --- TAB SYSTEM ENGINE ---
function setupTabs() {
    const tabChat = document.getElementById('tab-chat');
    const tabFeed = document.getElementById('tab-feed');
    const viewChat = document.getElementById('view-chat');
    const viewFeed = document.getElementById('view-feed');

    tabChat.addEventListener('click', () => {
        tabChat.classList.add('active'); tabFeed.classList.remove('active');
        viewChat.classList.remove('hidden'); viewFeed.classList.add('hidden');
    });
    tabFeed.addEventListener('click', () => {
        tabFeed.classList.add('active'); tabChat.classList.remove('active');
        viewFeed.classList.remove('hidden'); viewChat.classList.add('hidden');
    });
}

// --- TEXT MESSAGING & CHAT ENGINE ---
document.getElementById('btn-send').addEventListener('click', sendTextMessage);
chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendTextMessage(); });

function sendTextMessage() {
    const text = chatInput.value.trim();
    if(!text) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>${currentUser}:</strong> ${text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    chatInput.value = "";
}

function appendSystemMessage(msg) {
    const div = document.createElement('div');
    div.style.color = 'darkgreen';
    div.innerHTML = `<i>* ${msg}</i>`;
    chatMessages.appendChild(div);
}

// --- SOCIAL FEED & VIDEO POSTS ENGINE ---
document.getElementById('btn-post').addEventListener('click', () => {
    const text = document.getElementById('post-text-input').value.trim();
    const videoUrl = document.getElementById('post-video-url').value.trim();

    if(!text && !videoUrl) return alert("Cannot publish an empty post!");

    let posts = db.getPosts();
    posts.unshift({
        author: currentUser,
        text: text,
        video: videoUrl,
        timestamp: new Date().toLocaleString()
    });
    db.savePosts(posts);
    
    document.getElementById('post-text-input').value = "";
    document.getElementById('post-video-url').value = "";
    loadPosts();
});

function loadPosts() {
    feedContainer.innerHTML = "";
    let posts = db.getPosts();
    posts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'post';
        
        let videoEmbed = post.video ? `<br><video src="${post.video}" controls style="margin-top:8px; height:200px; width:100%; max-width:400px;"></video>` : '';
        
        postEl.innerHTML = `
            <div class="post-header">${post.author} - <span style="font-weight:normal; font-size:10px; color:#666;">${post.timestamp}</span></div>
            <div>${post.text}</div>
            ${videoEmbed}
        `;
        feedContainer.appendChild(postEl);
    });
}

// --- FRIENDS ENGINE ---
document.getElementById('btn-add-friend').addEventListener('click', () => {
    const fId = document.getElementById('friend-id-input').value.trim();
    if(!fId) return;

    let users = db.getUsers();
    if(!users[currentUser].friends) users[currentUser].friends = [];
    
    if(!users[currentUser].friends.includes(fId)) {
        users[currentUser].friends.push(fId);
        db.saveUsers(users);
        loadFriends();
        document.getElementById('friend-id-input').value = "";
    }
});

function loadFriends() {
    const list = document.getElementById('friends-list');
    list.innerHTML = "";
    let users = db.getUsers();
    let myFriends = users[currentUser].friends || [];

    myFriends.forEach(fId => {
        const li = document.createElement('li');
        li.innerText = `👤 ${fId}`;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            document.getElementById('friend-id-input').value = fId;
        });
        list.appendChild(li);
    });
}

// --- LIVE WEBRTC VIDEO CALLS ENGINE ---
document.getElementById('btn-call').addEventListener('click', () => {
    const remotePeerId = document.getElementById('friend-id-input').value.trim();
    if(!remotePeerId) return alert("Select or paste a friend's Call ID first!");

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
        activeLocalStream = stream;
        document.getElementById('local-video').srcObject = stream;
        document.getElementById('video-panel').classList.remove('hidden');

        const call = peer.call(remotePeerId, stream);
        handleCallStream(call);
    }).catch(err => alert("Error accessing devices: " + err));
});

function handleCallStream(call) {
    activeCall = call;
    call.on('stream', (remoteStream) => {
        document.getElementById('remote-video').srcObject = remoteStream;
    });
    call.on('close', closeCallInterface);
}

document.getElementById('btn-hangup').addEventListener('click', () => {
    if(activeCall) activeCall.close();
    closeCallInterface();
});

function closeCallInterface() {
    document.getElementById('video-panel').classList.add('hidden');
    if(activeLocalStream) {
        activeLocalStream.getTracks().forEach(track => track.stop());
    }
}
