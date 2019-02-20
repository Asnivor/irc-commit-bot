var nconf = require('nconf');

function Config() {
    nconf.argv().env().file('config.json').defaults({
        // irc
        channels: ["#githookbottest"],
        server: "chat.freenode.net",
        bot_name: "GitHookBot" + Math.floor(1000 + Math.random() * 9000),
        bot_pass: "",
        bot_registered: false, // is the bot registered? (true or false)
        bot_vhost: false, // does the bot have a VHost assigned?
        bot_user: "GitHookBot",
        bot_real: "Git Hook Bot",

        // git listen port
        port: 4021
    });
}

Config.prototype.get = function(key) {
    return nconf.get(key);
};

Config.prototype.set = function(key, value) {
    nconf.set(key, value);
};

module.exports = new Config();