// Backend URLs (Netlify Functions)
const TOKEN_URL = 'https://exploreandbook-legal.netlify.app/.netlify/functions/pinterest-token';
const PROXY_URL = 'https://exploreandbook-legal.netlify.app/.netlify/functions/pinterest-proxy';
const CREATE_PIN_URL = 'https://exploreandbook-legal.netlify.app/.netlify/functions/pinterest-create-pin';
const CREATE_BOARD_URL = 'https://exploreandbook-legal.netlify.app/.netlify/functions/pinterest-create-board';
const PARSE_PRODUCT_URL = 'https://exploreandbook-legal.netlify.app/.netlify/functions/parse-product';

// DOM Elements
const statusDiv = document.getElementById('status');
const boardsSection = document.getElementById('boards-section');
const createBoardSection = document.getElementById('create-board-section');
const createPinSection = document.getElementById('create-pin-section');
const boardsList = document.getElementById('boards-list');
const emptyBoards = document.getElementById('empty-boards');
const pinForm = document.getElementById('pin-form');
const boardForm = document.getElementById('board-form');
const createPinBtn = document.getElementById('create-pin-btn');
const createBoardBtn = document.getElementById('create-board-btn');
const parseBtn = document.getElementById('parse-btn');
const productUrlInput = document.getElementById('product-url');
const imageUrlInput = document.getElementById('pin-image-url');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const debugInfo = document.getElementById('debug-info');
const parseResult = document.getElementById('parse-result');
const parseDetails = document.getElementById('parse-details');

let accessToken = null;
let selectedBoardId = null;
let selectedBoardName = null;
let boards = [];
let locallyCreatedBoards = [];
let parsedProduct = null;

