// Computes the earning per player, per round by computing the pot and bonus for each round for each player
// Return sum of an array (helper function)
function sum(a) {
  return a.reduce((a, b) => a + b, 0);
}
function reverseString(str) {
  return str.split("").reverse().join("");
}

// Sum up each player's UG earnings for a given round
function calcUGTotals(game, round) {
  // For each decider multiply their offer by whether it was accepted or not
  let deciderData = _.flatten(game.roundDataDecider[round]);
  const receiverData = _.flatten(game.roundDataReceiver[round]);

  // Reverse receiver data keys; they'll now match decider keys
  let rev_receiverData = _.map(receiverData, (elem) => {
    const reversedKey = reverseString(Object.keys(elem)[0]);
    const val = Object.values(elem)[0];
    const data = {};
    data[reversedKey] = val;
    return data;
  });
  // Sort both sets of keys
  rev_receiverData = _.sortBy(rev_receiverData, (elem) => Object.keys(elem)[0]);
  deciderData = _.sortBy(deciderData, (elem) => Object.keys(elem)[0]);

  // Compute earnings by looping over them both
  const totals = {
    A: 0, B: 0, C: 0, D: 0
  };
  for (let i = 0; i < deciderData.length; i += 1) {
    const key = Object.keys(deciderData[i])[0];
    const val = Object.values(deciderData[i])[0];
    const accept = Object.values(rev_receiverData[i])[0];
    if (accept) {
      totals[key[1]] += val;
      totals[key[0]] += 10 - val;
    }
    // else no one get's any money
  }
  return totals;
}

function calcGameSummary(game, currentUser) {
  const PGGTotals = _.reduce(game.allocatorDecisions, (result, v, key) => {
    result[key] = sum(v);
    return result;
  }, {});
  // Sum up all UG outcomes based on calcUGTotals function above, iterated over rounds
  let currentRoundTotal;
  const UGTotals = {
    A: 0, B: 0, C: 0, D: 0
  };
  const keys = Object.keys(UGTotals);
  for (let i = 0; i < game.round; i += 1) {
    currentRoundTotal = calcUGTotals(game, i);
    for (let j = 0; j < keys.length; j += 1) {
      UGTotals[keys[j]] += currentRoundTotal[keys[j]];
    }
  }
  // Make UG return object match PGG object using meteor userids
  let tempName;
  const UGout = {};
  _.each(game.players, (p, pid) => {
    tempName = p.name;
    UGout[pid] = UGTotals[tempName];
  });


  const playerTotals = [];
  let data = {};
  for (const p in game.players) {
    data.id = p;
    data.name = game.players[p].name;
    data.icon = game.players[p].icon;
    data.pggtotal = PGGTotals[data.id];
    data.ugtotal = UGout[data.id];
    //data.total = PGGTotals[data.id] + UGTotals[data.name];
    data.isplayer = p === currentUser;
    playerTotals.push(data);
    data = {};
  }
  return _.sortByOrder(playerTotals, 'pggtotal', 'desc');
}

function calcGameSummary2(game, currentUser) {
  const PGGTotals = _.reduce(game.allocatorDecisions, (result, v, key) => {
    result[key] = sum(v);
    return result;
  }, {});

  const playerTotals = [];
  let data = {};
  for (const p in game.players) {
    data.id = p;
    data.name = game.players[p].name;
    data.icon = game.players[p].icon;
    data.pggtotal = PGGTotals[data.id];
    data.ugtotal = sum(game.players[p].UGBonusTotal);
    // data.total = PGGTotals[data.id] + UGTotals[data.name];
    data.isplayer = p === currentUser;
    playerTotals.push(data);
    data = {};
  }
  return _.sortByOrder(playerTotals, 'pggtotal', 'desc');
}

// Get element totals for a specific game round
function getElementTotals(players, round) {
  const out = {};
  // Loop over players
  for (const p in players) {
    if (!out.hasOwnProperty(p)) {
      out[p] = 0;
    };
  }
  for (const p in players) {
    const { UGDecisions } = players[p];
    // Loop over each player's allocations
    for (const u in UGDecisions) {
      out[u] += UGDecisions[u][round - 1];
    }
  }
  return out;
}

