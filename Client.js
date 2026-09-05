/**
 * Created by Nexus on 01.08.2017.
 */
let i = 0;

class Client {
  constructor(socket) {
    this.socket = socket;
    this.id = i++;
    this.setupSend = false;
  }

  sendSetup(title, structure, dataList, atlas) {
    const res = {
      title,
      dataCache: dataList,
      structure: structure,
    };
    if (atlas) res.atlas = atlas;
    this.socket.emit("setup", res);
    this.setupSend = true;
  }

  sendAtlas(atlas) {
    if (!this.setupSend) return;
    this.socket.emit("atlas", atlas || null);
  }

  sendUpdate(dataList) {
    if (!this.setupSend) return;
    this.socket.emit("updateBotUI", dataList);
  }

  /**
   * Batched per-interface field patches.
   * Shape: { [interfaceId]: { [fieldName]: value, ... }, ... }
   */
  sendDelta(deltas) {
    if (!this.setupSend) return;
    this.socket.emit("updateProperties", deltas);
  }

  pushData(id, name, value) {
    if (!this.setupSend) return;
    var data = { id: id, name: name, value: value };
    this.socket.emit("updateProperty", data);
  }

  removeInterface(ids) {
    this.socket.emit("removeBotUI", ids);
  }

  createInterface(botUI) {
    var structure = botUI.getStructure();
    structure.id = botUI.id;
    this.socket.emit("createBotUI", structure);
  }
}

module.exports = Client;
