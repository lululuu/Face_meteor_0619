// Tell user they will be rematched or sent to the submit HIT screen
Template.userDisconnect.helpers({
  gameTooEarly() {
    const game = Games.findOne();
    const tooEarly = _.any(_.pluck(game.players, 'contributions', _.isEmpty));
    if (game.round === 1 && tooEarly) {
      return true;
    }
    return false;
  },
  disconnectPay() {
    return disconnectPay;
  },
  disconnectTimeout() {
    return disconnectTimeout;
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
  }
});

Template.userDisconnect.onCreated(() => {
  Session.set('sTime', new Date());
});