function getElementReceived(players, round) {


  const out = {};
  const tempOut = {};
  const UGDecisions = {};
  // Loop over players
  for (const p in players) {
    if (!out.hasOwnProperty(p)) {
      out[p] = 0;
    };
    if (!tempOut.hasOwnProperty(p)) {
      tempOut[p] = 0;
    };
    UGDecisions[p] = players[p].UGDecisions;
  }
  for (const i in tempOut) {
    for (const u in tempOut) {
      tempOut[u] = UGDecisions[u][i][round - 1];
    }
    out[i] = Object.assign({}, tempOut);
  }
  return out;
}

function calcBonus(test) {
  function getMin(arr) {
    let min = 100;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] == 0 || arr[i] < 0) {
        continue;
      };
      if (min > arr[i]) {
        min = arr[i];
      };
    };
    return min;
  }
  function countNotEmpty(arr) {
    let empty = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === '') {
        empty++;
      };
    };
    return 4 - empty;
  }
  const out = {};
  for (let i = 4; i > 0; i--) {
    out['bonus' + i] = ['', '', '', ''];
  }
  for (const i in out) {
    const min = getMin(test);
    if (min == 100) break;
    test.forEach((item, index, arr) => { arr[index] = item - min });
    const bonus = test.map(x => { if (x < 0) return ''; else return min });
    const notEmpty = countNotEmpty(bonus);
    for (const p in out) {
      if (p == 'bonus' + notEmpty) {
        out[p] = bonus;
      }
    };
  };
  return out;
}

function SumDataforEach(test) {
  let sum = 0;
  const arr = test.map(x => { if (x === '') return 0; else return x });
  arr.forEach(function (element) {
    sum += element;
  });
  return sum;
}

function calcBonusResult(bonus) {
  const result = [];
  for (const i in bonus) {
    let sum = SumDataforEach(bonus[i]);
    result.push(sum);
    sum = 0;
  }
  for (let i = 0; i < 4; i++) {
    result[i] = result[i] * (4 - i);
  };
  return result;
};

Template.game.helpers({
  game() {
    const game = Games.findOne();
    const currentUser = Meteor.userId();
    const { element } = game.players[currentUser];
    let messagePrompt;
    let messageSubPromptDisplay = "";
    let messageSubPrompt = "Placeholder text";
    const messageSubPrompt2 = "Placeholder text";
    let round;
    let pot;
    let roundEarnings;

    //CHANGED: new a case called "UGSelfOutcome"
    switch (game.state) {
      case 'pChoose':
        messagePrompt = 'How many bags of rice do you want to contribute to public co-op?';
        messageSubPromptDisplay = 'visibility:hidden';
        break;
      case 'pDisp':
        messagePrompt = 'Other farmers contributed:';
        messageSubPromptDisplay = 'visibility:hidden';
        break;
      case 'aChoose':
        const { allocator } = game;
        if (Meteor.userId() === allocator) {
          messagePrompt = "How do you want to distribute the co-op's rice?";
        } else {
          messagePrompt = 'The head farmer is deciding...';
        }
        messageSubPromptDisplay = 'visibility:hidden';
        break;
      case 'aDisp':
        messagePrompt = "Decision from the head farmer";
        messageSubPrompt = '(Your earnings are highlighted)';
        break;
      case 'UGDecider':
        messagePrompt = `How do you want to divide your ${element} with each other farmer? `;
        messageSubPromptDisplay = 'visibility:hidden';
        break;
      case 'UGSelfOutcome':
        messagePrompt = 'Your trading outcomes: ';
        messageSubPromptDisplay = 'visibility:hidden';
        break;
      case 'UGOutcome':
        messagePrompt = 'Trading outcomes of all players: ';
        messageSubPrompt = '(Your earnings are highlighted)';
        break;

      case 'roundOutcome':
        messagePrompt = 'Trading outcomes of this round: ';
        messageSubPrompt = '(Your earnings are highlighted)';
        break;

      case 'playerRatngs':
        break;

      case 'gOut': // NOT SURE IF WE NEED THIS
        round = game.round - 2; // Because the counter has been updated already
        pot = _.reduce(_.map(_.pluck(game.players, 'contributions'), (list) => list[round]), (a, b) => a + b);
        roundEarnings = Math.round((pot * pggMultiplier) / groupSize);
        messagePrompt = `Group account divided for all ${String(groupSize)} players this round: ${String(roundEarnings)} points each`;
        messageSubPrompt = '(Your earnings are highlighted)';
        break;

      case 'finalOut':
        messagePrompt = 'Total Ranked Game Earnings';
        messageSubPrompt = '(Your earnings are highlighted)';
        break;
      // no default
    }

    return {
      messagePrompt,
      messageSubPrompt,
      messageSubPrompt2,
      messageSubPromptDisplay,
      condition: game.condition,
      state: game.state,
      round: game.round,
    };
  }
});

