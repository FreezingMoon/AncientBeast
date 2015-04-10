var http    = require('http');
var express = require('express');
var morgan  = require('morgan');

var app = express();

app.use(morgan('dev'));
app.use(express.static('public'));

var server = http.createServer(app);

server.listen(3000);

