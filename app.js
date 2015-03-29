var http    = require('http');
var express = require('express');
var morgan  = require('morgan');

var server = express();

server.use(morgan('dev'));
server.use(express.static('public'));

var s = http.createServer(server);

s.listen(80);

console.log('server listening on port 80, type localhost to your browser');

