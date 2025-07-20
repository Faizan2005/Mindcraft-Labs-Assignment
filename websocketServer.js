const { Server } = require("socket.io");

let io;

const initializeSocketIOServer = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

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
            socket.emit('detailed_stats_response', { message: 'Request received, filtering not implemented yet.' });
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
