const scdl = require("soundcloud-downloader");
const { default: axios } = require("axios");
const fs = require("fs");
const _ = require("lodash");

// returns an array of search results based on query (q)
exports.search = async (client_id, q, page) => {
  try {
    const offset = parseInt((page - 1) * 5);
    console.log("offset is ", offset, client_id, q);
    const { data } = await axios.get(
      "https://api-v2.soundcloud.com/search/tracks",
      {
        params: {
          client_id,
          q,
          offset,
        },
      }
    );
    const res = data.collection
      .filter(({ full_duration }) => full_duration < 600000)
      .slice(0, 5)
      .map(({ title, uri, id, user, full_duration, artwork_url }) => {
        return {
          title,
          uri,
          id,
          full_duration,
          artwork_url,
          accountName: user.username,
        };
      });
    return res;
  } catch (err) {
    console.log("SC SEARCH ERROR: ", err.message);
  }
};

exports.download = (url, client_id, fileName) => {
  scdl.getInfo(url, client_id).then((info) => {
    console.log(info);
  });
  console.log("Downloading from SoundCloud...");
  return scdl.download(url, client_id).then((stream) => {
    console.log("Downloaded from SoundCloud.");
    stream.pipe(fs.createWriteStream(`${fileName}.mp3`));
  });
};
