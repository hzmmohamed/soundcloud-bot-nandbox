const nbClient = require("nandbox-bot-api/src/NandBoxClient");
const nandbox = require("nandbox-bot-api/src/NandBox");
const nCallBack = new nandbox().Callback;

const TextOutMessage = require("nandbox-bot-api/src/outmessages/TextOutMessage");
const Utils = require("nandbox-bot-api/src/util/Utility");
const Id = Utils.Id;
const Button = require("nandbox-bot-api/src/data/Button");
const Row = require("nandbox-bot-api/src/data/Row");
const Menu = require("nandbox-bot-api/src/data/Menu");
const OutMessage = require("nandbox-bot-api/src/outmessages/OutMessage");
const MediaTransfer = require("nandbox-bot-api/src/util/MediaTransfer");
const sc = require("./utils/sc");
const fs = require("fs");
const AudioOutMessage = require("nandbox-bot-api/src/outmessages/AudioOutMessage");
const scdl = require("soundcloud-downloader");
const CLIENT_ID = "aruu5nVXiDILh6Dg7IlLpyhpjsnC2POa";
const configFile = require("./config.json");
const TOKEN = configFile.token;

const jsonUtils = require("./utils/jsonUtils");
const UpdateOutMessage = require("nandbox-bot-api/src/outmessages/UpdateOutMessage");

function msToTime(duration) {
  let milliseconds = parseInt((duration % 1000) / 100),
    seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  return hours + ":" + minutes + ":" + seconds;
}

const createButton = (
  label,
  callback,
  order,
  bgColor,
  txtColor,
  buttonURL,
  buttonQuery,
  nextMenuRef,
  span
) => {
  let btn = new Button();

  btn.button_label = label;
  btn.button_order = order;
  btn.button_callback = callback;
  btn.button_bgcolor = bgColor;
  btn.button_textcolor = txtColor;
  btn.button_query = buttonQuery;
  btn.next_menu = nextMenuRef;
  btn.button_url = buttonURL;
  btn.button_span = span | 1;

  return btn;
};
const config = {
  URI: configFile.URI,
  DownloadServer: configFile.DownloadServer,
  UploadServer: configFile.UploadServer,
};
const client = nbClient.NandBoxClient.get(config);

const botId = TOKEN.split(":", 1)[0];

let shortName = "";

const createResultsMessage = async (q, page, shortName) => {
  const scResults = await sc.search(CLIENT_ID, q, page);
  let i = 1;
  const textResults = [];
  const trackButtons = [];

  if (scResults && scResults.length > 0) {
    scResults.forEach((r) => {
      textResults.push(
        [
          `${i}: 🎵 ${r.title.replace(".", " ")}`,
          `👤 ${r.accountName}     ⏲️ ${msToTime(r.full_duration)}`,
        ].join("\n")
      );
      trackButtons.push(
        createButton(`${i}`, `${r.uri}`, i, "#e65f1c", "white").toJsonObject()
      );
      i++;
    });
  } else {
    return false;
  }

  const pageButtons = [
    createButton(
      "<<",
      `page${page - 1}`,
      1,
      page === 1 ? "#adabaa" : "grey",
      "white",
      null,
      null,
      null,
      1
    ).toJsonObject(),
    createButton(
      `Page ${page}`,
      "",
      2,
      "lightgrey",
      "white",
      null,
      null,
      null,
      1
    ).toJsonObject(),
    createButton(
      ">>",
      `page${page + 1}`,
      3,
      "grey",
      "white",
      null,
      null,
      null,
      1
    ).toJsonObject(),
  ];
  const menuRef = q;
  const rows = [new Row(trackButtons, 1), new Row(pageButtons, 2)];
  const menus = [new Menu(rows, menuRef)];
  console.log("page number is ", page);

  const msgText = "".concat(
    `🔎 "${q}"\n`,
    `📃 Page ${page}`,
    `\n─────────────── \n`,
    textResults.join("\n\n"),
    `\n─────────────── \n`,
    `Press the buttons below to download the corresponding tracks.`
  );

  return { menus, menuRef, msgText };
};

const noResultsFound = "No Results Found";

let tempMsgId = "";
let api = null;
nCallBack.onConnect = (_api) => {
  api = _api;
  console.log("Authenticated");
  api.getUser(botId);
};

nCallBack.onReceive = async (incomingMsg) => {
  console.log("Message Received");
  if (
    incomingMsg.isTextMsg() &&
    incomingMsg.status !== "updated" &&
    incomingMsg.status !== "deleted" &&
    incomingMsg.text !== noResultsFound &&
    (incomingMsg.chat_settings == 1 ||
      incomingMsg.chat.id == incomingMsg.from.id)
  ) {
    const chat_id = incomingMsg.chat.id;
    const q = incomingMsg.text;

    createResultsMessage(q, 1, shortName).then((data) => {
      let msg = new TextOutMessage();

      msg.chat_id = chat_id;
      msg.reference = Id();
      msg.web_page_preview = OutMessage.WEB_PREVIEW_INSTANCE_VIEW;
      msg.echo = 1;
      msg.to_user_id = incomingMsg.from.id;

      if (data == false) {
        msg.menu_ref = [];
        msg.inline_menu = [];
        msg.text = noResultsFound;
      } else {
        msg.menu_ref = data.menuRef;
        msg.inline_menu = data.menus;
        msg.text = data.msgText;
      }

      if (incomingMsg.chat_settings == 1) msg.chat_settings = 1;
      else msg.chat_settings = 0;

      api.send(JSON.stringify(msg));
    });
  }
};

