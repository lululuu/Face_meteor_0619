// TODO: Potentially update based on addition of another game state for UG Full outcome
Template.main.helpers({
  background() {
    const game = Games.findOne();
    let background;
    if (game) {
      switch (game.state) {
        case 'pChoose':
          background = `background-image: url(${backgrounds[0]})`;
          break;
        case 'pDisp':
          background = `background-image: url(${backgrounds[0]})`;
          break;
        case 'aChoose':
          background = `background-image: url(${backgrounds[0]})`;
          break;
        case 'aDisp':
          background = `background-image: url(${backgrounds[0]})`;
          break;
        case 'UGDecider':
          background = `background-image: url(${backgrounds[1]})`;
          break;
        case 'UGSelfOutcome':
          background = `background-image: url(${backgrounds[1]})`;
          break;
        case 'UGOutcome':
          background = `background-image: url(${backgrounds[1]})`;
          break;
        case 'roundOutcome':
          background = `background-image: url(${backgrounds[1]})`;
          break;
        case 'gOut': // NOT SURE IF WE NEED THIS
          background = `background-image: url(${backgrounds[2]})`;
          break;
        case 'playerRatings':
          background = `background-image: url(${backgrounds[2]})`;
          break;
        case 'finalOut':
          background = `background-image: url(${backgrounds[2]})`;
          break;
        // no default
      }
      return background;
    }
  }
});
