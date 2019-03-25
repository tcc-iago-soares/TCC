var remoteAudio = window.document.createElement('audio');
window.document.body.appendChild(remoteAudio);

var socket = new JsSIP.WebSocketInterface('wss://sip.myhost.com');
var configuration = {
  sockets: [socket],
  uri: 'sip:iago@example.com',
  password: 'impostoeroubo'
};

var ua = new JsSIP.UA(configuration);

ua.start();

var eventHandlers = {
  'progress': function (e) {
    console.log('call is in progress');
  },
  'failed': function (e) {
    console.log('call failed with cause: ' + e.data.cause);
  },
  'ended': function (e) {
    console.log('call ended with cause: ' + e.data.cause);
  },
  'confirmed': function (e) {
    console.log('call confirmed');
  }
};

var options = {
  'eventHandlers': eventHandlers,
  'mediaConstraints': { 'audio': true, 'video': true }
};

var session = ua.call('someoone', options);
