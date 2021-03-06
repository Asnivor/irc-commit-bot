// requires
const irc = require("irc");
const express = require("express");
const log4js = require("log4js");
const body_parser = require("body-parser");
const util = require("util");
const isgd = require('isgd');
const nconf = require('nconf');
const sha1 = require('js-sha1');
const api_parser = require('./github_api_parser');

const logger = log4js.getLogger();
logger.info("bot starting...");

// load configuration from nconf
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

// allow integrarion with third-party port services
if (process.env.PORT) {
    nconf.set('port', process.env.PORT);
	logger.info(nconf.get('port'));
}

// make sure the channel list is an array
var channels_conf = nconf.get('channels');

if (!Array.isArray(channels_conf)) {
    channels_conf = [ channels_conf ];
}

var channels = [];

for (var channel of channels_conf) {
    channels.push(channel[0] != '#' ? ('#' + channel) : channel);
}

logger.info("new irc client");
const bot = new irc.Client(nconf.get('server'), nconf.get('bot_name'), {	
    userName: nconf.get('bot_user'),
    realName: nconf.get('bot_real'),
    encoding: "utf-8"
});

bot.addListener("error", function(message) {
    logger.info("irc died: ", message);
	
	// try and rejoin all channels	
	for (channel of channels) {
            bot.join(channel);
        }

        doJoin();
});

var joinCallbacks = [];
var botJoined = false;

if (nconf.get('bot_registered') == true) {

    bot.addListener('raw', function(message) {

        raw = message;
        if (raw["nick"] == "NickServ") {

            if (raw["args"][1].toLowerCase().indexOf("identify") > -1) {

                bot.say("nickserv", "identify " + nconf.get('bot_pass'));
                logger.info("Nickserv: identify *pass*");

            }

            if (raw["args"][1].indexOf("incorrect") > -1) {

                logger.info("NickServ: Incorrect password :(");
                    process.exit();

                }

                if (raw["args"][1].toLowerCase().indexOf("identified") > -1 || raw["args"][1].toLowerCase().indexOf("recognized") > -1) {

                    if (nconf.get('bot_vhost') == true) {

                        bot.say("hostserv", "on");
                        logger.info("HostServ: on");

                    } else {

                        for (channel of channels) {
                            bot.join(channel);
                        }

                        doJoin();

                        logger.info("We join");

                    }

                }

            }

            if (raw["nick"] == "HostServ") {

                if (raw["args"][1].indexOf("activated") > -1) {

                    for (channel of channels) {
                        bot.join(channel);
                    }

                    doJoin();

                    logger.info("We join");

                }

            }

        });

} else {

    bot.addListener('registered', function() {
        for (channel of channels) {
            bot.join(channel);
        }

        doJoin();

        logger.info("We join");
    });

}

function doJoin() {
    botJoined = true;
	logger.info("doJoin()");
    for (var cb of joinCallbacks) {
        cb();
    }

    joinCallbacks = [];
}

const app = express();
const jp = body_parser.json()

app.get("/", function(req, res){
    res.send("ww");
});

app.post("/git.json", jp, function (req, res) {
	
    logger.info("Incoming POST");
	//logger.info(req);
	
	if (!req.body) return res.sendStatus(400)

    if (botJoined) {
		logger.info("Calling handleAPI - bot already joined");
        handleAPI(req, res);
    } else {
		logger.info("Doing callbacks - bot not joined");
        joinCallbacks.push(function() {
            handleAPI(req, res);
        });	
    }

    res.sendStatus(200);
    res.end();
});


