var assert = require('chai').assert,
    Stream = require('stream'),
    _ = require('underscore'),
    sinon = require('sinon'),

    Igelkott = require('igelkott'),
    Karma = require('../igelkott-karma.js').Plugin;


function cleanParseClass(igelkott, className, callback) {
  var query = new igelkott.db.Query(className);
  query.find().then(function(results) {
    var promise = igelkott.db.Promise.as();
    _.each(results, function(result) {
      promise = promise.then(function() {
        return result.destroy();
      });
    });
    return promise;
  }).then(function() {
    callback();
  });
}


describe('Karma', function() {
  var igelkott,
      config,
      s,
      spy;

  beforeEach(function () {
    s = new Stream.PassThrough({objectMode: true});

    config = {
      core:['privmsg'],
      'adapter': s, 'connect': function() { this.server.emit('connect'); },
      "database": {
        "app_id": process.env.APP_ID,
        "js_key": process.env.JS_KEY
      }
    };

    igelkott = new Igelkott(config);
  });


  it('Should listen to !karma and make sure the user is identified', function(done) {
    this.timeout(50000); // DB queries are slow
    igelkott.plugin.load('karma', {}, Karma);

    // We need to respond to whois
    s.on('data', function(message) {
      if (message === "WHOIS dsmith\r\n")
      {
        s.write(":calvino.freenode.net 330 sonic_ dsmith dsmith :is logged in as\r\n");
      }
    });

    spy = sinon.spy(igelkott.plugin.plugins['karma'], "addRecord");

    // We have an identified user, let's karma!
    igelkott.on('internal:karma', function(message) {
      setTimeout(function() {

        var Karma = igelkott.db.Object.extend("karma");
        var query = new igelkott.db.Query(Karma);

        query.equalTo("to", 'jsmith');
        query.equalTo("from", 'dsmith');
        query.equalTo("karma", 1);
        query.count({
          success: function(karmas) {
            assert.equal(karmas,1);
            assert.equal(spy.args.length, 1);
            assert.deepEqual(spy.args[0][0], { to: 'jsmith', from: 'dsmith', karma: 1 });
            done();
          },
          error: function(error) {
            console.log("Error: " + error.code + " " + error.message);
          }
        });
      }, 1000);
    });

    cleanParseClass(igelkott, 'karma', function() {
      igelkott.connect();
      s.write(":dsmith!~dsmith@unaffiliated/dsmith PRIVMSG ##botbotbot :!karma jsmith\r\n");
    });
  });


  it('Should listen to -- and inline text', function(done) {
    this.timeout(50000); // DB queries are slow
    igelkott.plugin.load('karma', {}, Karma);

    // We need to respond to whois
    s.on('data', function(message) {
      if (message === "WHOIS dsmith\r\n")
      {
        s.write(":calvino.freenode.net 330 sonic_ dsmith dsmith :is logged in as\r\n");
      }
    });

    spy = sinon.spy(igelkott.plugin.plugins['karma'], "addRecord");

    // We have an identified user, let's karma!
    igelkott.on('internal:karma', function(message) {
      setTimeout(function() {
        assert.equal(spy.args.length, 1);
        assert.deepEqual(spy.args[0][0], { to: 'jsmith', from: 'dsmith', karma: -1 });
        done();
      }, 500);
    });

    cleanParseClass(igelkott, 'karma', function() {
      igelkott.connect();
      s.write(":dsmith!~dsmith@unaffiliated/dsmith PRIVMSG ##botbotbot :Heay, lets give jsmith-- some karma\r\n");
    });
  });
});
