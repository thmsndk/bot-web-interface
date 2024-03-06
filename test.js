/**
 * Created by Nexus on 15.08.2017.
 * modified by thmsn
 */
const BotWebInterface = require("./main");
const { name1, name2 } = require("./test-names");

let BWI = new BotWebInterface({ updateRate: 500, port: 2080 });

BWI.publisher.setDefaultStructure([
  { name: "botUIId", type: "text", label: "BotUI ID" },
  { name: "name", type: "text", label: "Name" },
  { name: "ticks", type: "text", label: "ticks" },
  {
    name: "health",
    type: "labelProgressBar", // this expects value to be a tuple the first value being the bar width and the second value being the text on the label
    label: "Health",
    options: { color: "red" },
  },
  {
    name: "xp",
    type: "progressBar", // this renders the value and sets the with of the bar to the value
    label: "XP",
    options: { color: "green" },
  },

  {
    name: "chart",
    type: "chart", // this renders the value and sets the with of the bar to the value
    label: "Chart",
    options: {
      type: "bar",
    },
  },
  {
    name: "chart2",
    type: "chart", // this renders the value and sets the with of the bar to the value
    label: "Chart",
    options: {
      type: "line",
    },
  },

  // botUI is a container used for "widgets" inside the "main" container
  // TODO: define columns mode or rows mode where each subwidget is ordered depending on this
  { name: "bots", type: "botUI", label: "Status" },
  {
    name: "bots2",
    type: "botUI",
    label: "Status",
    options: { flexDirection: "column" },
  },
]);

let setIntervalTicks = 0;
/**
 *
 * @type {Array<BotUI>}
 */
var interfaces = [];
var subInterfaces = [];

/**
 *
 * @returns {BotUI}
 */
function create() {
  const botUI = BWI.publisher.createInterface();
  botUI.setDataSource(function () {
    return {
      botUIId: botUI.id,
      name: generateName(),
      ticks: setIntervalTicks,
    };
  });

  // TODO: A Character box
  // character name top left
  // status in the middle
  // level on the right side
  // Death Inidicator, next to charactername? 🪦 😵 💀 ☠️
  // progressbar for health, should be a little higher
  // progressbar for manae, should be a little smaller than health
  // Inventory X / Y with a chart below it with the last N inventory changes (would be cool if the chart was inside the progressbar)
  // Gold perhaps also with a chart? Also show XP/h
  // Time To Level UP progressbar with changes overtime?
  // debuff progressbar with time left (specifically for monster hunts)

  // progressbar wtih XP also show XP/h

  // TODO: DPS/ HPS?

  // TODO: A Target box
  // Name left level right
  // Health progressbar
  // Mana progressbar
  // debuff progressbar

  // TODO: A Loot box

  // TODO: how would we render a monster icon? add sprite/spritesheet support where we give it a url and some data for rendering the sprite?
  // TODO: what about an item icon?
  // TODO: show (de)buffs? monsterhunt
  // TODO: gradient colored progressbar?
  // TODO: potions available?
  // TODO: Show tracktrix? computer image?
  let subBotUI1 = botUI.createSubBotUI(
    [
      { name: "header", type: "leftMiddleRightText" },
      { name: "foo", type: "text", label: "foo sub1" },
      { name: "id", type: "text", label: "id" },
      { name: "namse", type: "text", label: "namse" },
      { name: "nsame", type: "text", label: "nsame" },
    ],
    "bots"
  );
  let subBotUI2 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub2" },
      { name: "id", type: "text", label: "id" },
      { name: "toggleActive", type: "button", label: "asd" },
    ],
    "bots"
  );

  let subBotUI3 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub3" },
      { name: "id", type: "text", label: "id" },
      { name: "namse", type: "text", label: "namse" },
      { name: "nsame", type: "text", label: "nsame" },
    ],
    "bots2"
  );
  let subBotUI4 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub4" },
      { name: "id", type: "text", label: "id" },
      {
        name: "loot",
        type: "table",
        label: "Looted (12h)",
        headers: ["When", "Item", "Quantity"],
      }, // TODO: left label and right label?
    ],
    "bots2"
  );

  return [botUI, subBotUI1, subBotUI2, subBotUI3, subBotUI4];
}

for (let l = 0; l < 4; l++) {
  interfaces[l] = create();
}

const lootByCharacter = {};
setInterval(function () {
  setIntervalTicks++;
  let [botUI, subBotUI1, subBotUI2, subBotUI3, subBotUI4] = interfaces.shift();

  // This destroy was probably for testing shutting down an interface and creating a new
  if (setIntervalTicks % 100 == 0) {
    botUI.destroy();
    interfaces.push(create());
    return;
  }

  let i = 0;
  // Update data on the interfaces. this function will be evaluated often as Publisher will call it based on the updateRate
  botUI.setDataSource(function () {
    const maxHealth = 3000;
    const health = Math.random() * maxHealth;
    const healthPercentage = (100 * health) / maxHealth;

    return {
      botUIId: botUI.id,
      ticks: setIntervalTicks,
      name: botUI.cache.name,
      health: [
        healthPercentage.toFixed(2),
        `${health.toFixed(2)} / ${maxHealth}`,
      ],
      xp: (Math.random() * 100).toFixed(2),
      chart: {
        data: [
          { label: 2010, value: Math.random() * 10 },
          { label: 2011, value: Math.random() * 20 },
          { label: 2012, value: Math.random() * 15 },
          { label: 2013, value: Math.random() * 25 },
          { label: 2014, value: Math.random() * 22 },
          { label: 2015, value: Math.random() * 30 },
          { label: 2016, value: Math.random() * 28 },
        ],
      },
      chart2: {
        data: [
          { label: 2010, value: Math.random() * 10 },
          { label: 2011, value: Math.random() * 20 },
          { label: 2012, value: Math.random() * 15 },
          { label: 2013, value: Math.random() * 25 },
          { label: 2014, value: Math.random() * 22 },
          { label: 2015, value: Math.random() * 30 },
          { label: 2016, value: Math.random() * 28 },
        ],
      },
    };
  });

  subBotUI1.setDataSource(function () {
    return {
      header: { left: "Left", middle: "middle", right: "right" },
      id: subBotUI1.id,
      foo: i++,
    };
  });

  subBotUI2.setDataSource(function () {
    return {
      id: subBotUI2.id,
      foo: i++,
    };
  });

  subBotUI3.setDataSource(function () {
    return {
      id: subBotUI3.id,
      foo: i++,
    };
  });

  if (!lootByCharacter[subBotUI4.id]) {
    lootByCharacter[subBotUI4.id] = [];
  }

  if (Math.random() < 0.1) {
    const loot = [new Date(), generateName(), Math.floor(Math.random() * 100)];
    lootByCharacter[subBotUI4.id].splice(0, 0, loot);
  }

  subBotUI4.setDataSource(function () {
    return {
      id: subBotUI4.id,
      foo: i++,
      loot: lootByCharacter[subBotUI4.id].map((x) => [
        timeAgo(x[0]),
        x[1],
        x[2],
      ]),
    };
  });

  interfaces.push([botUI, subBotUI1, subBotUI2, subBotUI3, subBotUI4]);
}, 1000);

function capFirst(string) {
  if (!string) return;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function generateName() {
  const name =
    capFirst(name1[getRandomInt(0, name1.length + 1)]) +
    " " +
    capFirst(name2[getRandomInt(0, name2.length + 1)]);
  return name;
}

// https://stackoverflow.com/a/74456486
function timeAgo(date) {
  var seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );
  var interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes";
  return Math.floor(seconds) + " seconds";
}
