/* server.js - A simple Node.js video streaming server.
 * Jan KEROMNES, Yachen HUANG, Heidi DIKOW
 * Copyright (c) 2011 INSA-IF B3148 */

// globals
var CRLF = '\r\n';

// modules
var config = require('./config'), http = require('http'), net = require('net'), fs = require('fs'), dgram = require('dgram'), streams = config.streams;

// buffer improvement
Buffer.prototype.append = function(chunk) {
  for (var i = 0, l = this.length ; i < chunk.length ; i++) {
    //this[l + i] = chunk[i];
    this.push(chunk[i]);
  }
  //this.length += chunk.length;
  return this;
};

// verbose mode
var log = function(message) {
  if(config.verbose) console.log('[' + new Date().toLocaleTimeString() + '] ' + message);
};
log('Verbose Mode is ON (to turn it OFF, edit config.js)');

// streams index
var index = 'ServerAddress: ' + config.address + CRLF + 'ServerPort: ' + config.port + CRLF;

for ( var i in streams ) {

  switch(streams[i].protocol) {
    
    // tcp server
    case 'TCP_PULL': case 'TCP_PUSH':
      net.Server(function (socket) {
        
        // status information
        var connection, stream, current = 0, play = false;
        
        // read and send an image
        var send = function(){
          var path = stream['name'] + '/img' + current + '.' + stream.type;
          fs.readFile(path, 'binary', function(err,file) {
            if(err) {
              current = 0;
              path = stream['name'] + '/img' + current + '.' + stream.type;
              fs.readFile(path, 'binary', function(err,file) {
                if(connection.writable) {
                  connection.write(current + CRLF + file.length + CRLF + file, 'binary');
                  log('>>> TCP '+JSON.stringify([current, file.length, '<' + path + '>'])); // debug
                }
              });
            } else {
              if(connection.writable) {
                connection.write(current + CRLF + file.length + CRLF + file, 'binary');
                log('>>> TCP '+JSON.stringify([current, file.length, '<' + path + '>'])); // debug
              }
            }
            current++;
            if(play && connection.writable) setTimeout(send, 1000 / stream.ips);
          });
        };
        
        // react to data input
        socket.on('data', function (data) {
          var words = (data + '').split(/\s/).filter(function(e){return e.length});
          log('<<< TCP '+JSON.stringify(words)); // debug
          switch (words[0]){
            case 'GET':
              if (words[2] == 'LISTEN_PORT') {
                stream = streams[words[1]];
                connection = net.createConnection(words[3], socket.address);
                connection.on('end', function(){
                  play = false;
                });
                connection.on('close', function(){
                  play = false;
                });
                if (words[4] == 'START') {
                  play = true;
                  send();
                }
              } else {
                current = (words[1] < 0 ? current : words[1]);
                send();
              }
            break;
            case 'START':
              play = true;
              send();
            break;
            case 'END':
              play = false;
              connection.destroy();
            case 'PAUSE':
              play = false;
            break;
          }
        });
        
        // if connection ends or is closed, stop sending images
        socket.on('end', function(){
          play = false;
        });
        socket.on('close', function(){
          play = false;
        });
        
      }).listen(streams[i].port);
      log('TCP STREAM '+streams[i]['name']+' running on port '+streams[i].port);
    break;
    
    // udp server
    case 'UDP_PULL': case 'UDP_PUSH':
      // client status
      var status = {};
      
      dgram.createSocket('udp4', function (data, infos) {
      
        // get client status
        var client = infos.address.replace(/\./g, '_') + '_' + infos.port;
        if (!status[client]) status[client] = {
          port: 0,
          socket: undefined,
          stream: undefined,
          current: 0,
          fragment: 0,
          play: false
        };
          
        // read and send an image divided into fragments
        var send = function(){
          var path = status[client].stream['name'] + '/img' + status[client].current + '.' + status[client].stream.type;
          fs.readFile(path, function(err,file) {
            if(err) {
              status[client].current = 0;
              path = status[client].stream['name'] + '/img' + status[client].current + '.' + status[client].stream.type;
              fs.readFile(path, function(err,file) {
                var sent = 0;
                var sendFragment = function() {
                  var to = Math.min(sent + status[client].fragment, file.length);
                  var headers = new Buffer(
                    status[client].current + CRLF + file.length + CRLF + sent + CRLF +
                    (to - sent) + CRLF
                  );
                  var chunk = file.slice(sent, to);
                  var buffer = new Buffer(headers.length + chunk.length);
                  headers.copy(buffer, 0, 0, headers.length);
                  chunk.copy(buffer, headers.length, 0, chunk.length);
                  sent = to;
                  log('>>> UDP '+JSON.stringify([status[client].current, sent + '/' + file.length, '<' + path + '>', infos.address+':'+status[client].port])); // debug
                  status[client].socket.send(buffer, 0, buffer.length, status[client].port, infos.address);
                  if (sent < file.length) setTimeout(sendFragment, 0);
                };
                sendFragment();
              });
            } else {
              var sent = 0;
              var sendFragment = function() {
                var to = Math.min(sent + status[client].fragment, file.length);
                var headers = new Buffer(
                  status[client].current + CRLF + file.length + CRLF + sent + CRLF +
                  (to - sent) + CRLF
                );
                var chunk = file.slice(sent, to);
                var buffer = new Buffer(headers.length + chunk.length);
                headers.copy(buffer, 0, 0, headers.length);
                chunk.copy(buffer, headers.length, 0, chunk.length);
                sent = to;
                log('>>> UDP '+JSON.stringify([status[client].current, sent + '/' + file.length, '<' + path + '>', infos.address+':'+status[client].port])); // debug
                status[client].socket.send(buffer, 0, buffer.length, status[client].port, infos.address);
                if (sent < file.length) setTimeout(sendFragment, 0);
              };
              sendFragment();
            }
          });
          status[client].current++;
          if(status[client].play) setTimeout(send, 1000 / status[client].stream.ips);
        };

        // react to data input      
        var words = (data + '').split(/\s/).filter(function(e){return e.length});
        log('<<< UDP ' + JSON.stringify(words)); // debug
        switch (words[0]){
          case 'GET':
            if (words[2] == 'LISTEN_PORT') {
              status[client].port = 1*words[3];
              status[client].stream = streams[words[1]];
              status[client].socket = dgram.createSocket('udp4');
              status[client].fragment = 448;//1*words[5]; // debug
              if (words[4] == 'START') {
                status[client].play = true;
                send();
              }
            } else {
              status[client].current = (words[1] < 0 ? status[client].current : words[1]);              
              send();
            }
          break;
          case 'START':
            status[client].play = true;
            send();
          break;
          case 'END': case 'PAUSE':
            status[client].play = false;
          break;
        }
      }).bind(streams[i].port);
      log('UDP STREAM '+streams[i]['name']+' running on port '+streams[i].port);
    break;
  
  }
  
  // add each stream to index
  index += 'Object';
  for ( var key in streams[i] ) {
    index += ' ' + key + '=' + streams[i][key];
  }
  index += CRLF;
}
index += CRLF;

// http server
http.createServer(function (req, res){
  log('>>> HTTP [INDEX]'); // debug
  res.writeHead(200, {'Server': config.address, 'Content-Type': 'text/txt', 'Content-Length': index.length});
  res.end(index);
}).listen(config.port);
log('HTTP INDEX server running on port '+config.port);
