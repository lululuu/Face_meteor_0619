// HELPER FUNCTIONS
// Function to make a variable-based dot-notation query for updating a nested mongo document
function makePQuery(currentUser, field, value) {
  const pKey = {};
  pKey[`players.${currentUser}.${field}`] = value;
  return pKey;
}

// Select and return a random round number and string name or undefined if the game ended too early;
function getGameRoundOrPayEarly(game) {
  let bonus;
  let roundNum;
  let roundName;
  const playerIds = _.keys(game.players);
  const tooEarly = _.any(_.pluck(game.players, 'contributions', _.isEmpty));

  if (game.round === 1 && tooEarly) {
    // If the game never started or ended too early
    bonus = disconnectPay;
    _.each(playerIds, (player) => {
      if (Players.findOne(player).status !== 'leftGame') {
        const asst = TurkServer.Assignment.getCurrentUserAssignment(player);
        asst.addPayment(bonus);
        Meteor.call('updatePlayerInfo', player, { bonus }, 'set');
      }
    });
    return;
  } else if (game.round > numRounds) {
    // If the game ended properly
    roundNum = _.random(1, game.round - 2);
    roundName = String(roundNum + 1);
  } else if (game.round >= 1 || game.round <= numRounds) {
    // If game ended early, but not too early, give everyone who didn't leave a random round bonus
    roundNum = _.random(0, game.round - 1);
    roundName = String(roundNum + 1);
  }
  return [roundNum, roundName];
}

// Return an object with player id's as keys and a single value for the selected pgg round
function getPGGSingleRound(game, roundNum) {
  const out = {};
  const decisions = game.allocatorDecisions;
  for (const key in decisions) {
    out[key] = decisions[key][roundNum];
  }
  return out;
}

// TODO: Update based on new game data structure
// Return an object with player id's as keys and a single value for the sum of accepted offers for a ug round
function getUGSingleRound(game, roundName) {
  // Flatten array of arrays to a single Object with keys as player pairs (DeciderReceiver for roundDecider and ReceiverDecider for roundReceiver), and offers or accept/reject decisions as values (0-10 for roundDecider and 0 or 1 for roundReceiver)
  // eslint-disable-next-line prefer-spread
  const roundDecider = _.assign.apply(_, _.flatten(game.roundDataDecider[roundName]));
  // eslint-disable-next-line prefer-spread
  const roundReceiver = _.assign.apply(_, _.flatten(game.roundDataReceiver[roundName]));

  // Initialize Object to store player rewards by letter, i.e. {A: 0, B: 0....}
  const playerRewards = {};
  _.each(_.keys(game.players), (playerId) => {
    playerRewards[game.players[playerId].name] = 0;
  });
  // For each player letter in the empty Object created above, loop over each roundReceiver object and see if the player was the receipient and if they accepted the offer. If so, go to the roundDecider object and get the offer value for both this player and (10 - offer for the other player in the pair) and add it to their respective totals
  for (const playerLetter in playerRewards) {
    for (const receiverKey in roundReceiver) {
      if (receiverKey[0] === playerLetter && roundReceiver[receiverKey] === 1) {
        const decider = receiverKey[1];
        const deciderPair = String(decider) + String(receiverKey[0]);
        playerRewards[playerLetter] += roundDecider[deciderPair];
        playerRewards[decider] += (10 - roundDecider[deciderPair]);
      }
    }
  }
  // Convert the keys of the object above to user ids. This is a bit janky because UG data is stored according to player letters not user ids
  const out = {};
  for (const key in playerRewards) {
    _.each(_.keys(game.players), (playerName) => {
      if (game.players[playerName].name === key) {
        out[playerName] = playerRewards[key];
      }
    });
  }
  return out;
}

// TODO: Update based on new game data structure
// Calculate and save the total PGG + UG bonuse for each player taking as input two objects with keys as playerIds and values as the outcome of a chosen PGG round and the sum of outcomes for UG on that same round. If a player didn't leave the game, grant them a bonus through turkserver
function calcAndGiveBonuses(pggObj, ugObj) {
  const playerBonuses = {};
  let bonus;
  for (const playerId in pggObj) {
    bonus = (pggObj[playerId] + ugObj[playerId]) * bonusPaymentConversion / 100;
    playerBonuses[playerId] = bonus;
    if (Players.findOne(playerId).status !== 'leftGame') {
      const asst = TurkServer.Assignment.getCurrentUserAssignment(playerId);
      asst.addPayment(bonus);
      Meteor.call('updatePlayerInfo', playerId, { bonus }, 'set');
    }
  }
}

