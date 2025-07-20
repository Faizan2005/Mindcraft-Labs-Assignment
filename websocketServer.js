const { Server } = require("socket.io");

let io;
let activeSessionsGlobal;

const initializeSocketIOServer = (httpServer, activeSessionsMap) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    activeSessionsGlobal = activeSessionsMap;

    io.on('connection', (socket) => {
        console.log(`[Socket.IO Server] Client connected: ${socket.id}`);

        const totalDashboards = io.engine.clientsCount;
        console.log(`[Socket.IO Server] Total connected dashboards: ${totalDashboards}`);

        io.emit('user_connected', {
            totalDashboards: totalDashboards,
            connectedAt: new Date().toISOString()
        });

        socket.on('request_detailed_stats', (data) => {
            console.log(`[Socket.IO Server] Received 'request_detailed_stats' from client ${socket.id}. Filters:`, data.filter);

            const requestedFilters = data.filter || {};
            let filteredSessions = [];

            if (activeSessionsGlobal) {
                filteredSessions = Array.from(activeSessionsGlobal.values()).filter(session => {
                    const countryMatch = !requestedFilters.country ||
                        (session.country && session.country.toLowerCase() === requestedFilters.country.toLowerCase());
                    const pageMatch = !requestedFilters.page ||
                        (session.journey && session.journey.includes(requestedFilters.page));
                    return countryMatch && pageMatch;
                });
            } else {
                console.warn("[Socket.IO Server] activeSessionsGlobal not available for filtering.");
            }

            socket.emit('detailed_stats_response', {
                filteredData: filteredSessions,
                requestedFilters: requestedFilters
            });
        });

        socket.on('track_dashboard_action', (data) => {
            console.log(`[Socket.IO Server] Dashboard action tracked from ${socket.id}: ${data.action}`, data.details);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket.IO Server] Client disconnected: ${socket.id} (Reason: ${reason})`);

            const totalDashboards = io.engine.clientsCount;
            console.log(`[Socket.IO Server] Total connected dashboards: ${totalDashboards}`);

            io.emit('user_disconnected', {
                totalDashboards: totalDashboards
            });
        });
    });

    console.log(`Socket.IO Server initialized.`);
};

const broadcast = (type, data) => {
    if (!io) {
        console.error("Socket.IO not initialized yet!");
        return;
    }
    io.emit(type, data);
    console.log(`[Socket.IO Server] Broadcasted '${type}' to all clients.`);
};

module.exports = {
    initializeSocketIOServer,
    broadcast
};
