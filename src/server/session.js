import {Session} from "@heroiclabs/nakama-js/dist/nakama-js.esm";
export default class SessionI {
  constructor (session) {
    this.session = session || '';
  }  
  storeSession () {
    if (typeof Storage !== 'undefined') {
      localStorage.setItem ('nakamaToken', this.session.token);
      console.log ('Session stored.');
    }
  }
  async getSessionFromStorage () {
    if (typeof Storage !== 'undefined') {
      return Promise.resolve (localStorage.getItem ('nakamaToken'));
    } 
  }


  async restoreSession() {
    var session = null;
      return this.getSessionFromStorage ().then((token)=>{
      
        if (token && token != '') {
          session = Session.restore (token);
          console.log(session);
          var currentTimeInSec = new Date () / 1000;
          if (!session.isexpired (currentTimeInSec)) {
            console.log ('Restored session. User ID: %o', session.user_id);
            return Promise.resolve (session);
          }
          return Promise.resolve (false);
          
        }
    })

  }
}

// restoreSessionOrAuthenticate ()
//   .then (function (session) {
//     currentSession = session;
//     return client.writeStorageObjects (currentSession, [
//       {
//         collection: 'collection',
//         key: 'key1',
//         value: {jsonKey: 'jsonValue'},
//       },
//     ]);
//   })
//   .then (function (writeAck) {
//     console.log ('Storage write was successful - ack: %o', writeAck);
//   })
//   .catch (function (e) {
//     console.log ('An error occured: %o', e);
//   });