// Player Contribution Template
Template.playerContribution.helpers({
  limit() {
    return "50";
  },
  allocation() {
    const game = Games.findOne();
    const currentUser = Meteor.userId();
    const players = [];
    const round = game.round - 1;
    const elementReceived = getElementReceived(game.players, round);
    const isFirstRound = round == '0';
    const self = {};
    let data = {};
    for (const p in game.players) {
      if (p === currentUser) {
        self.id = p;
        self.name = game.players[p].name;
        self.icon = game.players[p].icon;
        self.lastRoundReceived = Object.values(elementReceived[p]);
      };

      data.id = p;
      data.name = game.players[p].name;
      data.icon = game.players[p].icon;
      players.push(data);
      data = {};
    }
    console.log(self)

    return {
      players,
      self,
      isFirstRound
    };
  }


});

Template.playerContribution.events({
  'click #contributionSubmit'(event) {
    event.preventDefault();
    $('#contributionSubmit').text("Waiting for other players... ").removeClass('btn-primary').addClass('btn-warning')
      .prop('disabled', true);
    $('#contributionSlider').prop('disabled', true);
    const contribution = parseInt($('#contributionSlider').val(), 10);
    const game = Games.findOne();
    const currentUser = Meteor.userId();
    const nextState = 'pDisp';
    const delay = 8000;
    const autoStates = ['aChoose'];
    Meteor.call('addPlayerRoundData', game._id, currentUser, ['contributions', contribution, nextState, autoStates], delay);
  }
});

// Other's contributions Display Template
Template.playerDisplay.helpers({
  contributions() {
    const currentUser = Meteor.userId();
    const game = Games.findOne();
    const round = game.round - 1;
    const contributions = [];
    let data = {};
    // Should work across all conditions
    const { neighbors } = game.players[currentUser];
    for (let n = 0, nLen = neighbors.length; n < nLen; n += 1) {
      data.icon = game.players[neighbors[n]].icon;
      data.amount = game.players[neighbors[n]].contributions[round];
      contributions.push(data);
      data = {};
    }
    return contributions;
  }

});

// Allocator choose
Template.allocatorChoose.helpers({
  allocation() {
    const game = Games.findOne();
    const players = [];
    const round = game.round - 1;
    const currentUser = Meteor.userId();
    const elementReceived = getElementReceived(game.players, round);

    let data = {};
    for (const p in game.players) {
      data.id = p;
      data.name = game.players[p].name;
      data.icon = game.players[p].icon;
      data.isplayer = p === currentUser;
      players.push(data);
      data = {};
    }

    const { allocator } = game;
    const isAllocator = Meteor.userId() === allocator;
    const lastRoundReceived = Object.values(elementReceived[allocator]);
    const pot = Math.round(_.reduce(_.map(_.pluck(game.players, 'contributions'), (list) => list[round]), (a, b) => a + b) * pggMultiplier);
    const allocatorIcon = game.players[allocator].icon;
    const isFirstRound = round == '0';

    return {
      players,
      isAllocator,
      lastRoundReceived,
      pot,
      allocatorIcon,
      isFirstRound
    };
  }
});

Template.allocatorChoose.events({
  'click #contributionSubmit'(event) {
    event.preventDefault();

    const game = Games.findOne();
    const round = game.round - 1;
    const pot = Math.round(_.reduce(_.map(_.pluck(game.players, 'contributions'), (list) => list[round]), (a, b) => a + b) * pggMultiplier);
    const potTotal = parseInt($('#total').text(), 10);

    if (potTotal === pot) {
      const allocations = {};
      let name;
      let insertId; // Update the name here for easier database insertion because documents are nested
      _.each(game.players, (player, id) => {
        name = player.name;
        insertId = `allocatorDecisions.${id}`;
        allocations[insertId] = parseInt($(`#${name}`).val(), 10);
      });
      const currentUser = Meteor.userId();
      const nextState = 'aDisp';
      const delay = 10000;
      const autoStates = ['UGDecider'];
      Meteor.call('addPlayerRoundData', game._id, currentUser, ['allocatorDecisions', allocations, nextState, autoStates], delay);
    } else if (potTotal !== pot) {
      $('#allocatorWarning').css('visibility', 'visible');
    }
  }

});

