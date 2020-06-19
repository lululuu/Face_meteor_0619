// Display partner disconnect and bonus payment info
Template.endSurvey.helpers({
  status() {
    const { status } = Players.findOne(Meteor.userId());
    let failedQuiz = false;
    let failedMatch = false;
    let connectionError = false;
    let completed = false;
    let leftGame = false;
    let notEligible = false;
    switch (status) {
      case 'failedQuiz':
        failedQuiz = true;
        notEligible = true;
        break;
      case 'lobbyTimeout':
        failedMatch = true;
        break;
      case 'connectionLost':
        connectionError = true;
        break;
      case 'leftGame':
        leftGame = true;
        notEligible = true;
        break;
      case 'finished':
        completed = true;
        break;
      // no default
    }
    return {
      failedQuiz,
      failedMatch,
      connectionError,
      completed,
      leftGame,
      notEligible
    };
  },
  ineligibilityPay() {
    return ineligibilityPay;
  },
  lobbyTimeout() {
    return lobbyTimeout;
  },
  disconnectPay() {
    return disconnectPay;
  },
  disconnectTimeout() {
    return disconnectTimeout;
  },
  bonus() {
    const currentUser = Meteor.userId();
    const { bonus } = Players.findOne(currentUser);
    return bonus.toFixed(2);
  },
  loggedOut() {
    return !Meteor.userId();
  }
});

// Submit the HIT
Template.endSurvey.events({
  'click button'(event) {
    event.preventDefault();
    const currentUser = Meteor.userId();
    const player = Players.findOne(currentUser);
    let feedback = $('#feedback').val();
    let age = $('#age').val();
    let belief = $('#belief').val();
    // For the sake no blank fields fill NAs if client doesn't complete exit survey
    if (!feedback) {
      if (player.status === 'failedQuiz') {
        feedback = 'FAILED QUIZ';
      } else if (player.status === 'lobbyTimeout') {
        feedback = 'LOBBY TIMEOUT';
      } else {
        feedback = 'NA';
      }
    }
    if (!age) {
      age = 'NA';
    }
    if (!belief) {
      belief = 'NA';
    }
    let gender;
    if ($('#male').is(':checked')) {
      gender = 'male';
    } else if ($('#female').is(':checked')) {
      gender = 'female';
    } else {
      gender = 'NA';
    }
    Meteor.call('updatePlayerInfo', currentUser, {
      feedback, age, gender, belief
    }, 'set');

    // Use TurkServer to submit to mturk if enabled in settings.json
    if (Meteor.settings.submitToMTurk) {
      const results = { Feedback: feedback };
      TurkServer.submitExitSurvey(results);
    } else {
      // Otherwise just logout from Meteor
      Meteor.logout();
    }
  }
});
