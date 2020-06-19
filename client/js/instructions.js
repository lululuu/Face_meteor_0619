// TODO: Potentially update based on new instructions
const tutorialSteps = [
  {
    template: "accept"
  },
  {
    template: "overview_PGG"
  },
  {
    template: "UG"
  },
  {
    template: "rounds"
  },
  {
    template: "exampleBonus"
  },
  {
    template: "timing"
  },
  {
    template: "quiz",
    require: {
      event: 'submittedQuiz'
    }
  }
];

quizEmitter = new EventEmitter();
// Setup interactive instructions logic
Template.instructions.helpers({
  options: {
    steps: tutorialSteps,
    emitter: quizEmitter,
    onFinish() {
      const currentUser = Meteor.userId();
      const { passedQuiz } = Players.findOne(currentUser);
      Meteor.call('checkPlayerEligibility', currentUser, passedQuiz);
    }
  }
});

// Tutorial steps helpers
Template.overview_PGG.helpers({
  otherPlayers() {
    return String(groupSize - 1);
  },
  numPlayers() {
    return String(groupSize);
  },
  numRounds() {
    return String(numRounds);
  }
});


