const express = require("express");
const http = require("http");
const { initializeSocketIOServer, broadcast } = require('./websocketServer');

const app = express();
const API_PORT = 3000;

app.use(express.json());

let visitorLogs = [];
let activeSessions = new Map();
let sessionStats = {
    totalActive: 0,
    totalToday: 0,
    pagesVisited: {},
    lastUpdatedDate: new Date().toISOString().slice(0, 10),
};

const server = http.createServer(app);

initializeSocketIOServer(server, activeSessions);

app.post("/api/events", (req, res) => {
    const event = req.body;
    console.log("[API Server] Received event:", event);

    if (!event.type || !event.sessionId || !event.timestamp) {
        return res.status(400).send("Missing required event fields: type, sessionId, timestamp");
    }

    visitorLogs.push(event);

    const sessionId = event.sessionId;
    let session = activeSessions.get(sessionId);

    if (!session) {
        session = {
            journey: [],
            currentPage: '',
            firstActive: new Date(event.timestamp),
            lastActive: new Date(event.timestamp),
            country: event.country || 'Unknown'
        };
        if (event.type === 'pageview') {
            session.currentPage = event.page;
            session.journey.push(event.page);
        }
    } else {
        if (event.type === 'pageview') {
            session.currentPage = event.page;
            if (!session.journey.includes(event.page)) {
                session.journey.push(event.page);
            }
            session.lastActive = new Date(event.timestamp);
        } else if (event.type === 'session_end') {
            const durationSeconds = Math.floor((new Date(event.timestamp).getTime() - session.firstActive.getTime()) / 1000);

            broadcast('session_activity', {
                sessionId: sessionId,
                currentPage: session.currentPage,
                journey: session.journey,
                duration: durationSeconds
            });

            activeSessions.delete(sessionId);
            console.log(`Session ${sessionId} ended...`);
            sessionStats.totalActive = activeSessions.size;
            res.status(200).send("Event received and processed.");
            return;
        }
    }

    if (event.type !== 'session_end') {
        activeSessions.set(sessionId, session);
    }

    sessionStats.totalActive = activeSessions.size;

    const currentDay = new Date().toISOString().slice(0, 10);
    if (sessionStats.lastUpdatedDate !== currentDay) {
        sessionStats.totalToday = 0;
        sessionStats.pagesVisited = {};
        sessionStats.lastUpdatedDate = currentDay;
        console.log(`[API Server] New day detected. Analytics summary reset for ${currentDay}.`);
    }

    if (event.type === 'pageview') {
        sessionStats.totalToday++;
        if (event.page) {
            sessionStats.pagesVisited[event.page] = (sessionStats.pagesVisited[event.page] || 0) + 1;
        }
    }

    broadcast('visitor_update', {
        event: event,
        stats: {
            totalActive: sessionStats.totalActive,
            totalToday: sessionStats.totalToday,
            pagesVisited: sessionStats.pagesVisited,
        }
    });

    if (event.type === 'pageview' && session.currentPage) {
        const currentDuration = Math.floor((new Date().getTime() - session.firstActive.getTime()) / 1000);
        broadcast('session_activity', {
            sessionId: sessionId,
            currentPage: session.currentPage,
            journey: session.journey,
            duration: currentDuration
        });
    }

    if (event.type === 'pageview' && sessionStats.totalToday % 5 === 0 && sessionStats.totalToday > 0) {
        broadcast('alert', {
            level: 'milestone',
            message: `Milestone: ${sessionStats.totalToday} total pageviews today!`,
            details: { totalPageviews: sessionStats.totalToday }
        });
    }

    res.status(200).send("Event received and processed.");
});

app.get('/api/analytics/summary', (req, res) => {
    console.log('Fetching session summary...');
    res.json(sessionStats);
});

app.get('/api/analytics/sessions', (req, res) => {
    console.log('Fetching active sessions analytics...');
    const sessionsArray = Array.from(activeSessions, ([sessionId, data]) => ({
        sessionId,
        ...data
    }));
    res.json(sessionsArray);
});

server.listen(API_PORT, () => {
    console.log(`API Server listening on http://localhost:${API_PORT}`);
    console.log(`Socket.IO Server listening on http://localhost:${API_PORT}`);
});