// SERVER METHODS
Meteor.methods({
  // Adds a new game document to the database
  createGame(gameId, playerIds) {
    const random_order = _.shuffle([...Array(avatars.length).keys()]);
    // Store contributions
    const playersData = {};

    // Generate random UG pairs
    const pairData = {};
    for (k = 1; k < numRounds + 1; k += 1) {
      pairData[k] = _.map(_.shuffle(PAIRS),
        (elem) => Object.keys(elem)[0]);
    }

    // Determine random allocator
    const allocator = _.sample(playerIds);
    const allocatorDecisions = {}; // Might need to switch to list of dicts
    playerIds.forEach((elem) => {
      allocatorDecisions[elem] = [];
    });

    // Setup players PGG data
    let neighbors;
    let role;
    for (let i = 0, plen = playerIds.length; i < plen; i += 1) {
      if (playerIds[i] === allocator) {
        role = 'allocator';
      } else {
        role = 'player';
      }
      playersData[String(playerIds[i])] = {
        name: letters[i],
        icon: avatars[random_order[i]],
        element: elements[random_order[i]],
        readyStatus: false,
        contributions: [],
        UGBonusTotal: [],
        role,
        playerRatings: []
      };
      neighbors = _.difference(playerIds, [playerIds[i]]);
      playersData[playerIds[i]].neighbors = neighbors;
      const UGContainer = {};
      for (const n of playerIds) {
        UGContainer[n] = [];
      }
      playersData[playerIds[i]].UGDecisions = UGContainer;
    }
    const data = {
      _id: gameId,
      state: "assignment",
      round: 1,
      allocator,
      allocatorDecisions,
      players: playersData,
      pairs: pairData
    };
    Partitioner.bindGroup(gameId, () => {
      Games.insert(data);
    });
  },
  // General purpose document modication function, can handle upto 2 simultaneous db operations; extend is a specially reserved operation for handling array extension of a field; it depends on multiName which is the field to do array extension to
  updateGameInfo(gameId, data, operation) {
    let query1;
    let query2;
    if (data.constructor.toString().indexOf("Array") > -1) {
      [query1, query2] = data;
    }
    Partitioner.directOperation(() => {
      if (operation === 'set') {
        Games.update(gameId, { $set: data });
      } else if (operation === 'inc') {
        Games.update(gameId, { $inc: data });
      } else if (operation === 'dec') {
        Games.update(gameId, { $dec: data });
      } else if (operation === 'push') {
        Games.update(gameId, { $push: data });
      } else if (operation === 'extend') {
        Games.update(gameId, { $push: { multiName: { $each: data } } });
      } else if (operation === 'setinc') {
        Games.update(gameId, { $set: query1, $inc: query2 });
      }
      console.log(`DATA: updated with operation ${operation}`)
    });
  },
  // Tries to start a game if all players are ready
  startGame(gameId, currentUser) {
    console.log(`\nSERVER: startGame called by ${currentUser}. Updating their status to ready.`)
    const pKey = makePQuery(currentUser, 'readyStatus', true);
    Meteor.call('updateGameInfo', gameId, pKey, 'set');
    const game = Games.findOne(gameId);
    // some underscore magic to check if all players are ready
    console.log(`SERVER: Checking if all players have ready status`)
    if (_.every(_.pluck(game.players, 'readyStatus'), _.identity)) {
      console.log(`SERVER: Yes they do...starting game`)
      Meteor.call('updateGameInfo', game._id, { state: 'pChoose' }, 'set');
    } else {
      console.log(`SERVER: No they don't...not starting game`)
    }
  },

  // Adds a single client's data to the Game document and updates the game state if all players have inserted that data into the document by comparing how many insertions have been made relative to the current game round; Expects an array called data with: [dbFieldName,dbFieldVal,nextState,arrayOfAutoAdvanceStates,delayForAutoAdvancing]
  addPlayerRoundData(gameId, currentUser, data, delay) {
    console.log(`\nSERVER: addPlayerRoundData called by ${currentUser}`)
    console.log(`SERVER: Data to insert is { ${data[0]}:${data[1]} }. Next state is ${data[2]}. Auto-states are ${data[3]}`)
    let game = Games.findOne(gameId);
    let pKey;
    // If we're getting a single scalar value from a client
    if (data[1] === parseInt(data[1], 10)) {
      console.log(`SERVER: Checking if I already have ${data[0]} for ${currentUser} for round ${game.round}`)
      if (game.players[currentUser][data[0]].length < game.round) {
        pKey = makePQuery(currentUser, data[0], data[1]);
        console.log("SERVER: I don't...adding")
        Meteor.call('updateGameInfo', gameId, pKey, 'push');

        game = Games.findOne(gameId);
        console.log(`SERVER: Checking if all players have ${data[0]} for round ${game.round}`)
        if (_.every(_.pluck(game.players, data[0]),
          (elem) => elem.length === game.round)) {
            if (data[0] === 'UGDecisions') {
              
              Meteor.call('updateGameInfo', gameId, pKey, 'push');
    
            }
          console.log("SERVER: Yes they do...updating game state")
          if (delay > 0) {
            Meteor.call('autoAdvanceState', game._id, data[2], data[3], delay);
          } else {
            console.log(`SERVER: Regular-advance requested. Next state will be ${data[2]}`)
            Meteor.call('updateGameInfo', game._id, { state: data[2] }, 'set');
          }
        } else {
          console.log("SERVER: No they don't...not updating game state")
        }
      } else {
        console.log("SERVER: I do...not adding")
      }
    } else if (data[0] === 'allocatorDecisions') {
      console.log(`SERVER: Checking if I already have allocator decisions for round ${game.round}`)
      if (_.every(_.values(game.allocatorDecisions), (elem) => elem.length < game.round)) {
        // Now we're getting an object, probably the allocator's decisions
        // Check that the allocator's decisions haven't been recorded for this round yet
        console.log("SERVER: I don't...adding")
        Meteor.call('updateGameInfo', gameId, data[1], 'push');
        game = Games.findOne(gameId);
        console.log(`SERVER: Verifying if I should update game state because I have all allocator decisions for round ${game.round}`)
        if ((_.every(_.values(game.allocatorDecisions), (elem) => elem.length === game.round))) {
          console.log("SERVER: Yes I do...requesting update game state")
          if (delay > 0) {
            Meteor.call('autoAdvanceState', game._id, data[2], data[3], delay);
          } else {
            console.log(`SERVER: Regular-advance requested. Next state will be ${data[2]}`)
            Meteor.call('updateGameInfo', game._id, { state: data[2] }, 'set');
          }
        } else {
          console.log("SERVER: Verification failed...not updating game state")
        }
      } else {
        console.log("SERVER: I do...not adding")
      }
    } else if (data[0] === 'UGDecisions') {
      console.log(`SERVER: Checking if I already have ${data[0]} for ${currentUser} for round ${game.round}`)
      // We're getting UG data from a single player
      const playerUGData = game.players[currentUser].UGDecisions;
      // Check to see if we have already made an insertion for this game round for this player otherwise make an insertion
      if (_.every(_.values(playerUGData), (elem) => elem.length < game.round)) {
        // insert data
        console.log("SERVER: I don't...adding")
        Meteor.call('updateGameInfo', gameId, data[1], 'push');
        // Check if we have responses from all users after insertion
        game = Games.findOne(gameId);
        const allSubmitted = [];
        console.log(`SERVER: Checking if all players have ${data[0]} for round ${game.round}`)
        for (const p in game.players) {
          allSubmitted.push(_.every(_.values(game.players[p].UGDecisions), (elem) => elem.length === game.round));
        }
        if (_.every(allSubmitted)) {
          console.log("SERVER: Yes they do...requesting update game state")
          if (delay > 0) {
            Meteor.call('autoAdvanceState', game._id, data[2], data[3], delay);
          } else {
            console.log(`SERVER: Regular-advance requested. Next state will be ${data[2]}`)
            Meteor.call('updateGameInfo', game._id, { state: data[2] }, 'set');
          }
        } else {
          console.log("SERVER: Not they don't...not updating game state")
        }
      } else {
        console.log("SERVER: I do...not adding")
      }
    }
  },
  // Same as add player round data, but instead adds non-round based data, i.e. expects a single insertion to a single field across the entire game for each client. Compares against numPlayerQuestions global var to make sure have all responses from each player before advancing to the next game state
  addPlayerStaticData(gameId, currentUser, data, delay) {
    let game = Games.findOne(gameId);
    const field = data[0];
    const questionId = data[1];
    const questionData = data[2];
    const nextState = data[3];
    const autoStates = data[4];

    // Append to list if they haven't answered the question yet
    // by checking the length of the current question array
    if (game.players[currentUser][field].length === questionId) {
      pKey = makePQuery(currentUser, field, questionData);
      Meteor.call('updateGameInfo', gameId, pKey, 'push');
    }

    game = Games.findOne(gameId);
    if (_.every(_.pluck(game.players, 'playerRatings'), (elem) => elem.length === numPlayerQuestions)) {
      if (delay > 0) {
        Meteor.call('autoAdvanceState', game._id, nextState, autoStates, delay);
      } else {
        Meteor.call('updateGameInfo', game._id, { state: nextState }, 'set');
      }
    }
  },
  // TODO: Update to take into account UGFullOutcome game state
  // Most of the time, clients trigger game state changes based on events (button clicks), but occassionally the server should trigger a state change based on a timer. This function handles those automatic state changes by making delayed method calls based on an array of future states. Will also increment the round counter if it encounters the last possible game state (gOut) in the delayedStates array, or end the game if the it's the last round.
  autoAdvanceState(gameId, immediateState, delayedStates, delay) {
    console.log(`SERVER: Auto-advance requested. Next state will be ${immediateState}. Following states will be ${delayedStates}.`)

    if (immediateState === 'roundOutcome') {
      console.log(`SERVER: Because next state is ${immediateState}, I'm also incrementing the game round by 1.`)
      Meteor.call('updateGameInfo', gameId, [{ state: immediateState }, { round: 1 }], 'setinc');
    } else {
      console.log(`SERVER: Because next state is not roundOutcome, I'm not incrementing the game round.`)
      Meteor.call('updateGameInfo', gameId, { state: immediateState }, 'set');
    }
    let stateCounter = 0;
    // Loop over auto-advances states and set them iteratively after waiting delay
    const repeatCallID = Meteor.setInterval(() => {
      // If we encounter the ended game auto state, end the game, otherwise if we encounter the round outcome autostate, updated the round counter and switch to that state, otherwise switch the autostate
      if (Games.findOne(gameId).state === 'lostUser') {
        return Meteor.clearInterval(repeatCallID);
      } if (delayedStates[stateCounter] === 'ended') {
        Meteor.call('endGame', gameId, false);
        return Meteor.clearInterval(repeatCallID);
      }
      console.log(`SERVER: Auto-advancing to state ${delayedStates[stateCounter]}`)
      if (delayedStates[stateCounter] === 'roundOutcome') {
        console.log(`SERVER: Because state is ${delayedStates[stateCounter]}, I'm also incrementing the game round by 1.`)
        Meteor.call('updateGameInfo', gameId, [{ state: delayedStates[stateCounter] }, { round: 1 }], 'setinc');
      } else {
        console.log(`SERVER: Because next state is not roundOutcome, I'm not incrementing the game round.`)
        Meteor.call('updateGameInfo', gameId, { state: delayedStates[stateCounter] }, 'set');
      }
      stateCounter += 1;
      if (stateCounter > delayedStates.length - 1) {
        Meteor.clearInterval(repeatCallID);
      }
    }, delay);
  },
  // Function updates all player status according to how a game ended. Also changes the game state appropriately and calculates bonuses. Tears down experiment and initiates exit survey after. Take an optional whoEnded argument that should be provided if premature is true
  endGame(gameId, premature) {
    const exp = TurkServer.Instance.getInstance(gameId);
    const game = Games.findOne(gameId);
    let state;
    let log;
    if (!premature) {
      _.each(_.keys(game.players), (player) => {
        Meteor.call('updatePlayerInfo', player, { status: 'finished' }, 'set');
      });
      state = 'ended';
      log = `GAME: ${Date()}: ${gameId} successfully ended!\n`;
    } else {
      state = 'connectionError';
      log = `GAME: ${Date()}: ${gameId} went boom!\n`;
      // Clear any other bomb timers from others who might have disconnected. Change the player status differently depending on if player caused the game end (or left while waiting for reconnection), or if they were affected by it
      const { batchId } = Experiments.findOne(exp.groupId);
      const batch = TurkServer.Batch.getBatch(batchId);
      const leftPlayers = batch.assigner.disconnectTimers[gameId].players;
      const stayedPlayers = _.difference(_.keys(game.players), leftPlayers);
      _.each(leftPlayers,
        (player) => {
          Meteor.call('updatePlayerInfo', player, { status: 'leftGame' }, 'set');
        });
      _.each(stayedPlayers,
        (player) => {
          Meteor.call('updatePlayerInfo', player, { status: 'connectionLost' }, 'set');
        });
      // Remove the game from the assigner's timer list
      batch.assigner.disconnectTimers = _.omit(batch.assigner.disconnectTimers, gameId);
    }
    // Computes bonuses and pay people bonuses
    const out = getGameRoundOrPayEarly(game);
    if (out) {
      const roundNum = out[0];
      const roundName = out[1];
      const pggOut = getPGGSingleRound(game, roundNum);
      const ugOut = getUGSingleRound(game, roundName);
      calcAndGiveBonuses(pggOut, ugOut);
    }
    // Update ended game state
    Meteor.call('updateGameInfo', gameId, { state }, 'set');
    // Tear down turkserver
    if (exp != null) {
      exp.teardown(returnToLobby = true);
      console.log(log);
    } else {
      console.log(`GAME: ${Date()}: ${gameId} could not be ended! No instance exists!\n`);
    }
  },
  // Gets called reactively when a user in a game instance (i.e. has group id) disconnects from Meteor. Starts a game time bomb much like the lobby time bomb. Also stores previous game state
  connectionChange(currentUser, gameId, connection) {
    const asst = TurkServer.Assignment.getCurrentUserAssignment(currentUser);
    const batch = TurkServer.Batch.getBatch(asst.batchId);
    const game = Games.findOne(gameId);
    // Make a bomb
    if (connection === 'disconnect') {
      const prevState = game.state;
      if (prevState !== 'lostUser') {
        Meteor.call('updateGameInfo', gameId, { state: 'lostUser' }, 'set');
      }
      if (!_.has(batch.assigner.disconnectTimers, gameId)) {
        const disconnectBomb = Meteor.setTimeout(() => {
          Meteor.call('endGame', gameId, true);
        }, disconnectTimeout * 60 * 1000);
        batch.assigner.disconnectTimers[gameId] = { disconnectBomb, state: prevState, players: [] };
        batch.assigner.disconnectTimers[gameId].players.push(currentUser);
        console.log(`ASSIGNER: ${Date()} User ${asst.workerId} disconnected! Game ${gameId} state saved! Also set up the bomb!\n`);
        console.log(`ASSIGNER: Game was in state: ${prevState} round: ${game.round}`);
        // console.log('Game was in state: ' + prevState);
      } else if (_.has(batch.assigner.disconnectTimers, gameId)) {
        batch.assigner.disconnectTimers[gameId].players.push(currentUser);
        console.log(`ASSIGNER: ${Date()} User ${asst.workerId} disconnected! Game ${gameId} already has a bomb!\n`);
      }
    } else if (connection === 'reconnect') {
      // Remove the reconnected player
      batch.assigner.disconnectTimers[gameId].players = _.xor(batch.assigner.disconnectTimers[gameId].players, [currentUser]);
      // Defuse bomb and resume game if all players have reconnected
      if (batch.assigner.disconnectTimers[gameId].players.length === 0) {
        Meteor.clearTimeout(batch.assigner.disconnectTimers[gameId].disconnectBomb);
        const revertState = batch.assigner.disconnectTimers[gameId].state;
        switch (revertState) {
          case 'pDisp':
            if (game.condition === '2NG' || game.condition === '6NG') {
              if (game.round < numRounds) {
                Meteor.call('autoAdvanceState', gameId, revertState, ['gOut', 'pChoose'], 7000);
              } else {
                Meteor.call('autoAdvanceState', gameId, revertState, ['gOut', 'playerRatings'], 7000);
              }
            } else {
              Meteor.call('autoAdvanceState', gameId, revertState, ['pSendMess1'], 7000);
            }
            break;
          case 'pReceiveMess1':
            Meteor.call('autoAdvanceState', gameId, revertState, ['pSendMess2'], 7000);
            break;
          case 'pReceiveMess2':
            if (game.round < numRounds) {
              Meteor.call('autoAdvanceState', gameId, revertState, ['gOut', 'pChoose'], 7000);
            } else {
              Meteor.call('autoAdvanceState', gameId, revertState, ['gOut', 'playerRatings'], 7000);
            }
            break;
          case 'gOut':
            if (game.round <= numRounds) {
              Meteor.call('autoAdvanceState', gameId, revertState, ['pChoose'], 7000);
            } else {
              Meteor.call('autoAdvanceState', gameId, revertState, ['playerRatings'], 7000);
            }
            break;
          case 'finalOut':
            Meteor.call('autoAdvanceState', gameId, revertState, ['ended'], 10000);
            break;
          default:
            Meteor.call('updateGameInfo', gameId, { state: revertState }, 'set');
        }
        batch.assigner.disconnectTimers = _.omit(batch.assigner.disconnectTimers, gameId);
        console.log(`ASSIGNER: ${Date()} User ${asst.workerId} reconnected! Game ${gameId} bomb defused!\n`);
      } else {
        console.log(`ASSIGNER: ${Date()} User ${asst.workerId} reconnected! Game ${gameId} bomb NOT YET defused!\n`);
      }
    }
  }
});
