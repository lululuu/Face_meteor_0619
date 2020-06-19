Template.lobby.helpers({

  rematch() {
    return Players.findOne(Meteor.userId()).needRematch;
  },

  desiredNumPlayers() {
    return groupSize;
  },

  numWaiting() {
    const connectedUsers = LobbyStatus.find().fetch();
    const lobbyUsers = [];
    let player;
    _.each(connectedUsers, (usr) => {
      player = Players.findOne(usr._id);
      // Guard against empty queries
      if (player) {
        if (player.passedQuiz && player.status === 'waiting') {
          lobbyUsers.push(usr);
        }
      }
    });
    return lobbyUsers.length;
  },

  clock() {
    Meteor.setInterval(() => {
      const sTime = Session.get('sTime');
      const elapsed = (new Date() - sTime) / 1000;
      const m = Math.floor(elapsed / 60);
      let s = Math.floor(elapsed % 60);
      s = s < 10 ? `0${s}` : s;
      Session.set('min', m);
      Session.set('sec', s);
    }, 900);

    return {
      min: Session.get('min'),
      sec: Session.get('sec')
    };
  },

  lobbyTimeout() {
    return lobbyTimeout;
  }

});
Template.lobby.onCreated(() => {
  Session.set('sTime', new Date());
});
