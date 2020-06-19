// TODO: Update to add UGFullOutcome
Template.progress.helpers({
  game() {
    const game = Games.findOne();
    let out;
    if (!game || (game.state === 'assignment' || game.state === 'lostUser')) {
      out = false;
    } else {
      let pChoose = "";
      let pDisp = "";
      let aChoose = "";
      let aDisp = "";
      let UGDecider = "";
      let UGReceiver = "";
      let UGOutcome = "";
      let gameEnd = "";
      let { round } = game;
      let displayEnd = false;

      switch (game.state) {
        case 'pChoose':
          pChoose = 'active';
          break;
        case 'pDisp':
          pDisp = 'active';
          break;
        case 'aChoose':
          aChoose = 'active';
          break;
        case 'aDisp':
          aDisp = 'active';
          break;
        case 'UGDecider':
          UGDecider = 'active';
          break;
        case 'UGReceiver':
          UGReceiver = 'active';
          break;
        case 'UGOutcome':
          UGOutcome = 'active';
          round = game.round - 1;
          break;
        case 'playerRatings':
          round = game.round - 1;
          displayEnd = true;
          gameEnd = 'active';
          break;
        case 'finalOut':
          round = game.round - 1;
          displayEnd = true;
          gameEnd = 'active';
        // no default
      }
      out = {
        state: game.state,
        pChoose,
        pDisp,
        aChoose,
        aDisp,
        UGDecider,
        UGReceiver,
        UGOutcome,
        round,
        displayEnd,
        gameEnd
      };
    }
    return out;
  }
});
