
export default class GameplayI {
  constructor(id,socket){
    this._matchid = id;
    this._socket = socket;
    
  }
  Send(){
    var id = this._matchid;
    var opCode = 1;
    var data = { "move": {"dir": "left", "steps": 4} };
    this._socket.send({ match_data_send: { match_id: id, op_code: opCode, data: data } });
  }

  Receive(){
    this._socket.onmatchdata = (result) => {
    var content = result.data;
    switch (result.op_code) {
      case 101:
        console.log("A custom opcode.");
        break;
      default:
        console.log("User %o sent %o", result.presence.user_id, content);
    }
  }
  }




}







