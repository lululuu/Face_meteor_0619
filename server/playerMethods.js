// SERVER METHODS
Meteor.methods({
  // Adds a new player document to the database
  addPlayer(currentUser, workerId) {
    const data = {
      _id: currentUser,
      workerId,
      enterTime: new Date(),
      status: 'instructions',
      passedQuiz: false,
      quizAttempts: 0,
      needRematch: false,
    };
    Players.insert(data);
  },
  // Updates the Assignments db with a boolean about whether user passed the comprehension quiz. If so emits an event (which is tied to the current users's batch) that tells the assigner to try and match lobby users, otherwise shows them the exit survey
  checkPlayerEligibility(currentUser, passedQuiz) {
    const asst = TurkServer.Assignment.getCurrentUserAssignment(currentUser);
    const { workerId, batchId } = asst;
    const batch = TurkServer.Batch.getBatch(batchId);
    // LobbyStatus.update(currentUser,{$set:{'passedQuiz':passedQuiz}});
    if (passedQuiz) {
      Meteor.call('updatePlayerInfo', currentUser, { status: 'waiting' }, 'set');
      const userLobbyBomb = Meteor.setTimeout(() => {
        Meteor.call('lobbyTimeBomb', currentUser);
      }, lobbyTimeout * 60 * 1000);
      batch.assigner.lobbyTimers[currentUser] = userLobbyBomb;
      const emitter = batch.lobby.events;
      console.log(`TURKER: ${Date()}: ${workerId} passed Quiz! Told Assigner and set them up the bomb!\n`);
      emitter.emit('match-players');
    } else {
      Meteor.call('updatePlayerInfo', currentUser, { status: 'failedQuiz' }, 'set');
      asst.showExitSurvey();
      console.log(`TURKER: ${Date()}: ${workerId} failedQuiz! Sent to exit survey!\n`);
    }
  },
  // Remove a player document from the database
  removePlayer(currentUser) {
    return Players.remove(currentUser);
  },
  // General purpose document modification function
  updatePlayerInfo(currentUser, data, operation) {
    if (operation === 'set') {
      Players.update(currentUser, { $set: data });
    } else if (operation === 'inc') {
      Players.update(currentUser, { $inc: data });
    } else if (operation === 'dec') {
      Players.update(currentUser, { $dec: data });
    }
  },
  // Lobby timer so players don't wait too long to get match
  lobbyTimeBomb(currentUser) {
    asst = TurkServer.Assignment.getCurrentUserAssignment(currentUser);
    const { workerId } = asst;
    Meteor.call('updatePlayerInfo', currentUser, { status: 'lobbyTimeout' }, 'set');
    LobbyStatus.remove(currentUser);
    asst.showExitSurvey();
    console.log(`TURKER: ${Date()}: ${workerId} went boom! Sent to exit survey!\n`);
    const connectedUsers = LobbyStatus.find().fetch();
    const lobbyUsers = [];
    _.each(connectedUsers, (usr) => {
      if (Players.findOne(usr._id).passedQuiz) {
        lobbyUsers.push(usr);
      }
    });
    console.log(`ASSIGNER: There are now only ${lobbyUsers.length}/${groupSize} players!\n`);
  },
  checkAdminPassword(password) {
    const admin = Admin.findOne();
    if (password === admin.password) {
      Admin.update({ username: 'cosanlab' }, { $set: { loggedIn: true } });
      return true;
    } else {
      return false;
    }
  },
  logoutAdmin() {
    Admin.update({ username: 'cosanlab' }, { $set: { loggedIn: false } });
  }
});
