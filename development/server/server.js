// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8080;
var gameManager = require('./gamemanager.js');
var qManager = require('./queuemanager.js');

//setup the game queue and connection details
io.on('connection', function(session){
  console.log('a user connected');

  //store the username in the socket session for this client
  var username = makeid();
  session.username = username;

  //add user to the queue
  qManager.addToQueue(session);

  session.on('disconnect', function(){
    console.log('user disconnected');
    qManager.removeFromQueue(session);
  });

  //send user the username
  session.emit('login', session.username);

});


function makeid()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}


//listen for server, and use static routing for deploy directory
server.listen(port, function () {
  console.log('Server listening at port %d', port);
});
app.use(express.static('./deploy'));
