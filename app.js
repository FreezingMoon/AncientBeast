var express = require('express');
var pub = __dirname + '/public';
var app = express();

app.use(express.static(pub));

app.listen(80);
console.log('Type localhost to your browser url bar');