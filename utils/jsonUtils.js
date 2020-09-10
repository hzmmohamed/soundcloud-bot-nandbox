const fs = require("fs");

exports.readJsonFile = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          const obj = JSON.parse(data);
          resolve(obj);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
};

exports.writeJsonFile = (obj, path) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(obj, null, 2), (err) => {
      if (err) reject(err);
    });
  });
};
