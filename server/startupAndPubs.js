Meteor.startup(() => {
  try {
    Admin.upsert({ username: 'cosanlab' }, { username: 'cosanlab', password: Meteor.settings.dataAdminPassword, loggedIn: false });
    // Create main experiment batch
    Batches.upsert({ name: 'main' }, { name: 'main', active: true });
    TurkServer.ensureTreatmentExists({ name: 'main' });
    Batches.update({ name: 'main' }, { $addToSet: { treatments: 'main' } });

    Batches.find().forEach((batch) => {
      TurkServer.Batch.getBatch(batch._id).setAssigner(new TurkServer.Assigners.PGGAssigner(groupSize));
    });
    Meteor.users.find({ admin: { $exists: false }, "status.online": true }).observe({
      added(usr) {
        if (_.has(usr, 'group')) {
          Meteor.call('connectionChange', usr._id, usr.group, 'reconnect');
        }
      },
      removed(usr) {
        if (_.has(usr, 'group')) {
          Meteor.call('connectionChange', usr._id, usr.group, 'disconnect');
        }
      }
    });
  } catch (e) {
    console.log(e);
  }
});

// Subjects DB
Meteor.publish('Players', () => Players.find());

// Games DB
Meteor.publish('Games', () => Games.find());

// Batch info for condition before getting matched
Meteor.publish('Batches', () => Batches.find());

// Users for disconnection
Meteor.publish('userStatus', () => Meteor.users.find({ "status.online": true }));

// Admin route
Meteor.publish('Admin', () => Admin.find({}, { fields: { loggedIn: 1 } }));
