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
const CLIENT_ID = "yBT1d8kK7at5QuM6ik9RFcvPvDTi4xyP";
const TOKEN = "90091783959388392:0:8bf55Db6ANrFcyuouIfkKdXHLqhIJA";

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
  URI: "wss://d1.nandbox.net:5020/nandbox/api/",
  DownloadServer: "https://d1.nandbox.net:5020/nandbox/download/",
  UploadServer: "https://d1.nandbox.net:5020/nandbox/upload/",
};
const client = nbClient.NandBoxClient.get(config);

const createResultsMessage = async (q, page) => {
  const scResults = await sc.search(CLIENT_ID, q, page);
  let i = 1;
  const textResults = [];
  const trackButtons = [];
  scResults.forEach((r) => {
    if(r.full_duration < 4200000) {

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
    }
  });

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

let tempMsgId = "";
let api = null;
nCallBack.onConnect = (_api) => {
  api = _api;
  console.log("Authenticated");
};

nCallBack.onReceive = async (incomingMsg) => {
  console.log("Message Received");
  if (incomingMsg.isTextMsg() && incomingMsg.status !== "updated") {
    const chat_id = incomingMsg.chat.id;
    const q = incomingMsg.text;
    createResultsMessage(q, 1).then((data) => {
      let msg = new TextOutMessage();
      msg.menu_ref = data.menuRef;
      msg.chat_id = chat_id;
      msg.reference = Id();
      msg.web_page_preview = OutMessage.WEB_PREVIEW_INSTANCE_VIEW;
      msg.echo = 1;
      msg.to_user_id = incomingMsg.from.id;
      msg.inline_menu = data.menus;
      msg.text = data.msgText;
      api.send(JSON.stringify(msg));
    });
  }
};

nCallBack.onReceiveObj = (obj) => {};
nCallBack.onClose = () => console.log("ONCLOSE");
nCallBack.onError = () => console.log("ONERROR");
nCallBack.onChatMenuCallBack = (chatMenuCallback) => {};
nCallBack.onInlineMessageCallback = async (inlineMsgCallback) => {
  const btnCallback = inlineMsgCallback.button_callback;
  if (btnCallback.startsWith("page")) {
    const pageNumber = parseInt(btnCallback.slice(4));
    if (pageNumber <= 0) return;

    // const updateTempMsg = new UpdateOutMessage();
    // updateTempMsg.message_id = inlineMsgCallback.message_id;
    // updateTempMsg.reference = inlineMsgCallback.reference;
    // updateTempMsg.to_user_id = inlineMsgCallback.from.id;
    // updateTempMsg.chat_id = inlineMsgCallback.chat.id;
    // updateTempMsg.text = "Fetching...";
    // api.send(JSON.stringify(updateTempMsg));
    createResultsMessage(inlineMsgCallback.menu_ref, pageNumber)
      .then((data) => {
        const newPage = new UpdateOutMessage();
        newPage.message_id = inlineMsgCallback.message_id;
        newPage.text = data.msgText;
        newPage.reference = inlineMsgCallback.reference;
        newPage.to_user_id = inlineMsgCallback.from.id;
        newPage.chat_id = inlineMsgCallback.chat.id;
        newPage.inline_menu = data.menus;
        newPage.menu_ref = data.menuRef;
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
        audioMessage.caption = "";
        api.send(JSON.stringify(audioMessage));
      } else {
        scdl
          .getInfo(btnCallback, CLIENT_ID)
          .then(({ full_duration, title }) => {
            if (full_duration > 4200000) {
              console.log(full_duration);
              api.sendText(
                inlineMsgCallback.chat.id,
                `${title} is larger than the supported size by the bot.`
              );
            } else {
              api.sendText(inlineMsgCallback.chat.id, "📩 downloading...");
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

                      // TODO: update or delete the 'downloading' message
                      // const updateTempMsg = new UpdateOutMessage();
                      // updateTempMsg.message_id = tempMsg.message_id;
                      // updateTempMsg.reference = tempMsg.reference;
                      // updateTempMsg.to_user_id = inlineMsgCallback.from.id;
                      // updateTempMsg.chat_id = inlineMsgCallback.chat.id;
                      // updateTempMsg.text = "✔️ downloaded.";
                      // api.send(JSON.stringify(updateTempMsg));

                      const audioMessage = new AudioOutMessage();
                      audioMessage.audio = fileId;
                      audioMessage.title = info.title;
                      audioMessage.performer = info.user.username;
                      audioMessage.chat_id = inlineMsgCallback.chat.id;
                      audioMessage.reference = Id();
                      audioMessage.echo = 0;
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
nCallBack.onUserDetails = (user) => {};
nCallBack.userStoppedBot = (user) => {};
nCallBack.userLeftBot = (user) => {};
nCallBack.permanentUrl = (permenantUrl) => {};
nCallBack.onChatDetails = (chat) => {};
nCallBack.onInlineSearh = (inlineSearch) => {};

client.connect(TOKEN, nCallBack);
