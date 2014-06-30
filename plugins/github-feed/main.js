module.exports = function() {

  // use the node hbs module for templating
  var hbs = require("hbs");
  var $ = require("jquery");
  var marked = require("marked");
  var highlightjs = require("highlight.js");

  function ifGithubType(type, options) {
    if (this.type === type) {
      return options.fn(this); 
    } else {
      return options.inverse(this); 
    }
  };

  marked.setOptions({
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    highlight: function (code) {
      console.log("CODE", code);
      return highlightjs.highlightAuto(code).value;
    }
  });

  function markdown(text) {
    return marked(text);
  };

  var feedItemTemplate = require("./templates/feed-item.hbs");
  var GithubFeedItem = hbs.compile(feedItemTemplate);
  
  return {

    // public: required
    initialize: function(args) {
      var self = this;
      if (_.has(args, "channelAPI")) {
        self.channelAPI = args.channelAPI;
      }

      self.metadataURL = "";
      self.feedURL = "";
      self.last_feed_id = 0;
      self.githubUpdateCheck = null;

      self.repo = {
        metadata: {},
        feed: []
      };

      // hook into the channel's topic change event
      self.channelAPI.onChannelTopicChange(function (topic) {
        self.consumeTopic(topic);
      });

      self.githubUpdateFunction = function() {
        self.updateAndRender(function(r) {
          if (r.feed[0]) {
            if (r.feed[0].id !== self.last_feed_id) {
              // .. add new feed items to channel
              var newFeedItems = self.newFeeditems(r.feed);
              self.last_feed_id = r.feed[0].id;

              var timestamp = self.channelAPI.getTimestamp();
              var html = GithubFeedItem({
                items: newFeedItems,
                timestamp: timestamp
              }, {
                helpers: {
                  "if-github-type": ifGithubType,
                  "markdown": markdown
                }
              });
              self.channelAPI.addChannelMessage(html);
            }
          }
        });
      };
    },

    newFeeditems: function(feed) {
      var self = this;

      var newFeedItems = [];
      var len = feed.length;

      if (len > 0) {

        for (var i = 0; i < len; i++) {
          var id = feed[i].id;

          if (id === self.last_feed_id) {
            return newFeedItems;
          } else {
            newFeedItems.push(feed[i]);
          };
        }
      
      } else {
        return [];
      };
    },

    consumeTopic: function(topic) {
      // receives a topic string from komanda and parses to see if this plugin can act on any URLs in the topic.
      var self = this;
      self.topic = topic;

      if (topic) {
        var match = topic.match(/http(s)?:\/\/.*\.?github.com\/(.[\w|\-|\/]+)/);

        if (match) {
          var key = match[2];
          if (key) {
            self.metadataURL = "";
            self.feedURL = "";

            if (/\/$/.test(key)) {
              key = key.replace(/\/$/, "");
            }

            if (/\//.test(key)) {
              self.metadataURL = "https://api.github.com/repos/" + key;
              self.feedURL = "https://api.github.com/repos/" + key + "/events";
            } else {
              self.metadataURL = "https://api.github.com/orgs/" + key;
              self.feedURL = "https://api.github.com/orgs/" + key + "/events";
            }

            self.pluginReDraw(function() {
              // set the first feed cache id
              if (self.repo.feed[0]) self.last_feed_id = self.repo.feed[0].id;
            });

          } else {
            if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
          } // has match index 3
        } else {
          if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
        } // has match
      } else {
        if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
      } // has topic

    },

    // private - as long as we let plugins control their own refresh rates etc
    pluginReDraw: function(callback) {
      var self = this;

      self.updateAndRender(function(repo) {
        if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
        self.githubUpdateCheck = setInterval(self.githubUpdateFunction, 200000);

        if (callback && typeof callback === "function") callback(repo);
      });

    },

    // private
    updateAndRender: function(callback, errorback) {
     var self = this;
     var metadata;
     var feed;

      $.ajax({
        url: self.metadataURL,
        dataType: "jsonp",
        type: "get",
        cache: true,
        jsonp: "callback",
        ifModified: true,
        timeout: 5000,
        success: function(metaresponse) {
          if (metaresponse.data) {
            metadata = metaresponse.data;
          }

          $.ajax({
            url: self.feedURL,
            dataType: "jsonp",
            type: "get",
            ifModified: true,
            cache: true,
            jsonp: "callback",
            timeout: 5000,
            success: function(feedresponse) {
              if (feedresponse.data) {
                feed = feedresponse.data;
              }

              if (metadata && !_.isEmpty(metadata)) {
                self.repo.metadata = metadata;
              }

              if (feed && feed.length > 0) {
                self.repo.feed = feed;
              }

              if (callback && typeof callback === "function") {
                return callback(self.repo);
              }
            },
            error: function(a,b,c) {
              if (errorback && typeof errorback === "function") {
                errorback(a,b,c);
              }
            }
          });
        },
        error: function(a,b,c) {
          if (errorback && typeof errorback === "function") {
            errorback(a,b,c);
          }
        }
      });

    },

    // public: required
    close: function() {
      var self = this;
      if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
      self.githubUpdateFunction = null;
    }
    
  };

}
