// TODO: Update to reflect new game design
// This is kind of janky since quiz is based on Batch condition, but the look up needs to be in the template helper; returning subsets of questions doesn't work with validation, there's probably a better solution...
const Questions = new Mongo.Collection(null);
const questions = [];
const potSize = groupSize * 50;

// AC: I change the quiz from 5 questions to 6 questions. I name the PGG as Game 1 and the UG as Game 2.
questions[0] = {
  text: '1) If you decide to contribute 50 bags of rice to the public co-op, how many bags of rice will be left in your private account?',
  answer: ['fifty', '50'],
  correct: false,
  answered: false
};
questions[1] = {
  text: `2) If there are ${groupSize} farmer, and each farmer contributes 50 bags of rice to the public co-op, how many bags of rice will be in the co-op after the government matches? (enter a number)`,
  answer: [String(potSize * 2)],
  correct: false,
  answered: false
};

questions[2] = {
  text: '3) How many different farmers will you be playing with?',
  answer: ['three', '3'],
  correct: false,
  answered: false
};
questions[3] = {
  text: '4) How many seasons does the game last?',
  answer: ['ten', '10'],
  correct: false,
  answered: false
};
questions[4] = {
  text: '5) If you decided to keep 6 bushels of wheat for yourself, how many bushels of wheat will another farmer get (assuming they accept your offer)?',
  answer: ['four', '4'],
  correct: false,
  answered: false
};


for (let q = 0; q < questions.length; q += 1) {
  Questions.insert(questions[q]);
}

Template.quiz.helpers({
  questions() {
    return Questions.find();
  },
  quizAttempts() {
    return Players.findOne(Meteor.userId()).quizAttempts;
  },
  passedQuiz() {
    return Players.findOne(Meteor.userId()).passedQuiz;
  }
});

Template.question.helpers({
  incorrect() {
    return this.answered && !this.correct;
  }
});

Template.quiz.events({
  'submit .quiz'(event) {
    // Only allow clients to attempt quiz twice before preventing them from doing so
    event.stopPropagation();
    event.preventDefault();
    const currentUser = Meteor.userId();
    const { quizAttempts } = Players.findOne(currentUser);
    const form = event.target;
    Questions.find().forEach((q) => {
      const answer = $.trim(form[q._id].value.toLowerCase());
      const correct = $.inArray(answer, q.answer) >= 0;
      Questions.update({ _id: q._id }, { $set: { correct, answered: true } });
    });
    const result = Questions.find({ correct: true }).count() === Questions.find().count();

    if (!result) {
      Meteor.call('updatePlayerInfo', currentUser, { quizAttempts: 1 }, 'inc');
      if (quizAttempts === 1) {
        // End the quiz if they've submitted answers once before
        quizEmitter.emit('submittedQuiz');
      }
    } else {
      Meteor.call('updatePlayerInfo', currentUser, { passedQuiz: true }, 'set');
      quizEmitter.emit('submittedQuiz');
    }
  }
});
