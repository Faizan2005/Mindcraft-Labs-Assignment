const socket = io('http://localhost:3000');

const connectionStatusEl = document.getElementById('connectionStatus');
const dashboardsConnectedEl = document.getElementById('dashboardsConnected');
const activeVisitorsEl = document.getElementById('activeVisitors');
const totalTodayEl = document.getElementById('totalToday');
const pagesVisitedEl = document.getElementById('pagesVisited');
const liveVisitorFeedEl = document.getElementById('liveVisitorFeed');
const activeSessionsListEl = document.getElementById('activeSessionsList');
const filterCountryEl = document.getElementById('filterCountry');
const filterPageEl = document.getElementById('filterPage');
const applyFilterBtn = document.getElementById('applyFilterBtn');
const clearStatsBtn = document.getElementById('clearStatsBtn');
const newVisitorSound = document.getElementById('newVisitorSound');
const notificationBanner = document.getElementById('notificationBanner');

const sessionJourneyModal = document.getElementById('sessionJourneyModal');
const modalCloseButton = sessionJourneyModal.querySelector('.close-button');
const modalSessionId = document.getElementById('modalSessionId');
const modalCurrentPage = document.getElementById('modalCurrentPage');
const modalDuration = document.getElementById('modalDuration');
const modalJourneyList = document.getElementById('modalJourneyList');
const miniChartContainer = document.getElementById('miniChartContainer');

let currentActiveSessions = new Map();
let visitorEventsFeed = [];
let visitorsLast10Minutes = [];

function updateConnectionStatus(status, className) {
    connectionStatusEl.textContent = status;
    connectionStatusEl.className = className;
}

function showNotification() {
    if (newVisitorSound) {
        newVisitorSound.currentTime = 0;
        newVisitorSound.play().catch(e => console.error("Error playing sound:", e));
    }
    notificationBanner.classList.remove('hidden');
    setTimeout(() => {
        notificationBanner.style.opacity = '0';
        notificationBanner.style.transform = 'translateX(100%)';
    }, 2500);
    setTimeout(() => {
        notificationBanner.classList.add('hidden');
        notificationBanner.style.opacity = '1';
        notificationBanner.style.transform = 'translateX(0)';
    }, 3000);
}

function renderPagesVisited(pages) {
    pagesVisitedEl.innerHTML = '';
    if (Object.keys(pages).length === 0) {
        pagesVisitedEl.innerHTML = '<p class="placeholder">No pageviews yet.</p>';
        return;
    }
    const sortedPages = Object.entries(pages).sort(([, countA], [, countB]) => countB - countA);
    sortedPages.forEach(([page, count]) => {
        const p = document.createElement('p');
        p.textContent = `${page}: ${count} views`;
        pagesVisitedEl.appendChild(p);
    });
}

function renderLiveVisitorFeed() {
    liveVisitorFeedEl.innerHTML = '';
    if (visitorEventsFeed.length === 0) {
        liveVisitorFeedEl.innerHTML = '<p class="placeholder">No recent visitor activity.</p>';
        return;
    }
    visitorEventsFeed.forEach(event => {
        const div = document.createElement('div');
        div.className = 'list-item';
        const timestamp = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let eventDetails = '';
        if (event.type === 'pageview') {
            eventDetails = `Pageview on <strong>${event.page}</strong> by ${event.sessionId} from ${event.country}`;
        } else if (event.type === 'click') {
            eventDetails = `Click on "<strong>${event.metadata?.element || 'N/A'}</strong>" by ${event.sessionId} from ${event.country}`;
        } else if (event.type === 'session_end') {
            eventDetails = `Session ended for <strong>${event.sessionId}</strong> from ${event.country}`;
        }
        div.innerHTML = `<span class="timestamp">${timestamp}:</span> ${eventDetails}`;
        liveVisitorFeedEl.appendChild(div);
    });
}

function renderActiveSessions() {
    activeSessionsListEl.innerHTML = '';
    if (currentActiveSessions.size === 0) {
        activeSessionsListEl.innerHTML = '<p class="placeholder">No active sessions.</p>';
        return;
    }
    currentActiveSessions.forEach((session, sessionId) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.dataset.sessionId = sessionId;
        div.innerHTML = `
            <p>ID: <strong>${sessionId}</strong></p>
            <p class="small-text">Current: ${session.currentPage || 'N/A'}</p>
            <p class="small-text">Duration: ${Math.floor(session.duration || 0)}s</p>
        `;
        div.addEventListener('click', () => showSessionJourney(sessionId));
        activeSessionsListEl.appendChild(div);
    });
}

