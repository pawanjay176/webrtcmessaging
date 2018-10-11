'use strict';

var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080, "0.0.0.0");

var clients = {}

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  socket.on('open-lc', function(addr) {
    console.log('Opening a channel with ' + addr);
    clients[addr] = socket;
    // Other open-lc stuff...
  })

  socket.on('open-thread', function(data) {
    console.log("Opening thread between " + data.from + " and " + data.to);
    if(clients[data.from] && clients[data.to]) {
      clients[data.to].emit('open-thread', data);
    }
  });

  socket.on('open-thread-resp', function(data) {
    console.log("Opening thread response from" + data.from);
    if(clients[data.from] && clients[data.to]) {
      clients[data.to].emit('open-thread-resp', data);
    }
  })

  socket.on('ice-msg', function(data) {
    console.log("Passing ice messages..");
    if(clients[data.from] && clients[data.to]) {
      clients[data.to].emit('ice-msg', data);
    }
  })

  socket.on('bye', function(data) {
    if(clients[data.from] && clients[data.to]) {
      clients[data.to].emit('bye', data);
    }
  })
  
  socket.on('bye', function(){
    console.log('received bye');
  });

});
