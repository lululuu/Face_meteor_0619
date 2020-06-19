Template.admin.events({

  'click #games'(event) {
    // Only allow clients to attempt quiz twice before preventing them from doing so
    event.stopPropagation();
  },
  'click #participants'(event) {
    // Only allow clients to attempt quiz twice before preventing them from doing so
    event.stopPropagation();
  },
  'click #log-out'(event) {
    // Only allow clients to attempt quiz twice before preventing them from doing so
    event.stopPropagation();
    event.preventDefault();
    Meteor.call("logoutAdmin");
    $('#password-feedback').css('visibility', 'hidden');
    console.log("admin logged out successfully");
  },
  'click #log-in'(event) {
    // Only allow clients to attempt quiz twice before preventing them from doing so
    event.stopPropagation();
    event.preventDefault();
    const password = document.getElementById("password").value;
    Meteor.call("checkAdminPassword", password, (err, resp) => {
      if (resp) {
        console.log("admin logged in successfully");
        document.getElementById("password").value = '';
        $('#password-feedback').css('visibility', 'hidden');
      } else {
        $('#password-feedback').css('visibility', 'visible');
      }
    });
  }
});

Template.admin.helpers({
  loggedIn() {
    const admin = Admin.findOne();
    return admin.loggedIn;
  }
});
