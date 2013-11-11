var Karma = function Karma() {

  this.listeners = {'trigger:karma': this.karma, 'internal:karma': this._karma, PRIVMSG: this.privmsg_karma};
  this.requireDB = true;

  this.throttleProtection = {};

  this.name = 'karma';
  this.help = {
    "default": "Give karma to a user by either using the !karma trigger or simply nickname++ or nickname--"
  };
};

Karma.prototype.privmsg_karma = function privmsg_karma(message) {

  var match = message.parameters[1].match(/\w+(--|\+\+)/);
  if (match)
  {
    var noMatch = message.parameters[1].match(/!karma/);
    if (noMatch === null)
    {
      message.parameters[1] = '!karma '+match[0];
      this.igelkott.emit('trigger:karma', message);
    }
  }

};

Karma.prototype._karma = function _karma(message) {

  var karma_nick = message.parameters[1].split(' ')[1];
  var karma = (/--$/.test(karma_nick)) ? -1 : 1;

  karma_nick = karma_nick.replace('--','').replace('++', '');
  var obj = {
    'to': karma_nick,
    'from': message.prefix.nick,
    'karma': karma
  };

  var igelkott = this.igelkott;

  this.addRecord(obj, function(result) {

    this.throttleProtection[message.prefix.nick] = (new Date()).getTime() + 1000 * 60;

    var karma_reply = {
      command: 'PRIVMSG',
      parameters: [message.parameters[0], obj.to+' now has '+result+' karma']
    };
    this.igelkott.push(karma_reply);
  }.bind(this));
};


Karma.prototype.karma = function karma(message) {

  if (this.throttleProtection[message.prefix.nick] !== undefined && this.throttleProtection[message.prefix.nick] > (new Date()).getTime())
  {
    var karma_reply = {
      command: 'PRIVMSG',
      parameters: [message.parameters[0], message.prefix.nick+' stop spaming!']
    };
    this.igelkott.push(karma_reply);
    return;
  }

  var obj = {
    command: 'internal:karma', // Internal function to give karma if trigger matches
    prefix: {
      nick: message.prefix.nick, // User doing the original !karma eighty4
    },
    parameters: message.parameters // User to give karma to, parsed from the original message
  };

  this.igelkott.queue.add({trigger: function(command, msg) {
    // Match a 330 message and make sure eighty4 is logged in as eighty4
    return (msg.command === '330' && command.message.prefix.nick === msg.parameters[2] && msg.parameters[3] === 'is logged in as');
  } , 'message': obj});

  var whois = {
    command: 'WHOIS',
    parameters: [message.prefix.nick]
  };
  this.igelkott.push(whois); // Push a whois
};


Karma.prototype.addRecord = function addRecord(obj, callback) {
  var Karma = this.igelkott.db.Object.extend("karma");
  new Karma().save(obj).then(function(trans) {
    this.igelkott.log('New object created with objectId: ' + trans.id);

    var query = new this.igelkott.db.Query(Karma);
    query.equalTo("to", obj.to);
    return query.find();
  }.bind(this)).then(function(karmas) {
    var count = 0;
    for (var i in karmas)
    {
      count += karmas[i].get('karma');
    }
    callback(count);
  }.bind(this), function(error) {
    this.igelkott.log('Failed to create new object, with error code: ' + error.description);
  });
};

exports.Plugin = Karma;