// Logging
function log(msg, data) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${msg}`, data || '');
    const div = document.createElement('div');
    div.textContent = `[${time}] ${msg}`;
    debugInfo.appendChild(div);
    debugInfo.scrollTop = debugInfo.scrollHeight;
}

log('🚀 App loaded');

// Load saved boards
try {
    const saved = sessionStorage.getItem('sandbox_boards');
    if (saved) locallyCreatedBoards = JSON.parse(saved);
} catch (e) {}

// Image preview
imageUrlInput.addEventListener('input', function() {
    const url = this.value.trim();
    if (url && isValidUrl(url)) {
        previewImg.src = url;
        imagePreview.classList.remove('hidden');
    } else {
        imagePreview.classList.add('hidden');
    }
});

function isValidUrl(str) {
    try { new URL(str); return true; } catch { return false; }
}

// Get auth code
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const error = params.get('error');

if (error) {
    statusDiv.className = 'status error';
    statusDiv.textContent = '❌ Auth failed: ' + error;
} else if (code) {
    exchangeCodeForToken(code);
} else {
    statusDiv.className = 'status error';
    statusDiv.textContent = '❌ No auth code';
}

async function exchangeCodeForToken(authCode) {
    log('Exchanging token...');
    try {
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authCode })
        });
        const data = await res.json();
        
        if (data.access_token) {
            accessToken = data.access_token;
            localStorage.setItem('pinterest_access_token', accessToken);
            log('✅ Token saved');
            statusDiv.className = 'status success';
            statusDiv.textContent = '✅ Connected!';
            setTimeout(fetchBoards, 500);
        } else {
            throw new Error(data.message || 'No token');
        }
    } catch (err) {
        statusDiv.className = 'status error';
        statusDiv.textContent = '❌ ' + err.message;
    }
}

async function fetchBoards() {
    log('Fetching boards...');
    try {
        const res = await fetch(`${PROXY_URL}?endpoint=boards`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        
        boards = data.items || [];
        
        locallyCreatedBoards.forEach(b => {
            if (!boards.find(x => x.id === b.id)) {
                boards.push({ ...b, isLocal: true });
            }
        });
        
        if (boards.length > 0) {
            displayBoards();
            statusDiv.style.display = 'none';
            boardsSection.classList.remove('hidden');
            emptyBoards.classList.add('hidden');
        } else {
            statusDiv.className = 'status warning';
            statusDiv.textContent = '⚠️ No boards';
            setTimeout(() => {
                statusDiv.style.display = 'none';
                boardsSection.classList.remove('hidden');
                emptyBoards.classList.remove('hidden');
            }, 2000);
        }
    } catch (err) {
        statusDiv.className = 'status error';
        statusDiv.textContent = '❌ Failed to load boards';
    }
}

function displayBoards() {
    boardsList.innerHTML = '';
    boards.forEach(b => {
        const li = document.createElement('li');
        if (b.isLocal) li.className = 'new-board';
        li.innerHTML = `
            <div class="board-name">${b.name}</div>
            ${b.description ? `<div class="board-desc">${b.description}</div>` : ''}
            <div class="board-stats">📌 ${b.pin_count || 0} · 👥 ${b.follower_count || 0}</div>
        `;
        li.onclick = () => selectBoard(b.id, b.name);
        boardsList.appendChild(li);
    });
}

function selectBoard(id, name) {
    selectedBoardId = id;
    selectedBoardName = name;
    document.getElementById('selected-board-name').textContent = name;
    boardsSection.classList.add('hidden');
    createPinSection.style.display = 'block';
}

function showBoards() {
    createPinSection.style.display = 'none';
    createBoardSection.style.display = 'none';
    boardsSection.classList.remove('hidden');
    pinForm.reset();
    boardForm.reset();
    imagePreview.classList.add('hidden');
    parseResult.classList.add('hidden');
}

function showCreateBoard() {
    boardsSection.classList.add('hidden');
    createBoardSection.style.display = 'block';
}

// Parse Product
parseBtn.addEventListener('click', async function() {
    const url = productUrlInput.value.trim();
    if (!url || !isValidUrl(url)) {
        alert('Enter valid URL');
        return;
    }
    
    log('Parsing: ' + url);
    parseBtn.disabled = true;
    parseBtn.innerHTML = '<span class="loading-spinner"></span> Parsing...';
    parseResult.classList.add('hidden');
    
    try {
        const res = await fetch(PARSE_PRODUCT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const result = await res.json();
        
        if (result.success && result.data) {
            parsedProduct = result.data;
            
            document.getElementById('pin-title').value = parsedProduct.title || '';
            document.getElementById('pin-description').value = parsedProduct.description || '';
            document.getElementById('pin-image-url').value = parsedProduct.image || '';
            document.getElementById('pin-link').value = url;
            
            if (parsedProduct.image) {
                previewImg.src = parsedProduct.image;
                imagePreview.classList.remove('hidden');
            }
            
            parseDetails.innerHTML = `
                Source: ${parsedProduct.source}<br>
                ${parsedProduct.price ? `Price: ${parsedProduct.price}<br>` : ''}
                ${parsedProduct.discount ? `Discount: ${parsedProduct.discount}%` : ''}
            `;
            parseResult.classList.remove('hidden');
            
            log('✅ Parsed successfully');
        } else {
            throw new Error(result.message || 'Parse failed');
        }
    } catch (err) {
        alert('❌ ' + err.message);
    } finally {
        parseBtn.disabled = false;
        parseBtn.textContent = '🤖 Parse';
    }
});

// Create Board
boardForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('board-name').value.trim();
    const description = document.getElementById('board-description').value.trim();
    
    createBoardBtn.disabled = true;
    createBoardBtn.textContent = 'Creating...';
    
    try {
        const res = await fetch(CREATE_BOARD_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ name, description })
        });
        const data = await res.json();
        
        if (data.id) {
            const newBoard = {
                id: data.id,
                name: data.name,
                description: data.description || '',
                pin_count: 0,
                follower_count: 0,
                isLocal: true
            };
            
            locallyCreatedBoards.push(newBoard);
            boards.push(newBoard);
            sessionStorage.setItem('sandbox_boards', JSON.stringify(locallyCreatedBoards));
            
            alert('✅ Board created: ' + data.name);
            boardForm.reset();
            displayBoards();
            showBoards();
            emptyBoards.classList.add('hidden');
        } else {
            throw new Error(data.message || 'Failed');
        }
    } catch (err) {
        alert('❌ ' + err.message);
    } finally {
        createBoardBtn.disabled = false;
        createBoardBtn.textContent = 'Create Board';
    }
});

// Create Pin
pinForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const title = document.getElementById('pin-title').value.trim();
    const description = document.getElementById('pin-description').value.trim();
    const imageUrl = document.getElementById('pin-image-url').value.trim();
    const link = document.getElementById('pin-link').value.trim();
    
    if (!title || !imageUrl) {
        alert('Title and image required');
        return;
    }
    
    createPinBtn.disabled = true;
    createPinBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';
    
    try {
        const res = await fetch(CREATE_PIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                board_id: selectedBoardId,
                title,
                media_source: imageUrl,
                description,
                link
            })
        });
        const data = await res.json();
        
        if (data.id) {
            alert(`✅ Pin created!\n\nID: ${data.id}\nBoard: ${selectedBoardName}\n\n⚠️ Sandbox mode`);
            pinForm.reset();
            imagePreview.classList.add('hidden');
            parseResult.classList.add('hidden');
            parsedProduct = null;
        } else {
            throw new Error(data.message || 'Failed');
        }
    } catch (err) {
        alert('❌ ' + err.message);
    } finally {
        createPinBtn.disabled = false;
        createPinBtn.textContent = '🚀 Create Pin';
    }
});
