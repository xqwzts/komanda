define([
  "marionette",
  "hbs!templates/channel",
  "underscore",
  "tabcomplete",
  "uuid",
  "moment",
  "highlight"
], function(Marionette, template, _, tab, uuid, moment, hljs) {

  return Marionette.ItemView.extend({
    tagName: "div",
    className: "channel",
    template: template,

    modelEvents: {
      "change:modes": "modesChanged"
    },

    events: {
      "keypress input": "sendMessage",
      "click div.message a": "openLink",
      "click div.user": "pm",
      "click div.show-more": "showMore",
      "click button.zen-button": "zenmode"
    },

    initialize: function() {
      var self = this;
      self.completerSetup = false;
      self.completer = null;
      self.plugs = [];

      Komanda.vent.on(self.model.get("server") + ":" + self.model.get("channel") + ":update:words", function(words, channels) {
        self.updateWords(false, false);
      });
    },

    loadPlugins: function() {
      // Needs to be called after the view has been rendered [onRender()] to ensure that the attach points have been inserted
      // in the DOM and can be passed safely to the plugins.
      var self = this;
      var messagesEl = $(self.el).find(".messages");

      // Get a list of channel plugins from Komanda.settings:
      var channelPlugins = _.where(Komanda.settings.plugins, {"channel": true});

      // Dynamic require to load all the plugins we want to initialize
      requirejs(_.pluck(channelPlugins, "name"), function () {
        for (var i = 0; i < channelPlugins.length; i++) {
          var thePlug = channelPlugins[i];
          // Push this plugin and its info to our plugin list so we can use it throughout the view:
          self.plugs.push({
            "name": thePlug.name,
            "topic": thePlug.topic,
            "plugin": arguments[i]
          });
          // Initialize the plugin that was just created, passing it the messageAttachPoint:
          arguments[i].initialize({messageAttachPoint: messagesEl});
        }
        // Wait for all the plugins to load and add the hooks:
        self.addTopicHooks();
      });      
    },

    addTopicHooks: function() {
      var self = this;

      // When the topic changes, call setTopic on each plugin:
      Komanda.vent.on(self.model.get("server") + ":" + self.model.get("channel") + ":topic", function(topic) {
          // Filter out from this channel's plugins  all the ones that want to be notified on topic changes:
          var topicPlugs = _.where(self.plugs, {"topic": true});
          _.each(topicPlugs, function(topicPlug) {
            var thePlugin = topicPlug.plugin;
            if (_.has(thePlugin, "consumeTopic")) {
              thePlugin.consumeTopic(topic);
            }
          });
      });
    },

    onClose: function() {
      var self = this;

      // Foreach plugin, call plugin.close():
      _.each(self.plugs, function(channelPlug) {
        var thePlugin = channelPlug.plugin;
        thePlugin.close();
      });
    },

    zenmode: function(e) {
      var self = this;
      e.preventDefault();

      if ($("body").hasClass("zenmode")) {
        $("body").removeClass("zenmode");
        Komanda.helpers.scrollUpdate($(self.el).find(".messages"), true, 1);
      } else {
        $("body").addClass("zenmode");
      }
    },

    showMore: function(e) {
      e.preventDefault();
      var current = $(e.currentTarget);
      var ele =  current.attr("data-ele");
      var show = current.attr("data-show");

      $(show, ele).toggle();
    },

    pm: function(e) {
      e.preventDefault();

      var item = $(e.currentTarget);
      var nick = item.attr("data-name");
      var server = item.parents(".channel").attr("data-server-id");
      Komanda.vent.trigger(server + ":pm", nick);
    },

    setupAutoComplete: function() {
      var self = this;
      if (!self.completerSetup) {
        self.completerSetup = true;
        self.completer = tab($(this.el).find("input"), $("#main-search-suggestions"));
        self.updateWords();
      }
    },

    modesChanged: function() {
      var self = this;
      
      var text = self.model.get("channel");
      if (self.model.get("modes") !== "") {
        text += " (" + self.model.get("modes") + ")";
      }
      $(this.el).find(".chan-name").text(text);
    },

    updateWords: function(words, channels) {
      var self = this;
    
      var keys = _.keys(self.model.get("names")) || [];

      keys.push(Komanda.command.getCommands());

      if (Komanda.connections && _.has(Komanda.connections, self.model.get("server"))) {
        channels = _.map(Komanda.connections[self.model.get("server")].client.channels.models, function(c) {
          return c.get("channel").toLowerCase();
        });

        keys.push(channels);
      } else if (channels) {
        keys.push(channels);
      } else {
        // ...
      }

      var keysCommands = _.map(_.flatten(keys), function(k) {
        // return k.toLowerCase();
        return k;
      });

      if (!self.completer) {
        self.completerSetup = false;
        self.setupAutoComplete();
      }

      self.completer.words(keysCommands);
    },

    openLink: function(e) {
      e.preventDefault();
      var href = $(e.currentTarget).attr("href");
      Komanda.gui.Shell.openExternal(href);
      $(this.el).find("input").focus();
    },

    onRender: function() {
      var self = this;
      var $this = $(this.el);

      $this.attr("data-server-id", this.model.get("server"));
      $this.attr("data-name", this.model.get("channel"));

      self.setupAutoComplete();
      self.updateWords();
      // Load Channel Plugins
      self.loadPlugins();
    },

    focus: function(e) {
      $(this.el).find("input").focus();
    },

    sendMessage: function(e) {
      e.stopPropagation();

      var server = this.model.get("server");
      var message = $(e.currentTarget).val();

      if (e.charCode == 13) {
        if (message.length <= 0) return false;

        var textarea = $(e.currentTarget).parent(".input").find("textarea");
        textarea.val(message);

        $(e.currentTarget).val("");

        Komanda.history.add(message);
        Komanda.historyIndex = 0;

        Komanda.vent.trigger(server + ":send", {
          target: this.model.get("channel"),
          message: message
        });
      }
    }
  });
});
