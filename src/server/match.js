import _ from 'underscore';

export default class MatchI {
  constructor(socket){
    this._socket = socket;
    
  }

 async matchCreate(){
    return await this._socket.send({ match_create: {} });
    
  }
  async matchJoin(id){
    var id = id;
    return await this._socket.send({ match_join: { match_id: id } });
  }
  async initMatches(session,client) {    
    var matchList = await client.listMatches(session);
    // console.log(matchList);
    // var matchListTest = [{match_id: "4013c271-7f3e-47a9-af22-ab91ae4504de.", size: 2},{match_id: "4013c271-7f3e-47a9-af22-ab91ae4504df.", size: 1}];
    var openMatch = _.findWhere(matchList, {size: 1});
    if(openMatch){
      return this.matchJoin(openMatch.match_id).then((m)=>{
        console.log(`joined match ${openMatch.match_id}`,m)
        return m;
      })
    }
    if(_.isEmpty(matchList)){
      console.log("no matches");
      return this.matchCreate().then((m)=>{
        console.log(`created match`,m)
        return m;
      })
    }
  
   
  }


}