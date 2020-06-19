// Start tracking a user's connection status now
const assignmentSteps = [
  {
    template: "matched"
  }
];

// Setup interactive instructions logic
Template.assignment.helpers({
  options: {
    steps: assignmentSteps,
    onFinish() {
      const currentUser = Meteor.userId();
      const gameId = Games.findOne()._id;
      $(".action-tutorial-finish").text(" ");
      Meteor.call('startGame', gameId, currentUser);
    }
  }
});

Template.matched.helpers({
  otherPlayers() {
    return groupSize - 1;
  },
  numRounds() {
    return numRounds;
  },
  gameInfo() {
    const currentUser = Meteor.userId();
    const game = Games.findOne();
    const isAllocator = currentUser === game.allocator;
    const { icon } = game.players[currentUser];
    return {
      isAllocator,
      icon
    };
  }

});

// Change role assignment ready button text
Template.assignment.onRendered(() => {
  $(".action-tutorial-finish").text("Ready!");
  $.playSound('/bell');
});