//CHANGED: Added this onRendered function. When allocatorChoose template gets show it adds a <script> tag to the bottom of the HTML that contains the code for preventing the slider from moving beyond its limit.
Template.allocatorChoose.onRendered(() => {
  let script = document.createElement("script");
  script.type = "text/javascript";
  script.id = 'slider-restrict-limit';
  let code = `[].slice.call(document.getElementsByTagName('input')).forEach((input) => {
    input.addEventListener('input', (e) => {
      e.preventDefault();
      let maxTotal = parseInt($('h4').text().split('/')[1]);
      let inputs = [].slice.call(document.getElementsByTagName('input'));
      let getTotal = () => {
        let sum = 0;
        inputs.forEach((input) => {
          sum += parseInt(input.value, 10);
        });
        return sum;
      }
      let sum = getTotal()
      if (sum > maxTotal) {
        target = e.target;
        target.value = target.value - (sum - maxTotal);
        document.getElementById('total').innerHTML = getTotal();
        return false;
      }
      document.getElementById('total').innerHTML = getTotal();
      return true;
    });
  });`;
  try {
    script.appendChild(document.createTextNode(code));
    document.body.appendChild(script);
  } catch (error) {
    script.text = code;
    document.body.appendChild(script);
  }
});

//CHANGED: This removes the script tag added in onRendered
Template.allocatorChoose.onDestroyed(() => {
  let limitscript = document.getElementById('slider-restrict-limit');
  limitscript.remove();
});
// Allocator's decisions Display Template
Template.allocatorDisplay.helpers({
  allocations() {
    const game = Games.findOne();
    const round = game.round - 1;
    const currentUser = Meteor.userId();
    let data = {};
    const totals = [];
    // First add User's data
    data.icon = game.players[currentUser].icon;
    data.amount = game.allocatorDecisions[currentUser][round];
    data.isplayer = true;
    totals.push(data);
    data = {};
    // Then add other players
    const otherPlayers = _.difference(Object.keys(game.players), [currentUser]);
    _.each(otherPlayers, (player) => {
      data.icon = game.players[player].icon;
      data.amount = game.allocatorDecisions[player][round];
      data.isplayer = false;
      totals.push(data);
      data = {};
    });
    return totals;
  }
});

// UG Decider Template
Template.UGDecider.helpers({
  data() {
    const game = Games.findOne();
    const round = game.round - 1;
    const players = [];
    const allPlayers = [];
    const currentUser = Meteor.userId();
    let data = {};
    const self = {};
    for (const p in game.players) {

      data.icon = game.players[p].icon;
      data.pggResult = game.allocatorDecisions[p][round];
      data.pggContributions = game.players[p].contributions[round];
      allPlayers.push(data);
      data = {};

      if (p !== currentUser) {
        data.id = p;
        data.name = game.players[p].name;
        data.icon = game.players[p].icon;
        data.isplayer = p === currentUser;
        players.push(data);
        data = {};
      } else {
        self.id = p;
        self.name = game.players[p].name;
        self.icon = game.players[p].icon;
      }
    }
    return {
      players,
      self,
      ugPot,
      allPlayers
    };
  }
});

Template.UGDecider.events({
  'click #contributionSubmit'(event) {
    event.preventDefault();
    const totalAllocated = parseInt($('#total').text(), 10);
    if (totalAllocated === ugPot) {
      $('#contributionSubmit').text("Waiting for other players... ").removeClass('btn-primary').addClass('btn-warning')
        .prop('disabled', true);
      const game = Games.findOne();
      const currentUser = Meteor.userId();
      let insertId;
      const allocations = {};
      for (const p in game.players) {
        insertId = `players.${currentUser}.UGDecisions.${p}`;
        allocations[insertId] = parseInt($(`#${p}`).val(), 10);
        $(`#${p}`).prop('disabled', true);
      }
      const nextState = 'UGSelfOutcome';
      const delay = 0;
      let autoStates = [];
      // if (game.round + 1 > numRounds) {
      //   autoStates = ['playerRatings'];
      // } else {
      //   // NOTE: Lulu UGOutcome is not appearing because you need to add it to the list of autoStates like below
      //   autoStates = ['UGOutcome', 'pChoose'];
      // }
      Meteor.call('addPlayerRoundData', game._id, currentUser, ['UGDecisions', allocations, nextState, autoStates], delay);
    } else {
      $('#allocatorWarning').css('visibility', 'visible');
    }
  }
});

