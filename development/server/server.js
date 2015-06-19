var express = require('express');
var app = express();
//app.get('/', function (req, res) {
//  res.send('Hello World!');
//});

app.use(express.static('deploy'));

var server = app.listen(8080, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Ancient Beast Server listening at http://%s:%s', host, port);
});
