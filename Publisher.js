/**
 * Created by Nexus on 16.08.2017.
 */

const util = require("util");
const BotUI = require("./BotUI");
let botUICount = 0;

function cloneValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch (e) {
    return JSON.parse(JSON.stringify(value));
  }
}

class Publisher {
  constructor(updateRate, title) {
    this.defaultStructure = [];
    this.botUIs = new Map();
    this.clients = [];
    this.title = title;
    /** @type {Map<number, object>} last values sent to clients, keyed by interface id */
    this.lastSent = new Map();
    this._publishScheduled = false;
    this.updateRate = updateRate;

    if (updateRate > 0) {
      this._interval = setInterval(() => {
        this.requestPublish();
      }, updateRate);
    }
  }

  /**
   * Coalesce multiple publish requests (e.g. several character beats) into one publishOnce.
   */
  requestPublish() {
    if (this._publishScheduled) return;
    this._publishScheduled = true;
    setImmediate(() => {
      this._publishScheduled = false;
      this.publishOnce();
    });
  }

  /**
   * Fetch all interface data, deep-diff per field, emit one batched delta if anything changed.
   */
  publishOnce() {
    if (this.clients.length === 0) {
      // Still refresh caches so a later join gets fresh fetch on setup after fetchData
      for (let [, botUI] of this.botUIs) {
        botUI.fetchData();
      }
      return;
    }

    /** @type {Object<string, Object<string, *>>} */
    const deltas = {};
    let hasChanges = false;

    for (let [id, botUI] of this.botUIs) {
      botUI.fetchData();
      const data = botUI.getData() || {};
      const prev = this.lastSent.get(id) || {};
      const changes = {};
      let interfaceChanged = false;

      const keys = new Set([...Object.keys(data), ...Object.keys(prev)]);
      for (const name of keys) {
        const nextVal = data[name];
        const prevVal = prev[name];
        if (!util.isDeepStrictEqual(nextVal, prevVal)) {
          changes[name] = nextVal;
          interfaceChanged = true;
        }
      }

      if (interfaceChanged) {
        deltas[id] = changes;
        hasChanges = true;
        const nextSent = { ...prev };
        for (const name of Object.keys(changes)) {
          if (changes[name] === undefined && !(name in data)) {
            delete nextSent[name];
          } else {
            nextSent[name] = cloneValue(data[name]);
          }
        }
        this.lastSent.set(id, nextSent);
      }
    }

    if (!hasChanges) return;

    for (let i = 0; i < this.clients.length; i++) {
      if (this.clients[i]) {
        this.clients[i].sendDelta(deltas);
      }
    }
  }

  clientJoined(client) {
    this.clients.push(client);
    console.log("Client " + client.id + " joined.");
    let structure = {};
    let data = {};
    for (let [id, botUI] of this.botUIs) {
      botUI.fetchData();
      const snapshot = botUI.getData() || {};
      structure[id] = botUI.getStructure();
      data[id] = snapshot;
      const sent = {};
      for (const name of Object.keys(snapshot)) {
        sent[name] = cloneValue(snapshot[name]);
      }
      this.lastSent.set(id, sent);
    }
    client.sendSetup(this.title, structure, data);
  }

  clientLeft(client) {
    delete this.clients[client.id];
    console.log("Client " + client.id + " left");
  }

  createInterface(structure, parent, attachTarget) {
    if (!structure) structure = this.defaultStructure;
    let botUI = new BotUI(this, botUICount++, structure, parent, attachTarget);
    this.botUIs.set(botUI.id, botUI);
    this.lastSent.set(botUI.id, {});
    for (let i in this.clients) {
      if (this.clients[i]) {
        this.clients[i].createInterface(botUI);
      }
    }
    return botUI;
  }

  removeInterfaces(ids) {
    for (let i in this.clients) {
      if (this.clients[i]) {
        this.clients[i].removeInterface(ids);
      }
    }
    for (let id of ids) {
      this.botUIs.delete(id);
      this.lastSent.delete(id);
    }
  }

  setStructure(structure) {
    this.defaultStructure = structure;
  }

  setDefaultStructure(structure) {
    this.defaultStructure = structure;
  }

  pushData(id, name, value) {
    const prev = this.lastSent.get(id) || {};
    if (util.isDeepStrictEqual(prev[name], value)) return;
    this.lastSent.set(id, { ...prev, [name]: cloneValue(value) });
    for (var i = 0; i < this.clients.length; i++) {
      if (this.clients[i]) {
        this.clients[i].pushData(id, name, value);
      }
    }
  }
}

module.exports = Publisher;