//CHANGED: Added this onRendered function. When UGDecider template gets show it adds a <script> tag to the bottom of the HTML that contains the code for preventing the slider from moving beyond its limit.
Template.UGDecider.onRendered(() => {
  let script = document.createElement("script");
  script.type = "text/javascript";
  script.id = 'slider-restrict-limit';
  let code = `[].slice.call(document.getElementsByTagName('input')).forEach((input) => {
      input.addEventListener('input', (e) => {
        e.preventDefault();
        let maxTotal = parseInt($('h4').text().split('/')[1]);
        let inputs = [].slice.call(document.getElementsByTagName('input'));
        let getTotal = () => {
          let sum = 0;
          inputs.forEach((input) => {
            sum += parseInt(input.value, 10);
          });
          return sum;
        }
        let sum = getTotal()
        if (sum > maxTotal) {
          target = e.target;
          target.value = target.value - (sum - maxTotal);
          document.getElementById('total').innerHTML = getTotal();
          return false;
        }
        document.getElementById('total').innerHTML = getTotal();
        return true;
      });
    });`;
  try {
    script.appendChild(document.createTextNode(code));
    document.body.appendChild(script);
  } catch (error) {
    script.text = code;
    document.body.appendChild(script);
  }
});

//CHANGED: This removes the script tag added in onRendered
Template.UGDecider.onDestroyed(() => {
  let limitscript = document.getElementById('slider-restrict-limit');
  limitscript.remove();
});
//CHANGED: Just copied from UGOutcome, haven't changed anything

Template.UGSelfOutcome.inheritsHelpersFrom('game');

Template.UGSelfOutcome.helpers({
  data() {
    const game = Games.findOne();
    const currentUser = Meteor.userId();
    const self = {};
    let data = {};
    const players = [];
    // Call function that computes total reception of a single element per player
    const elementReceived = getElementReceived(game.players, game.round);
    for (const p in game.players) {
      if (p === currentUser) {
        self.id = p;
        self.name = game.players[p].name;
        self.icon = game.players[p].icon;
        self.received = Object.values(elementReceived[p]);
        self.bonus = calcBonus(Object.values(elementReceived[p]));
        self.result = calcBonusResult(self.bonus);
        self.resultmulti4 = self.result[0];
        self.resultmulti3 = self.result[1];
        self.resultmulti2 = self.result[2];
        self.resultmulti1 = self.result[3];
        self.total = SumDataforEach(self.result);
      };
      data.id = p;
      data.name = game.players[p].name;
      data.icon = game.players[p].icon;
      //data.total = elementTotals[p];
      players.push(data);
      data = {};
    }
    return {
      players,
      self
    };
  }
});

Template.UGSelfOutcome.events({
  'click #showBonus'(event) {
    $('#showBonus').text("Waiting for other players... ").removeClass('btn-primary').addClass('btn-warning')
      .prop('disabled', true);
    event.preventDefault();
    const bonusTotal = parseInt($('#total').text(), 10);
    const game = Games.findOne();
    const currentUser = Meteor.userId();
    const nextState = 'UGOutcome';
    const delay = 10000;
    let autoStates = [];
    if (game.round + 1 > numRounds) {
      autoStates = ['roundOutcome', 'playerRatings'];
    } else {
      // NOTE: Lulu UGOutcome is not appearing because you need to add it to the list of autoStates like below
      autoStates = ['roundOutcome', 'pChoose'];
    }
    Meteor.call('addPlayerRoundData', game._id, currentUser, ['UGBonusTotal', bonusTotal, nextState, autoStates], delay);
  }
});

// UG Outcome Template
Template.UGOutcome.inheritsHelpersFrom('game');