nCallBack.onReceiveObj = (obj) => {};
nCallBack.onClose = () => console.log("ONCLOSE");
nCallBack.onError = () => console.log("ONERROR");
nCallBack.onChatMenuCallBack = (chatMenuCallback) => {};
nCallBack.onInlineMessageCallback = async (inlineMsgCallback) => {
  let chatSettings = 0;
  if (inlineMsgCallback.chat.id != inlineMsgCallback.from.id) chatSettings = 1;

  const btnCallback = inlineMsgCallback.button_callback;
  if (btnCallback.startsWith("page")) {
    const pageNumber = parseInt(btnCallback.slice(4));
    if (pageNumber <= 0) return;

    createResultsMessage(inlineMsgCallback.menu_ref, pageNumber, shortName)
      .then((data) => {
        const newPage = new UpdateOutMessage();
        newPage.message_id = inlineMsgCallback.message_id;
        newPage.text = data.msgText;
        newPage.reference = inlineMsgCallback.reference;
        newPage.to_user_id = inlineMsgCallback.from.id;
        newPage.chat_id = inlineMsgCallback.chat.id;
        newPage.inline_menu = data.menus;
        newPage.menu_ref = data.menuRef;
        newPage.chat_settings = chatSettings;
        api.send(JSON.stringify(newPage));
      })
      .catch((err) => console.log(err.message));
  } else {
    const fileName = `${parseInt(Math.random(12) * 10000000000000)}`;
    const info = await scdl.getInfo(btnCallback, CLIENT_ID);

    jsonUtils.readJsonFile("./uploadedTracks.json").then((uploadedTracks) => {
      const matchingTrack = uploadedTracks.ids.find(
        (track) => track.scId === info.id
      );
      if (matchingTrack) {
        const audioMessage = new AudioOutMessage();
        audioMessage.audio = matchingTrack.fileId;
        audioMessage.title = info.title;
        audioMessage.performer = info.user.username;
        audioMessage.chat_id = inlineMsgCallback.chat.id;
        audioMessage.reference = Id();
        audioMessage.echo = 0;
        audioMessage.caption = "Downloaded via @" + shortName + " bot";
        if (chatSettings == 1) {
          audioMessage.chat_settings = chatSettings;
          audioMessage.to_user_id = inlineMsgCallback.from.id;
        }
        api.send(JSON.stringify(audioMessage));
      } else {
        scdl
          .getInfo(btnCallback, CLIENT_ID)
          .then(({ full_duration, title }) => {
            if (full_duration > 9000000) {
              console.log(full_duration);

              if (chatSettings == 0)
                api.sendText(
                  inlineMsgCallback.chat.id,
                  `${title} is larger than the supported size by the bot.`
                );
              else {
                let reference = Id();
                api.sendText(
                  inlineMsgCallback.chat.id,
                  `${title} is larger than the supported size by the bot.`,
                  reference,
                  null,
                  inlineMsgCallback.from.id,
                  null,
                  null,
                  chatSettings,
                  null
                );
              }
            } else {
              let reference = Id();
              if (chatSettings == 0)
                api.sendText(inlineMsgCallback.chat.id, "📩 downloading...");
              else
                api.sendText(
                  inlineMsgCallback.chat.id,
                  "📩 downloading...",
                  reference,
                  null,
                  inlineMsgCallback.from.id,
                  null,
                  null,
                  chatSettings,
                  null
                );
              scdl.download(btnCallback, CLIENT_ID).then(async (stream) => {
                stream
                  .pipe(fs.createWriteStream(`./dl/${fileName}.mp3`))
                  .on("finish", () => {
                    MediaTransfer.uploadFile(
                      TOKEN,
                      `./dl/${fileName}.mp3`,
                      config.UploadServer
                    ).then((fileId) => {
                      if (!fileId) {
                        console.log("Upload Failed.");
                      }

                      const audioMessage = new AudioOutMessage();
                      audioMessage.audio = fileId;
                      audioMessage.title = info.title;
                      audioMessage.performer = info.user.username;
                      audioMessage.chat_id = inlineMsgCallback.chat.id;
                      audioMessage.reference = Id();
                      audioMessage.echo = 0;
                      audioMessage.caption =
                        "Downloaded via @" + shortName + " bot";
                      if (chatSettings == 1) {
                        audioMessage.chat_settings = chatSettings;
                        audioMessage.to_user_id = inlineMsgCallback.from.id;
                      }
                      api.send(JSON.stringify(audioMessage));

                      jsonUtils
                        .readJsonFile("./uploadedTracks.json")
                        .then((uploadedTracks) => {
                          uploadedTracks.ids.push({ scId: info.id, fileId });
                          jsonUtils.writeJsonFile(
                            uploadedTracks,
                            "./uploadedTracks.json"
                          );
                        });
                      fs.unlinkSync(`./dl/${fileName}.mp3`);
                    });
                  });
              });
            }
          });
      }
    });
  }
};
nCallBack.onMessagAckCallback = (msgAck) => {
  tempMsg = msgAck;
};
nCallBack.onUserJoinedBot = (user) => {};
nCallBack.onChatMember = (chatMember) => {};
nCallBack.onChatAdministrators = (chatAdministrators) => {};
nCallBack.userStartedBot = (user) => {};
nCallBack.onMyProfile = (user) => {};
nCallBack.onUserDetails = (user) => {
  console.log("shortName " + user.shortName);
  shortName = user.shortName;
};
nCallBack.userStoppedBot = (user) => {};
nCallBack.userLeftBot = (user) => {};
nCallBack.permanentUrl = (permenantUrl) => {};
nCallBack.onChatDetails = (chat) => {};
nCallBack.onInlineSearh = (inlineSearch) => {};

client.connect(TOKEN, nCallBack);
