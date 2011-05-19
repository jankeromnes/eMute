/* config.js - Configuration file for the server.
 * Jan KEROMNES, Yachen HUANG, Heidi DIKOW
 * Copyright (c) 2011 INSA-IF B3148 */
 
exports.address = '127.0.0.1';
exports.port = '8080';
exports.streams = [
  { ID:0, 'name':'animusic', type:'jpg', address:'127.0.0.1', port:8100, protocol:'TCP_PULL', ips:10 },
  { ID:1, 'name':'animusic', type:'jpg', address:'127.0.0.1', port:8101, protocol:'TCP_PUSH', ips:10 },
  { ID:2, 'name':'animusic', type:'jpg', address:'127.0.0.1', port:8102, protocol:'UDP_PULL', ips:10 },
  { ID:3, 'name':'animusic', type:'jpg', address:'127.0.0.1', port:8103, protocol:'UDP_PUSH', ips:10 }
];
exports.verbose = false;

