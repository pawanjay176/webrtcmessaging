# p2p communication using webrtc

Testing of p2p communication between 2 browsers. Can be used for hub and spoke kind of architectures. Hub needs to have additional endpoints for webrtc signalling. Socket.io server used as signalling server for initial connection establishment. Tested connection establishment between networks where only STUN server was needed for connection establishment. 

TODO: Test connection establishment where TURN server is needed. 

## Running instructions

### Server side
To run the signalling server, 

 * npm install
 * npm run start


### Client side

Change the signallingServer variable in line 16 of client.js to point to the url of your signalling server.

To run a client, open index.html. 

Currently supports just 2 way communication. To test, 

  * Run 2 instances of index.html (can be on different networks).
  * Enter a id for current peer and remote peer in both instances(e.g. 1 2 in session 1 and 2 1 in session 2) and click on setAddress.
  * Click start in 1 of the instances to establish a data channel. After this step, all communication is p2p. 
  * Type messages in send and click send to send messages


PS: sorry for the atrocious UI.