function showSessionJourney(sessionId) {
    console.trace("showSessionJourney called for:", sessionId);
    const session = currentActiveSessions.get(sessionId);
    if (session) {
        modalSessionId.textContent = sessionId;
        modalCurrentPage.textContent = session.currentPage || 'N/A';
        modalDuration.textContent = Math.floor(session.duration || 0);
        modalJourneyList.innerHTML = '';
        if (session.journey && session.journey.length > 0) {
            session.journey.forEach(page => {
                const li = document.createElement('li');
                li.textContent = page;
                modalJourneyList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No journey recorded yet.';
            modalJourneyList.appendChild(li);
        }
        sessionJourneyModal.style.display = 'flex';
    }
}

function hideSessionJourneyModal() {
    sessionJourneyModal.style.display = 'none';
}

function updateMiniChartPlaceholder() {
    const now = new Date();
    visitorsLast10Minutes = visitorsLast10Minutes.filter(v => (now - v.timestamp) < (10 * 60 * 1000));

    miniChartContainer.innerHTML = `<p>Visitors in last 10 min: <strong>${visitorsLast10Minutes.length}</strong></p>`;
    if (visitorsLast10Minutes.length === 0) {
        miniChartContainer.innerHTML += '<p>No visitors in this window.</p>';
    }
}

socket.on('connect', () => {
    updateConnectionStatus('Connected', 'status-connected');
    console.log('Connected to Socket.IO server!');
});

socket.on('disconnect', (reason) => {
    updateConnectionStatus('Disconnected', 'status-disconnected');
    console.log('Disconnected from Socket.IO server:', reason);
});

socket.on('connect_error', (error) => {
    updateConnectionStatus('Reconnecting...', 'status-reconnecting');
    console.error('Socket.IO connection error:', error);
});

socket.on('user_connected', (data) => {
    dashboardsConnectedEl.textContent = data.totalDashboards;
    console.log('User connected event:', data);
});

socket.on('user_disconnected', (data) => {
    dashboardsConnectedEl.textContent = data.totalDashboards;
    console.log('User disconnected event:', data);
});

socket.on('visitor_update', (data) => {
    console.log('Visitor update event:', data);
    activeVisitorsEl.textContent = data.stats.totalActive;
    totalTodayEl.textContent = data.stats.totalToday;
    renderPagesVisited(data.stats.pagesVisited);

    visitorEventsFeed.unshift(data.event);
    if (visitorEventsFeed.length > 15) {
        visitorEventsFeed = visitorEventsFeed.slice(0, 15);
    }
    renderLiveVisitorFeed();

    if (data.event.type === 'pageview') {
        visitorsLast10Minutes.push({ timestamp: new Date(), count: 1 });
        updateMiniChartPlaceholder();
    }

    if (data.event.type === 'pageview') {
        showNotification();
    }
});

socket.on('session_activity', (data) => {
    console.log('Session activity event:', data);
    currentActiveSessions.set(data.sessionId, data);
    renderActiveSessions();

    if (sessionJourneyModal.style.display === 'flex' && modalSessionId.textContent === data.sessionId) {
        showSessionJourney(data.sessionId);
    }
});

socket.on('alert', (data) => {
    console.log('Alert received:', data);
    alert(`[ALERT - ${data.level.toUpperCase()}] ${data.message} ${data.details ? JSON.stringify(data.details) : ''}`);
});

socket.on('detailed_stats_response', (data) => {
    console.log('Detailed stats response received:', data);
    alert(`Filtered Sessions Received: ${data.filteredData.length} sessions matching filters: ${JSON.stringify(data.requestedFilters)}`);
});

applyFilterBtn.addEventListener('click', () => {
    const countryFilter = filterCountryEl.value.trim();
    const pageFilter = filterPageEl.value.trim();

    const filters = {};
    if (countryFilter) filters.country = countryFilter;
    if (pageFilter) filters.page = pageFilter;

    if (Object.keys(filters).length > 0) {
        socket.emit('request_detailed_stats', { filter: filters });
        socket.emit('track_dashboard_action', { action: 'filter_applied', details: filters });
        console.log('Filters applied, sending request to server:', filters);
    } else {
        alert('Please enter at least one filter (Country or Page) to apply.');
    }
});

clearStatsBtn.addEventListener('click', () => {
    const confirmClear = confirm('Are you sure you want to clear all client-side statistics and active sessions? This will not affect server-side data.');
    if (confirmClear) {
        visitorEventsFeed = [];
        currentActiveSessions.clear();
        visitorsLast10Minutes = [];

        activeVisitorsEl.textContent = 0;
        totalTodayEl.textContent = 0;
        renderPagesVisited({});
        renderLiveVisitorFeed();
        renderActiveSessions();
        updateMiniChartPlaceholder();

        console.log('Client-side statistics cleared.');
    }
});

modalCloseButton.addEventListener('click', hideSessionJourneyModal);

window.addEventListener('click', (event) => {
    if (event.target === sessionJourneyModal) {
        hideSessionJourneyModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    renderLiveVisitorFeed();
    renderActiveSessions();
    renderPagesVisited({});
    updateMiniChartPlaceholder();
    setInterval(updateMiniChartPlaceholder, 30 * 1000);
});
