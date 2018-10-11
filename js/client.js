'use strict';
var isStarted = false;
var pc;
var turnReady;
var channel;
var myId;
var remoteId;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var signallingServer = 'http://localhost:8080'

var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var startButton = document.querySelector('button#startButton');
var sendButton = document.querySelector('button#sendButton');
var closeButton = document.querySelector('button#closeButton');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var addr = document.querySelector('textarea#addr');
var setAddrButton = document.querySelector('button#setAddrButton');

startButton.onclick = start;
setAddrButton.onclick = setAddr;
sendButton.onclick = sendData;
closeButton.onclick = closeDataChannels;

// if (location.hostname !== 'localhost') {
//   console.log("Fetching turn..");
//   requestTurn(
//     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//   );
// }

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

/////////////////////////////////////////////

var socket = io(signallingServer);

function sendMessageToServer(message, messageType) {
  console.log('Client sending message: ', message);
  var data = {from: myId, to: remoteId, message: message};
  console.log(data);
  socket.emit(messageType, data);
}

function setAddr() {
  if(addr.value !== '') {
    var data = addr.value.split(" ");
    myId = data[0];
    remoteId = data[1];
    socket.emit('open-lc', myId);
    console.log('myId: '+ myId + ' remoteId: ' + remoteId);
    setAddrButton.disabled = true;
  }
}

socket.on('open-thread', function(data) {
  var message = data.message;
  if (message.type === 'offer') {
    if (!isStarted) {
      createPeerConnection();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    console.log('Sending answer to peer.');
     pc.createAnswer().then(
      function (sessionDescription) {
        console.log("Setting local description");
        pc.setLocalDescription(sessionDescription);
        console.log('setLocalAndSendMessage sending message', sessionDescription);
        sendMessageToServer(sessionDescription, 'open-thread-resp');
      },
      function (error) {
        trace('Failed to create session description: ' + error.toString());
      }
  );
  }
})

socket.on('open-thread-resp', function(data) {
  var message = data.message;
  if (message.type === 'answer' && isStarted) {
    console.log("Received answer..Setting remote");
    pc.setRemoteDescription(new RTCSessionDescription(message));
    startButton.disabled = true;
    closeButton.disabled = false;
  }
})

socket.on('ice-msg', function(data) {
  var message = data.message;
  if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  }
})

socket.on('bye', function(data) {
  if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
})

function start() {
  console.log('>>>>>>> start() ');
  console.log('>>>>>> creating peer connection');
  createPeerConnection();
  isStarted = true;
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
    sendMessageToServer(sessionDescription, 'open-thread');
  }, function (event) {
    console.log('createOffer() error: ', event);
  });
}

window.onbeforeunload = function() {
  sendMessageToServer('bye', 'bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  dataChannelSend.placeHolder = '';
  try {
    pc = new RTCPeerConnection(pcConfig);
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
    }, 'ice-msg');
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
  sendMessageToServer('bye', 'bye');
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