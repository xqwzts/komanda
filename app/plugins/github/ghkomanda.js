define([
  "moment",
  "underscore",
  "hbs!plugins/github/templates/feed-item"
], function(moment, _, GithubFeedItem) {

  return {
    
    // public
    initialize: function() {
      console.log("ghp-initialize");
      var self = this;
      console.log(vicgh=self);

      self.metadataURL = "";
      self.feedURL = "";
      self.last_feed_id = 0;
      self.githubUpdateCheck = null;

      self.repo = {
        metadata: {},
        feed: []
      };

      self.githubUpdateFunction = function() {
        console.log("ghp-updatefunction");
        self.updateAndRender(function(r) {
          console.log(vicr=r);

          if (r.feed[0]) {
            if (r.feed[0].id !== self.last_feed_id) {
              console.log("this is a new item...", r.feed[0]);
              // .. add new feed items to channel

              var newFeedItems = self.newFeeditems(r.feed);

              self.last_feed_id = r.feed[0].id;

              var html = GithubFeedItem({
                items: newFeedItems,
                timestamp: moment().format(Komanda.settings.get('display.timestamp'))
              });

              console.log(vichtml=html);
              self.onItemAdded(html);
            }
          }
        });
      };
    },

    // private
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

    // public: required
    setTopic: function(topic) {
      console.log("ghp-settopic");
      // receives a topic string from komanda and parses to see if this plugin can act on any URLs in the topic.
      var self = this;

      if (topic) {
        var match = topic.match(/http(s)?:\/\/.*\.?github.com\/(.[\w|\-|\/]+)/);

        if (match) {
          var key = match[2];

          if (key) {
            self.metadataURL = "";
            self.feedURL = "";

            if (/\/$/.test(key)) {
              key = key.replace(/\/$/, '');
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
              if (self.repo.feed[1]) self.last_feed_id = self.repo.feed[1].id;
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
      console.log("ghp-pluginredraw")
      var self = this;

      self.updateAndRender(function(repo) {
        if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
        self.githubUpdateCheck = setInterval(self.githubUpdateFunction, 20000);

        if (callback && typeof callback === "function") callback(repo);
      });

    },

    // private
    updateAndRender: function(callback, errorback) {
      console.log("ghp-updateandrender");
      var self = this;

      $.ajax({
        url: self.metadataURL,
        dataType: "json",
        type: "get",
        ifModified: true,
        success: function(metadata) {
          console.log("ajaxed", metadata)

          $.ajax({
            url: self.feedURL,
            dataType: "json",
            type: "get",
            ifModified: true,
            success: function(feed) {
              console.log("feedjaxed", feed);
              if (metadata && !_.isEmpty(metadata)) self.repo.metadata = metadata;

              if (feed && feed.length > 0) {
                self.repo.feed = feed;
              }

              if (callback && typeof callback === "function") {
                return callback(self.repo);
              }
            },
            error: function(a,b,c) {
              console.log("ERROR:::", a,b,c);
              if (errorback && typeof errorback === "function") {
                errorback(a,b,c);
              }
            }
          });
        },
        error: function(a,b,c) {
          console.log("ERROR:::", a,b,c);
          if (errorback && typeof errorback === "function") {
            errorback(a,b,c);
          }
        }
      });

    },

    // public: required
    close: function() {
      console.log("ghp-close");
      var self = this;

      if (self.githubUpdateCheck) clearInterval(self.githubUpdateCheck);
      self.githubUpdateFunction = null;
    }
    
  };

});
