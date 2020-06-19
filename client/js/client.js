// Setup up a reactive computation that monitors when clients' states changes
Meteor.startup(() => {
  Meteor.defer(() => {
    Tracker.autorun(() => {
      // When a user is in the lobby clear any experiment-ending timers, make sure they have access to the lobby db, and show them the lobby template

      if (TurkServer.inLobby()) {
        const batch = TurkServer.batch();
        Meteor.subscribe('lobby', batch && batch._id);
        Router.go('lobby');
      } else if (TurkServer.inExperiment()) {
        Router.go('game');
      } else if (TurkServer.inExitSurvey()) {
        Router.go('endSurvey');
      }
    });
  });
});

// Reactively subscribe to the partitioned databases

Tracker.autorun(() => {
  const group = TurkServer.group();
  if (group == null) {
    return;
  }
  Meteor.subscribe('Players');
  Meteor.subscribe('Games', group);
  Meteor.subscribe('userStatus');
  Meteor.subscribe('Batches');
  Meteor.subscribe('Admin');
});


// New Spacebars function that should work on all templates
Template.registerHelper('Cond', (v1, operator, v2) => {
  switch (operator) {
    case '==':
      return (v1 === v2);
    case '!=':
      return (v1 !== v2);
    case '<':
      return (v1 < v2);
    case '<=':
      return (v1 <= v2);
    case '>':
      return (v1 > v2);
    case '>=':
      return (v1 >= v2);
    case '&&':
      return (v1 && v2);
    case '||':
      return (v1 || v2);
    // no default
  }
});

// Jquery play sound function extension
(function ($) {
  $.extend({
    playSound() {
      return $(`<embed src='${arguments[0]}.mp3' hidden='true' autostart='true' loop='false' class='playSound'><audio autoplay='autoplay' style='display:none;' controls='controls'><source src='${arguments[0]}.mp3' /><source src='${arguments[0]}.ogg' /></audio>`).appendTo('body');
    }
  });
})(jQuery);
