'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localChannel;
var pc;
var turnReady;
var channel;
var receiveChannel;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var startButton = document.querySelector('button#startButton');
var sendButton = document.querySelector('button#sendButton');
var closeButton = document.querySelector('button#closeButton');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');

startButton.onclick = start;
sendButton.onclick = sendData;
closeButton.onclick = closeDataChannels;

/////////////////////////////////////////////

var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});


////////////////////////////////////////////////

function sendMessageToServer(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      start();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    console.log('Sending answer to peer.');
     pc.createAnswer().then(
      function (sessionDescription) {
        console.log("Setting local description");
        pc.setLocalDescription(sessionDescription);
        console.log('setLocalAndSendMessage sending message', sessionDescription);
        sendMessageToServer(sessionDescription);
      },
      function (error) {
        trace('Failed to create session description: ' + error.toString());
      }
  );
  } else if (message.type === 'answer' && isStarted) {
    console.log("Received answer..Setting remote");
    pc.setRemoteDescription(new RTCSessionDescription(message));
    startButton.disabled = true;
    closeButton.disabled = false;
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

function start() {
  console.log('>>>>>>> start() ', isStarted, isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      var dataConstraint = null;
      channel = pc.createDataChannel('dataChannel', dataConstraint);
      console.log('Created data channel');
      channel.onopen = onChannelStateChange;
      channel.onclose = onChannelStateChange;
      channel.onmessage = onReceiveCallback;
      console.log('Sending offer to peer...');
      pc.createOffer(function(sessionDescription) {
        pc.setLocalDescription(sessionDescription);
        console.log('setLocalAndSendMessage sending message', sessionDescription);
        sendMessageToServer(sessionDescription);
      }, function (event) {
        console.log('createOffer() error: ', event);
      });
    }
  }
}



window.onbeforeunload = function() {
  sendMessageToServer('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  dataChannelSend.placeHolder = '';
  var servers = null;
  var pcConstraint = null;
  try {
    pc = new RTCPeerConnection(servers, pcConstraint);
    console.log('Created RTCPeerConnnection');
    pc.onicecandidate = handleIceCandidate;
    pc.ondatachannel = channelCallback;
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function channelCallback(event) {
  trace('Receive Channel Callback');
  channel = event.channel;
  channel.onmessage = onReceiveCallback;
  channel.onopen = onChannelStateChange;
  channel.onclose = onChannelStateChange;
}

function onReceiveCallback(event) {
  console.log('Received message');
  dataChannelReceive.value = event.data;
}

function onChannelStateChange() {
  var readyState = channel.readyState;
  trace('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    sendButton.disabled = false;
    closeButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
    closeButton.disabled = true;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessageToServer({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function sendData() {
  var data = dataChannelSend.value;
  channel.send(data);
  trace('Sent Data: ' + data);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}


function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessageToServer('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

function closeDataChannels() {
  trace('Closing data channels');
  channel.close();
  trace('Closed data channel with label: ' + channel.label);
  pc.close();
  trace('Closed peer connections');
  startButton.disabled = false;
  sendButton.disabled = true;
  closeButton.disabled = true;
  dataChannelSend.value = '';
  dataChannelReceive.value = '';
  dataChannelSend.disabled = true;
}

function trace(text) {
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}