// TODO: Pass data to 4 quadrant display template
// Started but didn't finish
Template.UGOutcome.helpers({
  data() {
    const game = Games.findOne();
    const currentUser = Meteor.userId();
    let data = {};
    const players = [];
    let iconarray = [];

    const elementReceived = getElementReceived(game.players, game.round);
    for (const p in game.players) {
      if (p === currentUser) {
        data.isSelf = true;
      }
      data.id = p;
      data.name = game.players[p].name;
      data.icon = game.players[p].icon;
      iconarray.push(data.icon);
      data.received = Object.values(elementReceived[p]);
      data.bonus = calcBonus(Object.values(elementReceived[p]));

      data.result = calcBonusResult(data.bonus);
      data.resultmulti4 = data.result[0];
      data.resultmulti3 = data.result[1];
      data.resultmulti2 = data.result[2];
      data.resultmulti1 = data.result[3];
      data.total = SumDataforEach(data.result);
      players.push(data);
      data = {};
    }
    //console.log(JSON.stringify(players));

    return {
      players,
      iconarray
    };
  }
});

Template.roundOutcome.inheritsHelpersFrom('game');

Template.roundOutcome.helpers({
  totals() {
    const currentUser = Meteor.userId();
    const game = Games.findOne();
    const round = game.round - 2;
    let data = {};
    const players = [];

    for (const p in game.players) {
      data.id = p;
      data.name = game.players[p].name;
      data.icon = game.players[p].icon;
      data.isSelf = p === currentUser;
      data.pggtotal = game.allocatorDecisions[p][round];
      data.ugtotal = game.players[p].UGBonusTotal[round];
      players.push(data);
      data = {};
    }
    //console.log(JSON.stringify(players));
    return players;
  }
});

// TODO: Compute bonuses for UG Full outcome display
// We'll probably need a general purpose function so we can compute bonuses on both the client (during display) and server (during bonus calculations and game summary)
Template.UGFullOutcome.helpers({
});

// Player ratings template
// Questions helper logic:
// Return the idx of the first non-answered question in the database
Template.playerRatings.inheritsHelpersFrom('game');
Template.playerRatings.helpers({
  limit() {
    return "50";
  },
  survey() {
    let stillAnswering = true;
    const currentUser = Meteor.userId();
    const game = Games.findOne();
    const currentRatings = game.players[currentUser].playerRatings;
    const idx = currentRatings.length;
    if (idx === numPlayerQuestions) {
      stillAnswering = false;
    }

    // Make list of questions and get current unanswered question
    const questions = [
      {
        question: 'How much do you want to play with each player again?',
        sliders: 'Rate using the sliders below:',
        anchors: 'Left = "Never"    Right = "Definitely"'
      },
      {
        question: 'How fair do you think each player was?',
        sliders: 'Rate using the sliders below:',
        anchors: 'Left = "Not fair at all"    Right = "Very fair"'
      },
      {
        question: 'How selfish do you think each player was?',
        sliders: 'Rate using the sliders below:',
        anchors: 'Left = "Not at all"    Right = "Very selfish"'
      },
      {
        question: 'Relative to yourself, how influential do you think each player was?',
        sliders: 'Rate using the sliders below:',
        anchors: 'Left = "Not at all"    Right = "Completely"'
      },
      {
        question: '',
        sliders: '',
        anchors: ''
      }
    ];
    const currentQuestion = questions[idx];
    currentQuestion.idx = idx;

    // Get list of players
    const otherPlayers = _.omit(game.players, currentUser);
    const others = [];
    let data = {};
    for (const p in otherPlayers) {
      data.icon = otherPlayers[p].icon;
      data.user = p;
      others.push(data);
      data = {};
    }

    // Return everything
    return {
      stillAnswering,
      players: others,
      question: currentQuestion,
    };
  }
});

// Trigger event that sets the current question index to answered
Template.playerRatings.events({
  'submit .ratings'(event) {
    event.stopPropagation();
    event.preventDefault();
    const form = event.target;
    const questionId = parseInt($('.well')[0].id, 10);
    const currentUser = Meteor.userId();
    const game = Games.findOne();
    const otherPlayers = _.omit(game.players, currentUser);
    const ratings = {};
    for (const p in otherPlayers) {
      ratings[p] = form[p].value;
    }
    const nextState = 'finalOut';
    const autoStates = ['ended'];
    const delay = 10000;
    Meteor.call('addPlayerStaticData', game._id, currentUser, ['playerRatings', questionId, ratings, nextState, autoStates], delay);
    // Reset slider positions
    $('input').each(function () { this.value = 50; });
  }

});

// Final outcomes template
Template.finalOutcomes.inheritsHelpersFrom('game');
Template.finalOutcomes.helpers({
  totals() {
    const currentUser = Meteor.userId();
    const game = Games.findOne();
    return calcGameSummary2(game, currentUser);
    //return calcGameSummary(game, currentUser);
  }
});
