/**
 * Regression: reconnect churn must not leave sparse/growing client lists,
 * and destroy must drop publisher botUIs / lastSent.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Publisher = require("./Publisher");
const Client = require("./Client");
const { extractAtlas } = require("./atlas");

describe("Publisher client lifecycle", () => {
  it("keeps clients compact across join/leave churn", () => {
    const publisher = new Publisher(0, "mem");
    const ui = publisher.createInterface([{ name: "x", type: "text" }]);
    ui.setDataSource(() => ({ x: "ok" }));

    for (let i = 0; i < 200; i++) {
      const client = new Client({ emit() {} });
      publisher.clientJoined(client);
      publisher.clientLeft(client);
    }

    assert.equal(publisher.clients.length, 0);
    assert.equal(publisher.clients.filter(Boolean).length, 0);
  });

  it("skips fetchData when no clients are connected", () => {
    const publisher = new Publisher(0, "mem");
    let fetches = 0;
    const ui = publisher.createInterface([{ name: "x", type: "text" }]);
    ui.setDataSource(() => {
      fetches += 1;
      return { x: fetches };
    });

    publisher.publishOnce();
    assert.equal(fetches, 0);

    const client = new Client({ emit() {} });
    publisher.clientJoined(client);
    assert.equal(fetches, 1);

    publisher.publishOnce();
    assert.equal(fetches, 2);
  });

  it("removes nested interfaces from publisher on destroy", () => {
    const publisher = new Publisher(0, "mem");
    const root = publisher.createInterface([{ name: "bots", type: "botUI" }]);
    const sub = root.createSubBotUI([{ name: "a", type: "text" }], "bots");
    sub.setDataSource(() => ({ a: 1 }));
    root.setDataSource(() => ({}));

    assert.equal(publisher.botUIs.size, 2);
    root.destroy();
    assert.equal(publisher.botUIs.size, 0);
    assert.equal(publisher.lastSent.size, 0);
  });
});

describe("extractAtlas", () => {
  it("does not retain live G.imagesets / G.positions object identity", () => {
    const G = {
      items: { hp: { skin: "hp", name: "HP" } },
      titles: {},
      conditions: {},
      imagesets: { pack_20: { file: "/a.png", size: 16 } },
      positions: { hp: ["pack_20", 0, 0] },
    };
    const atlas = extractAtlas(G);
    assert.notEqual(atlas.imagesets, G.imagesets);
    assert.notEqual(atlas.positions, G.positions);
    assert.notEqual(atlas.imagesets.pack_20, G.imagesets.pack_20);
    assert.equal(atlas.imagesets.pack_20.file, "/a.png");
    assert.deepEqual(atlas.positions.hp, ["pack_20", 0, 0]);
  });
});