function handleAPI(req, res) {
    logger.info("*pacman ghost sounds*");

    // debug
    for (var channel of channels) {
        //bot.say(channel, "DEBUG: " + req.headers["x-github-event"] + " : " + req.body["action"] + " : " + req.body["ref_type"] + " : " + req.body["ref"]);
    }

    if (req.headers["x-gitlab-event"] != null) {
        handleGitLab(req, res);
    }
    else if (req.headers["x-github-event"]) {
        //handleGitHub(req, res);
        var resArr = api_parser.handle_github(req);
        if (resArr) {
            for (var channel of channels) {
                for (var r of resArr) {
                    bot.say(channel, r);
                }
            }

            for (var r of resArr) {
                logger.info(r);
            }
        }
    }

        // GITLAB STUFF (currently *mostly* untouched)

        // ---------------------------------------------- \\
        //                                                \\
        //                  PUSH HOOK                     \\
        //                                                \\
        // ---------------------------------------------- \\
        if (req.headers["x-gitlab-event"] == "Push Hook") {

            if (req.headers["x-gitlab-event"] != null) {

                var service = "Gitlab";
                var repository_url = req.body["repository"]["homepage"];
                var repository_name = req.body["repository"]["name"];
                var user_name = req.body["user_name"];
                var commits_count = req.body["total_commits_count"];
                var branch = req.body["ref"].split("/").slice(2).join("/");
                var commit_name = "name";

            }

            var reply = util.format("\x02\x0306Commit\x03\x02: \x02\x0303%s\x03\x02 - %s pushed %d new commit%s to branch \x02%s\x02:",
                repository_name,
                user_name,
                commits_count,
                commits_count == 1 ? "" : "s",
                branch);

            for (var channel of channels) {
                bot.say(channel, reply);
            }

			var commitsToShow = 3;
			var commitCnt = 0;
			var commitExtraCnt = 0;
			
			for (var commit of req.body["commits"]) {	
				if (commitCnt >= commitsToShow) {
					commitExtraCnt++;
				}
				else {
					commitCnt++;
				}					
			}
			
            for (var commit of req.body["commits"]) {
				
				commitCnt--;
				
				// we only want to show max 3 commits
				if (commitCnt >= 0) {
					
					// get shortened commit urls
					isgd.shorten(commit["url"], function(commitShorter) {
						var reply_commits = util.format("\t\x02\x0306-\x03 %s\x02: %s (\x02%s\x02) %s",
						commit["id"].substring(0, 7),
						commit["message"].replace(/[\r\n]/g, "").replace(/[\n]/g, ""),
						commit["author"][commit_name],
						commitShorter);					
						
						for (var channel of channels) {
							bot.say(channel, reply_commits);
						}
					});
				}
				else {						
					for (var channel of channels) {
						bot.say(channel, "...and " + commitExtraCnt + " more commits");
					}
				}	
            }

            for (var channel of channels) {
                //bot.say(channel, "View more at " + repository_url);
            }

            logger.info(service + ": [" + repository_name + "/" + branch + "] "+ user_name + " pushed " + commits_count + " new commit(s)");

        // ---------------------------------------------- \\
        //                                                \\
        //                  ISSUE HOOK                    \\
        //                                                \\
        // ---------------------------------------------- \\
    } else if (req.headers["x-gitlab-event"] == "Issue Hook") {

        if (req.headers["x-gitlab-event"] != null) {

            if(req.body["object_attributes"]["action"] == "update") return;

            switch(req.body["object_attributes"]["action"].toLowerCase()) {

                case "open":
                var type = "Issue opened by ";
                break;

                case "close":
                var type = "Issue closed by ";
                break;

                case "reopen":
                var type = "Issue reopened by ";
                break;	
            }

            var service = "Gitlab";
            var issue_id = req.body["object_attributes"]["iid"];
            var issue_title = req.body["object_attributes"]["title"];
            var issue_user = req.body["user"]["name"];
            var issue_url = req.body["object_attributes"]["url"];


        }

        for (var channel of channels) {

            bot.say(channel, util.format("\x02\x0306Issue\x03\x02: %s \x02#%d\x02 \x02\x0303%s\x03\x02 - %s%s - %s",
                repository_name,
				issue_id,
                issue_title,
                type,
                issue_user,
                issue_url));

        }

        logger.info(service + ": " + issue_user + " opened issue #" + issue_id);

        // ---------------------------------------------- \\
        //                                                \\
        //                 COMMENT HOOK                   \\
        //                                                \\
        // ---------------------------------------------- \\
    } else if (req.headers["x-gitlab-event"] == "Note Hook") {

        switch(req.body["object_attributes"]["noteable_type"].toLowerCase()) {

            case "commit":
            var type = "commit \x02\x0303" + req.body["commit"]["message"] + "\x03\x02";
            break;

            case "mergerequest":
            var type = "merge request \x02\x0303" + req.body["merge_request"]["title"] + "\x03\x02";
            break;

            case "issue":
            var type = "issue \x02\x0303" + req.body["issue"]["title"] + "\x03\x02";
            break;

            case "snippet":
            var type = "snippet \x02\x0303" + req.body["snippet"]["title"] + "\x03\x02";
            break;

        }

        isgd.shorten(req.body["object_attributes"]["url"], function(resp) {

            for (var channel of channels) {

                bot.say(channel, util.format("\x02\x0306Comment\x03\x02: %s commented on %s - %s",
                    req.body["user"]["name"],
                    type.replace(/[\r\n]/g, " - ").replace(/[\n]/g, " - "),
                    resp));

            }

        });

        logger.info("Gitlab: " + type + " comment by " +  req.body["user"]["name"]);


        // ---------------------------------------------- \\
        //                                                \\
        //               MERGE REQUEST HOOK               \\
        //                                                \\
        // ---------------------------------------------- \\
    } else if (req.headers["x-gitlab-event"] == "Merge Request Hook") {

            if (req.headers["x-gitlab-event"] != null) {

                switch (req.body["object_attributes"]["state"].toLowerCase()) {
                    case "opened":
                        var type = "Opened";
                        break;

                    case "merged":
                        var type = "Merged";
                        break;

                    case "closed":
                        var type = "Closed";
                        break;

                    case "reopened":
                        var type = "Reopened";
                        break;
                }

                var action = req.body["object_attributes"]["action"];
                var merge_url = req.body["object_attributes"]["url"];
                var merge_id = req.body["object_attributes"]["iid"];
                var merge_title = req.body["object_attributes"]["title"];
                var merge_user = req.body["user"]["name"];

            }

            if (action == "open" || action == "close" || action == "reopen" || action == "opened" || action == "closed" || action == "reopened" || type == "Merged") {
                var repository_name = req.body["repository"]["full_name"];
                //logger.info(req.body);

                var head = req.body["pull_request"]["head"]["label"];
                var base = req.body["pull_request"]["base"]["label"];


                isgd.shorten(merge_url, function (resp) {

                    for (var channel of channels) {

                        bot.say(channel, util.format("\x02\x0306Pull Request\x03\x02: %s \x02#%d\x02 \x02\x0303%s\x03\x02 (%s -> %s) - %s by %s - %s",
                            repository_name,
                            merge_id,
                            merge_title,
                            head,
                            base,
                            type,
                            merge_user,
                            resp));
                    }

                });

            }

            logger.info("Merge Request");
        }
};



// GitLab related hooks
function handleGitLab(req, res) {

};

app.listen(nconf.get('port'));
logger.info("listening on port " + nconf.get('port'));
